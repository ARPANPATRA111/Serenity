'use client';

import { authenticatedFetch } from '@/lib/api/authFetch';
import {
  clearSessionJson,
  coordinatedJson,
  invalidateCoordinatedRequests,
  readSessionJson,
  writeSessionJson,
} from '@/lib/api/requestCoordinator';
import type { CertificateStats } from './stats';

/**
 * Exact account totals for the dashboard and History, fetched separately from
 * their lists so a slow or failed aggregate never holds up the rows. Both
 * pages share one request per account: concurrent callers join the request in
 * flight, and a result is reused for a minute (five in this tab's session
 * storage, shown while a fresh copy loads).
 */

const MEMORY_TTL_MS = 60_000;
const SESSION_MAX_AGE_MS = 5 * 60_000;
const PREFIX = 'account-stats:';

function key(uid: string) {
  return `${PREFIX}${uid}`;
}

/** Totals saved earlier in this tab, or null. May be up to five minutes old. */
export function readCachedAccountStats(uid: string): CertificateStats | null {
  return readSessionJson<CertificateStats>(key(uid), SESSION_MAX_AGE_MS);
}

/** Fresh (or one-minute-old) totals. Rejects when the server cannot compute them. */
export async function fetchAccountStats(uid: string): Promise<CertificateStats> {
  const payload = await coordinatedJson<{ success?: boolean; stats?: CertificateStats }>(
    key(uid),
    () => authenticatedFetch('/api/certificates/stats', { cache: 'no-store' }),
    MEMORY_TTL_MS,
  );
  if (!payload.stats) throw new Error('Account totals are unavailable.');
  writeSessionJson(key(uid), payload.stats);
  return payload.stats;
}

/**
 * Forgets cached totals (and the dashboard summary that shows recent records)
 * after anything that changes them: generating, emailing, deleting.
 */
export function invalidateAccountStats(): void {
  invalidateCoordinatedRequests(PREFIX);
  invalidateCoordinatedRequests('dashboard-summary:');
  clearSessionJson(PREFIX);
  clearSessionJson('dashboard-summary:');
}
