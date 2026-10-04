import { NextRequest, NextResponse } from 'next/server';
import { normalizeCertificateId } from '@/lib/verification/certificateId';
import { clientFromHeaders, getVerification, noteCountedView } from '@/lib/verification/service';
import { recordVerificationView } from '@/lib/verification/viewTracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * View beacon sent by the verification page after it renders. It always
 * answers 200 so a counting problem can never surface to a verifier.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const certificateId = normalizeCertificateId(params.id);
  if (!certificateId) return NextResponse.json({ ok: true, outcome: 'skipped' });

  // Beacons fired by other sites are not views of this page.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ ok: true, outcome: 'skipped' });
  }

  const client = clientFromHeaders(request.headers);
  // Usually answered from cache: the page that sent the beacon just looked the
  // certificate up. Only valid certificates are counted.
  const lookup = await getVerification(certificateId, { client });
  if (lookup.status !== 'valid') return NextResponse.json({ ok: true, outcome: 'skipped' });

  const outcome = await recordVerificationView(certificateId, {
    ip: client,
    userAgent: request.headers.get('user-agent'),
  });
  if (outcome === 'counted') noteCountedView(certificateId);
  return NextResponse.json({ ok: true, outcome }, { headers: { 'Cache-Control': 'no-store' } });
}
