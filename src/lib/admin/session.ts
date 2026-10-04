import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { createLogger } from '@/lib/logger';
import { clientFromHeaders } from '@/lib/verification/service';
import {
  ADMIN_CLAIM,
  ADMIN_COLLECTIONS,
  CONSOLE_REQUEST_HEADER,
  LOCKOUT_DOC,
  LOCKOUT_MS,
  MAX_FAILED_UNLOCKS,
  PASSPHRASE_DOC,
  RECENT_SIGN_IN_MS,
  getAllowedAdminEmails,
  getSessionMaxAgeMs,
  isAdminConsoleEnabled,
  sessionCookieName,
} from './config';
import { verifyPassphrase } from './passphrase';
import { writeAudit } from './audit';

/**
 * Operator console access control. Every layer must pass:
 *
 * 1. The console is enabled for this deployment (ADMIN_CONSOLE_ENABLED).
 * 2. The caller holds a Firebase ID token for a verified account carrying the
 *    `serenityAdmin` custom claim. Claims can only be set with the service
 *    account (scripts/admin/grant-admin.mjs); no route in the app can set one.
 * 3. If ADMIN_EMAILS is configured, the account's email must be listed.
 * 4. The sign-in is recent, and the console passphrase matches a scrypt hash
 *    stored in Firestore (unreadable by browser clients). Repeated failures
 *    lock unlocking for 15 minutes.
 * 5. Unlocking issues a short-lived Firebase session cookie (HttpOnly,
 *    SameSite=Strict, Secure over HTTPS) that is re-verified, including
 *    revocation, on every console request, together with a custom request
 *    header that cross-site pages cannot send.
 *
 * Callers that fail any check receive a 404, so the console cannot be
 * discovered by probing.
 */

const logger = createLogger('ConsoleSession');

export interface ConsoleIdentity {
  uid: string;
  email: string | null;
  expiresAt: number;
}

export function consoleNotFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:';
}

function hasOperatorClaims(claims: Pick<DecodedIdToken, 'email' | 'email_verified'> & Record<string, unknown>): boolean {
  if (claims[ADMIN_CLAIM] !== true || claims.email_verified !== true) return false;
  const allowed = getAllowedAdminEmails();
  if (allowed.length === 0) return true;
  return typeof claims.email === 'string' && allowed.includes(claims.email.toLowerCase());
}

/**
 * Blocks cross-site requests: the custom header (which cross-site pages cannot
 * send without a CORS preflight this app never grants), a matching Origin when
 * present, and Fetch Metadata. The Origin is compared with the Host header
 * rather than request.nextUrl, which Next rewrites for loopback addresses.
 */
function isSameOriginConsoleRequest(request: NextRequest): boolean {
  if (request.headers.get(CONSOLE_REQUEST_HEADER) !== '1') return false;
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('host');
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    if (!host || originHost !== host) return false;
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  return true;
}

export async function readConsoleSession(request: NextRequest): Promise<ConsoleIdentity | null> {
  if (!isAdminConsoleEnabled()) return null;
  const cookie = request.cookies.get(sessionCookieName(isSecureRequest(request)))?.value;
  if (!cookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    if (!hasOperatorClaims(decoded)) return null;
    return { uid: decoded.uid, email: decoded.email ?? null, expiresAt: decoded.exp * 1000 };
  } catch {
    return null;
  }
}

/** Resolves the operator for a console API request, or a 404 response. */
export async function requireConsoleSession(request: NextRequest): Promise<ConsoleIdentity | NextResponse> {
  if (!isAdminConsoleEnabled() || !isSameOriginConsoleRequest(request)) return consoleNotFound();
  const identity = await readConsoleSession(request);
  return identity ?? consoleNotFound();
}

type UnlockFailure =
  | 'not_found'
  | 'reauth_required'
  | 'locked'
  | 'not_configured'
  | 'invalid_passphrase';

export type UnlockResult =
  | { ok: true; identity: ConsoleIdentity; cookie: { name: string; value: string; maxAgeSeconds: number; secure: boolean } }
  | { ok: false; reason: UnlockFailure; retryAfterSeconds?: number };

async function lockoutState(): Promise<{ lockedUntil: number; failures: number }> {
  const snapshot = await getAdminFirestore().collection(ADMIN_COLLECTIONS.secrets).doc(LOCKOUT_DOC).get();
  const data = snapshot.data() || {};
  return {
    lockedUntil: typeof data.lockedUntil === 'number' ? data.lockedUntil : 0,
    failures: typeof data.failures === 'number' ? data.failures : 0,
  };
}

async function recordFailedUnlock(): Promise<number> {
  const db = getAdminFirestore();
  const reference = db.collection(ADMIN_COLLECTIONS.secrets).doc(LOCKOUT_DOC);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data() || {};
    const now = Date.now();
    const windowStart = typeof data.windowStart === 'number' && now - data.windowStart < LOCKOUT_MS ? data.windowStart : now;
    const failures = (windowStart === data.windowStart && typeof data.failures === 'number' ? data.failures : 0) + 1;
    const lockedUntil = failures >= MAX_FAILED_UNLOCKS ? now + LOCKOUT_MS : 0;
    transaction.set(reference, { failures, windowStart, lockedUntil, updatedAt: new Date(now).toISOString() });
    return lockedUntil;
  });
}

async function clearFailedUnlocks(): Promise<void> {
  await getAdminFirestore().collection(ADMIN_COLLECTIONS.secrets).doc(LOCKOUT_DOC).set({
    failures: 0,
    windowStart: 0,
    lockedUntil: 0,
    updatedAt: new Date().toISOString(),
  });
}

export async function unlockConsole(request: NextRequest, passphrase: unknown): Promise<UnlockResult> {
  if (!isAdminConsoleEnabled() || !isSameOriginConsoleRequest(request)) return { ok: false, reason: 'not_found' };

  const header = request.headers.get('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return { ok: false, reason: 'not_found' };

  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken, true);
  } catch {
    return { ok: false, reason: 'not_found' };
  }
  if (!hasOperatorClaims(decoded)) return { ok: false, reason: 'not_found' };

  const client = clientFromHeaders(request.headers);
  const actor = { actorUid: decoded.uid, actorEmail: decoded.email ?? null, client };

  if (Date.now() - decoded.auth_time * 1000 > RECENT_SIGN_IN_MS) {
    return { ok: false, reason: 'reauth_required' };
  }

  const lockout = await lockoutState();
  if (lockout.lockedUntil > Date.now()) {
    return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil((lockout.lockedUntil - Date.now()) / 1000) };
  }

  const secret = await getAdminFirestore().collection(ADMIN_COLLECTIONS.secrets).doc(PASSPHRASE_DOC).get();
  const encoded = secret.data()?.passphraseHash;
  if (typeof encoded !== 'string' || !encoded) {
    logger.warn('Console unlock attempted before a passphrase was configured');
    return { ok: false, reason: 'not_configured' };
  }

  if (!(await verifyPassphrase(passphrase, encoded))) {
    const lockedUntil = await recordFailedUnlock();
    await writeAudit({ ...actor, action: 'console.unlock_failed', details: { locked: lockedUntil > 0 } });
    if (lockedUntil > 0) {
      return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil((lockedUntil - Date.now()) / 1000) };
    }
    return { ok: false, reason: 'invalid_passphrase' };
  }

  if (lockout.failures > 0) await clearFailedUnlocks();

  const maxAgeMs = getSessionMaxAgeMs();
  const value = await getAdminAuth().createSessionCookie(idToken, { expiresIn: maxAgeMs });
  await writeAudit({ ...actor, action: 'console.unlocked' });

  const secure = isSecureRequest(request);
  return {
    ok: true,
    identity: { uid: decoded.uid, email: decoded.email ?? null, expiresAt: Date.now() + maxAgeMs },
    cookie: { name: sessionCookieName(secure), value, maxAgeSeconds: Math.floor(maxAgeMs / 1000), secure },
  };
}

export function applySessionCookie(response: NextResponse, cookie: { name: string; value: string; maxAgeSeconds: number; secure: boolean }) {
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: 'strict',
    path: '/',
    maxAge: cookie.maxAgeSeconds,
  });
}

export function clearSessionCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(sessionCookieName(isSecureRequest(request)), '', {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
