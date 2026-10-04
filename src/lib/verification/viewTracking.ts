import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { createLogger } from '@/lib/logger';
import { isValidCertificateId } from './certificateId';

/**
 * Best-effort verification view counting.
 *
 * Counting is deliberately decoupled from answering: the verification
 * response never waits on, or fails because of, a write. Previously a failed
 * view-count transaction (write-quota exhaustion, contention, a missing
 * DAILY_IP_SALT) turned into a 500 and the certificate appeared unverifiable.
 *
 * Semantics are unchanged: `viewCount` counts unique viewers per UTC day,
 * identified by a salted hash of their IP address (the raw IP is never
 * stored). Repeat views on the same day now cost one read and no writes.
 */

const logger = createLogger('VerificationViews');

export type ViewOutcome = 'counted' | 'repeat' | 'skipped' | 'failed';

// Link-preview fetchers (Slackbot, Discordbot, TelegramBot, SkypeUriPreview,
// LinkedInBot, ...) are covered by the generic terms. WhatsApp's previewer is
// listed explicitly because its user agent contains neither "bot" nor "preview".
const AUTOMATED_AGENT = new RegExp(
  [
    'bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit', 'facebookcatalog', 'embedly',
    'preview', 'whatsapp/', 'vkshare', 'pinterest', 'quora link', 'outbrain', 'headless',
    'lighthouse', 'pagespeed', 'curl/', 'wget', 'python-requests', 'python-urllib', 'axios',
    'node-fetch', 'undici', 'go-http-client', 'okhttp', 'java/', 'libwww', 'httpclient',
    'scrapy', 'uptime', 'checkly',
  ].join('|'),
  'i',
);

export function isAutomatedAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true;
  return AUTOMATED_AGENT.test(userAgent);
}

let warnedMissingSalt = false;

/**
 * The daily salt keeps viewer hashes unlinkable across days. When
 * DAILY_IP_SALT is not configured, a salt is derived from the Admin private
 * key (secret and stable) instead of failing, and counting is skipped only
 * when neither secret exists outside local mode.
 */
export function getViewSaltBase(): string | null {
  if (process.env.DAILY_IP_SALT) return process.env.DAILY_IP_SALT;

  const localMode = process.env.NODE_ENV !== 'production' || process.env.USE_FIREBASE_EMULATORS === 'true';
  if (localMode) return 'local-emulator-only';

  const secret = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!warnedMissingSalt) {
    warnedMissingSalt = true;
    logger.warn(secret
      ? 'DAILY_IP_SALT is not set; deriving the viewer salt from the Admin credentials'
      : 'DAILY_IP_SALT is not set and no fallback secret exists; view counting is disabled');
  }
  return secret ? createHash('sha256').update(`serenity-view-salt|${secret}`).digest('hex') : null;
}

/** Same formula as the original route so same-day repeat detection carries over. */
export function viewerHash(ip: string, saltBase: string, now = new Date()): string {
  const day = now.toISOString().split('T')[0];
  return createHash('sha256').update(`${ip}-${saltBase}-${day}`).digest('hex').substring(0, 32);
}

export async function recordVerificationView(
  certificateId: string,
  viewer: { ip: string | null; userAgent: string | null },
): Promise<ViewOutcome> {
  try {
    if (!isValidCertificateId(certificateId)) return 'skipped';
    if (isAutomatedAgent(viewer.userAgent)) return 'skipped';

    const saltBase = getViewSaltBase();
    if (!saltBase) return 'skipped';

    const db = getAdminFirestore();
    const certificateRef = db.collection('certificates').doc(certificateId);
    const visitorRef = certificateRef.collection('visitors').doc(viewerHash(viewer.ip || '0.0.0.0', saltBase));

    const visitor = await visitorRef.get();
    if (visitor.exists) return 'repeat';

    // `create` fails if a concurrent request already registered this viewer,
    // and the batch is atomic, so a viewer is never counted twice.
    const batch = db.batch();
    batch.create(visitorRef, {
      firstViewAt: FieldValue.serverTimestamp(),
      viewCount: 1,
    });
    batch.update(certificateRef, { viewCount: FieldValue.increment(1) });
    await batch.commit();
    return 'counted';
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    // 6 = ALREADY_EXISTS: a concurrent request counted this viewer first.
    if (code === 6 || code === 'already-exists') return 'repeat';
    logger.warn('View counting failed', { certificateId, code: String(code ?? 'unknown') });
    return 'failed';
  }
}

export async function recordVerificationViewWithin(
  timeoutMs: number,
  certificateId: string,
  viewer: { ip: string | null; userAgent: string | null },
): Promise<ViewOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ViewOutcome>((resolve) => {
    timer = setTimeout(() => resolve('failed'), timeoutMs);
  });
  try {
    return await Promise.race([recordVerificationView(certificateId, viewer), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
