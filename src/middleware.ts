import { NextRequest, NextResponse } from 'next/server';
import { normalizeCertificateId } from '@/lib/verification/certificateId';

/**
 * Runs only for verification links and the operator console.
 *
 * Pages render inside the root loading boundary, so by the time a page could
 * call notFound() or redirect() the response has already started with a 200.
 * Deciding here gives real HTTP answers:
 *
 * - `/verify/<id>` links damaged in transit (trailing punctuation, encoded
 *   characters, extra path segments) get a 307 to the canonical address, which
 *   QR scanner apps and link previewers follow without running JavaScript.
 * - `/ops/<key>` with a wrong or missing key, or with the console disabled,
 *   becomes the same 404 as any unknown address.
 */
export const config = {
  matcher: ['/verify/:path+', '/ops/:path*'],
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function notFound(request: NextRequest): NextResponse {
  // No page exists at this path, so Next renders its standard 404 response.
  return NextResponse.rewrite(new URL('/_serenity-unknown-route', request.url));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/ops' || pathname.startsWith('/ops/')) {
    const key = safeDecode(pathname.slice('/ops/'.length).split('/')[0] || '');
    const expected = process.env.ADMIN_CONSOLE_PATH_KEY || '';
    const enabled = process.env.ADMIN_CONSOLE_ENABLED === 'true';
    if (!enabled || expected.length < 16 || !constantTimeEqual(key, expected)) {
      return notFound(request);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/verify/')) {
    const raw = pathname.slice('/verify/'.length);
    const id = normalizeCertificateId(raw);
    if (id && id !== raw) {
      const canonical = request.nextUrl.clone();
      canonical.pathname = `/verify/${id}`;
      canonical.search = '';
      // Next reports loopback hosts as "localhost"; keep the exact loopback
      // host locally so a redirect never switches origin. Other hosts are
      // left as Next resolved them.
      const host = request.headers.get('host');
      if (host && /^(127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) canonical.host = host;
      return NextResponse.redirect(canonical, 307);
    }
  }

  return NextResponse.next();
}
