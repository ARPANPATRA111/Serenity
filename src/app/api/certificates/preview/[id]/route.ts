import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { readPreview } from '@/lib/storage/certificatePreviews';
import { isValidCertificateId } from '@/lib/verification/certificateId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public preview image of an issued certificate, as shown on its verification
 * page. A preview never changes once stored (its URL carries the image hash),
 * so it is cached for a year by browsers and the CDN: Firestore is read only on
 * a CDN miss.
 */

const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
const MISSING = 'public, max-age=60, s-maxage=60';

async function respond(id: string, includeBody: boolean) {
  if (!isValidCertificateId(id)) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': MISSING } });
  }

  try {
    const preview = await readPreview(getAdminFirestore(), id);
    if (!preview) {
      return new NextResponse(null, { status: 404, headers: { 'Cache-Control': MISSING } });
    }
    return new NextResponse(includeBody ? new Uint8Array(preview.data) : null, {
      status: 200,
      headers: {
        'Content-Type': preview.contentType,
        'Content-Length': String(preview.bytes),
        'Cache-Control': IMMUTABLE,
        ...(preview.sha256 ? { ETag: `"${preview.sha256.slice(0, 32)}"` } : {}),
        'X-Content-Type-Options': 'nosniff',
        // Readable from other sites (link previews, embeds), never framed or scripted.
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    // A transient failure must not be cached as if the preview were missing.
    return new NextResponse(null, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } });
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  return respond(params.id, true);
}

export async function HEAD(_request: NextRequest, { params }: { params: { id: string } }) {
  return respond(params.id, false);
}
