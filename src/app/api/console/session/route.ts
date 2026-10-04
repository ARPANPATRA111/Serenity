import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookie,
  clearSessionCookie,
  consoleNotFound,
  readConsoleSession,
  requireConsoleSession,
  unlockConsole,
} from '@/lib/admin/session';
import { writeAudit } from '@/lib/admin/audit';
import { isAdminConsoleEnabled } from '@/lib/admin/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };

/** Reports whether this browser holds a live console session. */
export async function GET(request: NextRequest) {
  if (!isAdminConsoleEnabled()) return consoleNotFound();
  if (request.headers.get('x-serenity-console') !== '1') return consoleNotFound();
  const identity = await readConsoleSession(request);
  // No session looks exactly like every other console route without one.
  if (!identity) return consoleNotFound();
  return NextResponse.json(
    { active: true, email: identity.email, expiresAt: new Date(identity.expiresAt).toISOString() },
    { headers: NO_STORE },
  );
}

/** Unlocks the console: operator ID token (Authorization header) plus the console passphrase. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await unlockConsole(request, (body as { passphrase?: unknown })?.passphrase);

  if (result.ok) {
    const response = NextResponse.json(
      { active: true, email: result.identity.email, expiresAt: new Date(result.identity.expiresAt).toISOString() },
      { headers: NO_STORE },
    );
    applySessionCookie(response, result.cookie);
    return response;
  }

  switch (result.reason) {
    case 'reauth_required':
      return NextResponse.json(
        { error: 'Sign in again to unlock the console.', code: 'REAUTH_REQUIRED' },
        { status: 401, headers: NO_STORE },
      );
    case 'locked':
      return NextResponse.json(
        { error: 'Too many incorrect passphrases. Unlocking is paused.', code: 'LOCKED', retryAfterSeconds: result.retryAfterSeconds },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(result.retryAfterSeconds ?? 900) } },
      );
    case 'not_configured':
      return NextResponse.json(
        { error: 'No console passphrase is configured. Run scripts/admin/set-console-passphrase.mjs.', code: 'NOT_CONFIGURED' },
        { status: 503, headers: NO_STORE },
      );
    case 'invalid_passphrase':
      return NextResponse.json(
        { error: 'That passphrase is not correct.', code: 'INVALID_PASSPHRASE' },
        { status: 401, headers: NO_STORE },
      );
    default:
      return consoleNotFound();
  }
}

/** Locks the console by clearing the session cookie. */
export async function DELETE(request: NextRequest) {
  const identity = await requireConsoleSession(request);
  if (identity instanceof NextResponse) return identity;

  await writeAudit({ action: 'console.locked', actorUid: identity.uid, actorEmail: identity.email });
  const response = NextResponse.json({ active: false }, { headers: NO_STORE });
  clearSessionCookie(request, response);
  return response;
}
