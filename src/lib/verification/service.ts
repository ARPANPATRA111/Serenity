import { revalidateTag, unstable_cache } from 'next/cache';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getEvent, toPublicEventContext } from '@/lib/firebase/events';
import { createLogger } from '@/lib/logger';
import { isValidCertificateId } from './certificateId';
import {
  PUBLIC_CERTIFICATE_FIELDS,
  classifyLookupError,
  lookupCertificate,
  type CertificateFields,
  type CertificateSource,
  type VerificationLookup,
} from './lookup';

/**
 * Server-side verification lookups with layered resilience.
 *
 * 1. A per-instance memory cache answers hot certificates without touching
 *    Firestore and keeps the last good answer as a stale fallback.
 * 2. The Next.js data cache shares answers across instances and deployments;
 *    when revalidation fails it keeps serving the previous answer.
 * 3. Only definitive answers (valid, revoked) are cached. "Not found" and
 *    infrastructure failures are never cached, so a new certificate is never
 *    reported missing because of an old cache entry.
 *
 * A certificate that has been verified recently therefore keeps verifying
 * through Firestore outages and daily read-quota exhaustion.
 */

const logger = createLogger('Verification');

const DATA_CACHE_SECONDS = 300;
const MEMORY_FRESH_MS = 60_000;
const MEMORY_STALE_MS = 7 * 24 * 60 * 60_000;
const MEMORY_MAX_ENTRIES = 2_000;

const NOT_FOUND_WINDOW_MS = 60_000;
const NOT_FOUND_LIMIT = 40;
const LIMITER_MAX_ENTRIES = 10_000;

type CacheableLookup = Extract<VerificationLookup, { status: 'valid' | 'revoked' }>;

const memory = new Map<string, { result: CacheableLookup; storedAt: number }>();
const notFoundByClient = new Map<string, { count: number; windowStart: number }>();

function remember(id: string, result: CacheableLookup) {
  memory.delete(id);
  memory.set(id, { result, storedAt: Date.now() });
  if (memory.size > MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
}

function recall(id: string, maxAgeMs: number): CacheableLookup | null {
  const entry = memory.get(id);
  if (!entry || Date.now() - entry.storedAt > maxAgeMs) return null;
  return entry.result;
}

/**
 * Throttles only clients that produce many "not found" answers, which is the
 * signature of ID enumeration or a broken link crawler. A crowd behind one
 * venue network verifying real certificates is never limited.
 */
function isClientLimited(client: string): boolean {
  const entry = notFoundByClient.get(client);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > NOT_FOUND_WINDOW_MS) {
    notFoundByClient.delete(client);
    return false;
  }
  return entry.count >= NOT_FOUND_LIMIT;
}

function recordNotFound(client: string) {
  const now = Date.now();
  const entry = notFoundByClient.get(client);
  if (!entry || now - entry.windowStart > NOT_FOUND_WINDOW_MS) {
    notFoundByClient.set(client, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
  if (notFoundByClient.size > LIMITER_MAX_ENTRIES) {
    const oldest = notFoundByClient.keys().next().value;
    if (oldest !== undefined) notFoundByClient.delete(oldest);
  }
}

const firestoreSource: CertificateSource = {
  async fetchCertificate(id) {
    const db = getAdminFirestore();
    const reference = db.collection('certificates').doc(id);
    // A field mask keeps recipient metadata and other private fields off the
    // wire; the read still costs exactly one document read.
    const [snapshot] = await db.getAll(reference, { fieldMask: [...PUBLIC_CERTIFICATE_FIELDS] });
    return snapshot.exists ? (snapshot.data() as CertificateFields) : null;
  },
  async fetchEventContext(eventId, ownerId) {
    const event = await getEvent(eventId);
    if (!event || event.userId !== ownerId) return null;
    return toPublicEventContext(event);
  },
};

const UNCACHED = Symbol.for('serenity.verification.uncached');

async function lookupThroughDataCache(id: string): Promise<VerificationLookup> {
  const cached = unstable_cache(
    async () => {
      const result = await lookupCertificate(id, firestoreSource);
      if (result.status === 'valid' || result.status === 'revoked') return result;
      // Throwing keeps non-definitive answers out of the shared cache.
      throw Object.assign(new Error('uncached verification result'), { [UNCACHED]: result });
    },
    ['verification-lookup-v1', id],
    { revalidate: DATA_CACHE_SECONDS, tags: ['verification', `verification:${id}`] },
  );

  try {
    return await cached();
  } catch (error) {
    const uncached = (error as Record<symbol, VerificationLookup> | null)?.[UNCACHED];
    if (uncached) return uncached;
    // The data cache itself failed (it is unavailable in some local and test
    // setups). Fall back to a direct lookup rather than failing verification.
    logger.warn('Verification data cache unavailable; using a direct lookup', { certificateId: id });
    return lookupCertificate(id, firestoreSource);
  }
}

export interface VerificationContext {
  /** Client identifier (for example the forwarded IP) used only for abuse limiting. */
  client?: string | null;
}

export async function getVerification(
  rawId: unknown,
  context: VerificationContext = {},
): Promise<VerificationLookup> {
  if (!isValidCertificateId(rawId)) return { status: 'invalid_id' };
  const id = rawId;

  const hot = recall(id, MEMORY_FRESH_MS);
  if (hot) return hot;

  if (context.client && isClientLimited(context.client)) {
    return { status: 'unavailable', certificateId: id, reason: 'rate_limited' };
  }

  let result: VerificationLookup;
  try {
    result = await lookupThroughDataCache(id);
  } catch (error) {
    result = { status: 'unavailable', certificateId: id, reason: classifyLookupError(error) };
  }

  if (result.status === 'valid' || result.status === 'revoked') {
    remember(id, result);
    return result;
  }

  if (result.status === 'not_found') {
    if (context.client) recordNotFound(context.client);
    return result;
  }

  if (result.status === 'unavailable') {
    logger.warn('Verification lookup unavailable', { certificateId: id, reason: result.reason });
    const stale = recall(id, MEMORY_STALE_MS);
    if (stale) return { ...stale, stale: true };
  }

  return result;
}

/**
 * Keeps this instance's cached view count in step after a counted view, so
 * back-to-back answers never show the count going backwards.
 */
export function noteCountedView(id: string) {
  const entry = memory.get(id);
  if (entry && entry.result.status === 'valid') {
    entry.result = {
      ...entry.result,
      certificate: { ...entry.result.certificate, viewCount: entry.result.certificate.viewCount + 1 },
    };
  }
}

/** Drops cached answers after a certificate changes (for example on revocation). */
export function invalidateVerification(id: string) {
  memory.delete(id);
  try {
    revalidateTag(`verification:${id}`);
  } catch {
    // Outside a Next.js request context there is no shared cache to clear.
  }
}

export function clientFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || null;
  return headers.get('x-real-ip');
}
