import { NextRequest, NextResponse } from 'next/server';
import { normalizeCertificateId } from '@/lib/verification/certificateId';
import { clientFromHeaders, getVerification, noteCountedView } from '@/lib/verification/service';
import { recordVerificationViewWithin } from '@/lib/verification/viewTracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Public verification API.
 *
 * The response contract is unchanged from earlier releases (status codes,
 * `success`/`isValid`, error strings, and the certificate shape), with two
 * compatible refinements: `issuedAt` is always an ISO string, and an
 * infrastructure problem returns a retryable 503 instead of a generic 500 so
 * a verifier is never told that a genuine certificate is invalid.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const certificateId = normalizeCertificateId(params.id);
  if (!certificateId) {
    return NextResponse.json(
      { success: false, isValid: false, error: 'Invalid certificate ID' },
      { status: 400, headers: NO_STORE },
    );
  }

  const client = clientFromHeaders(request.headers);
  const result = await getVerification(certificateId, { client });

  switch (result.status) {
    case 'not_found':
    case 'invalid_id':
      return NextResponse.json(
        { success: false, isValid: false, error: 'Certificate not found' },
        { status: 404, headers: NO_STORE },
      );
    case 'revoked':
      return NextResponse.json(
        { success: false, isValid: false, status: 'revoked', error: 'Certificate has been revoked' },
        { status: 410, headers: NO_STORE },
      );
    case 'unavailable':
      return NextResponse.json(
        {
          success: false,
          isValid: false,
          retryable: true,
          reason: result.reason,
          error: 'Verification is temporarily unavailable. This does not mean the certificate is invalid.',
        },
        { status: 503, headers: { ...NO_STORE, 'Retry-After': '30' } },
      );
    case 'valid': {
      const outcome = await recordVerificationViewWithin(1_500, certificateId, {
        ip: client,
        userAgent: request.headers.get('user-agent'),
      });
      const isNewView = outcome === 'counted';
      if (isNewView) noteCountedView(certificateId);
      return NextResponse.json(
        {
          success: true,
          isValid: true,
          isNewView,
          ...(result.stale ? { stale: true } : {}),
          certificate: {
            ...result.certificate,
            viewCount: result.certificate.viewCount + (isNewView ? 1 : 0),
          },
        },
        { headers: NO_STORE },
      );
    }
  }
}
