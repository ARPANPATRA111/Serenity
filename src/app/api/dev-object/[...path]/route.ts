import { NextRequest, NextResponse } from 'next/server';
import { contentTypeForPath, isLocalObjectStore, readLocalObject, toSafeObjectPath } from '@/lib/storage/objectStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves objects written by the emulator-mode object store. Outside emulator
 * mode this route does not exist as far as callers can tell.
 */
export async function GET(_request: NextRequest, { params }: { params: { path: string[] } }) {
  if (!isLocalObjectStore()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  let safePath: string;
  try {
    safePath = toSafeObjectPath((params.path || []).join('/'));
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }

  const body = await readLocalObject(safePath);
  if (!body) return new NextResponse('Not Found', { status: 404 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentTypeForPath(safePath),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
