import { timingSafeEqual } from 'node:crypto';

/**
 * Operator console configuration.
 *
 * The console is off unless ADMIN_CONSOLE_ENABLED is "true", and its page is
 * only served at /ops/<ADMIN_CONSOLE_PATH_KEY>. Everything else answers 404,
 * exactly like a route that does not exist. The path key is an obscurity layer
 * only; access is enforced by the checks in `session.ts`.
 */

/** Firebase custom claim that marks an operator account. Set only by `scripts/admin/grant-admin.mjs`. */
export const ADMIN_CLAIM = 'serenityAdmin';

/** Firestore locations used by the console. Browser access is denied by firestore.rules. */
export const ADMIN_COLLECTIONS = {
  secrets: '_adminSecrets',
  usage: '_adminUsage',
  audit: 'adminAuditLog',
} as const;

export const PASSPHRASE_DOC = 'console';
export const LOCKOUT_DOC = 'lockout';

export const MAX_FAILED_UNLOCKS = 5;
export const LOCKOUT_MS = 15 * 60_000;
/** An unlock needs a sign-in this recent, so a long-idle session cannot be escalated. */
export const RECENT_SIGN_IN_MS = 10 * 60_000;

export function isAdminConsoleEnabled(): boolean {
  return process.env.ADMIN_CONSOLE_ENABLED === 'true';
}

export function getConfiguredPathKey(): string | null {
  const key = process.env.ADMIN_CONSOLE_PATH_KEY || '';
  return key.length >= 16 ? key : null;
}

export function matchesPathKey(candidate: unknown): boolean {
  const expected = getConfiguredPathKey();
  if (!expected || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Optional second allowlist; when set, the operator's email must be listed too. */
export function getAllowedAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getSessionMaxAgeMs(): number {
  const minutes = Number(process.env.ADMIN_SESSION_TTL_MINUTES || 60);
  const bounded = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 8 * 60) : 60;
  return bounded * 60_000;
}

export function getDailyReadBudget(): number {
  const budget = Number(process.env.ADMIN_DAILY_READ_BUDGET || 5_000);
  return Number.isFinite(budget) && budget > 0 ? budget : 5_000;
}

/** `__Host-` cookies must be Secure, so the prefix is only used over HTTPS. */
export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-serenity-console' : 'serenity-console';
}

export const CONSOLE_REQUEST_HEADER = 'x-serenity-console';
