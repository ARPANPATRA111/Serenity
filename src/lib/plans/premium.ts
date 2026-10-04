/**
 * Single source of truth for whether a user's premium plan is in effect.
 *
 * Premium has always been the boolean `isPremium` on `users/{uid}`. Plans
 * granted from the operator console may also carry `premiumUntil`; once that
 * moment passes the plan lapses on its own. Records without `premiumUntil`
 * (every premium user before this change) stay premium indefinitely.
 */

export interface PremiumFields {
  isPremium?: unknown;
  premiumUntil?: unknown;
  premiumSource?: unknown;
}

export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    const candidate = value as { toMillis?: unknown; seconds?: unknown; _seconds?: unknown };
    if (typeof candidate.toMillis === 'function') {
      const millis = (candidate.toMillis as () => number).call(value);
      return Number.isFinite(millis) ? millis : null;
    }
    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : candidate._seconds;
    if (typeof seconds === 'number') return seconds * 1000;
  }
  return null;
}

export function isPremiumActive(user: PremiumFields | null | undefined, now = Date.now()): boolean {
  if (!user || user.isPremium !== true) return false;
  const until = toMillis(user.premiumUntil);
  return until === null || until > now;
}

export interface PremiumSummary {
  active: boolean;
  /** ISO timestamp when an expiring plan ends, or null for no expiry. */
  until: string | null;
  /** True when the record says premium but the expiry has passed. */
  expired: boolean;
  source: string | null;
}

export function summarizePremium(user: PremiumFields | null | undefined, now = Date.now()): PremiumSummary {
  const until = toMillis(user?.premiumUntil);
  const active = isPremiumActive(user, now);
  return {
    active,
    until: until === null ? null : new Date(until).toISOString(),
    expired: user?.isPremium === true && !active,
    source: typeof user?.premiumSource === 'string' ? user.premiumSource : null,
  };
}
