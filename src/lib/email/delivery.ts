import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Retry-safe certificate email delivery (work package 5).
 *
 * Every send attempt is one document in `emailDeliveries`, keyed by the
 * account, certificate, intended recipient and the caller's send intent
 * (`idempotencyKey`). The key makes duplicate clicks and client retries
 * harmless: a delivery the provider already accepted is reported again
 * instead of being sent twice, and one still in flight is not started again.
 *
 * Capacity is reserved in the same transaction: the per-account daily
 * allowance (`DAILY_EMAIL_LIMIT`) and the provider's daily budget shared by
 * every account (`EMAIL_PROVIDER_DAILY_LIMIT`, Brevo's free plan allows 300).
 * Before this, the allowance was read and then updated separately, so
 * concurrent requests could pass it.
 *
 * Outcomes are kept apart: `accepted` (the provider took the message),
 * `failed` (it did not; `retryable` says whether trying again can help),
 * `unknown` (no answer, so it may have been sent; never retried
 * automatically), then `delivered`, `bounced` or `suppressed` from provider
 * events. Only a hash of the recipient address is stored here.
 */

export type DeliveryStatus = 'sending' | 'accepted' | 'deferred' | 'delivered' | 'bounced' | 'suppressed' | 'failed' | 'unknown';

/** A delivery still `sending` after this long is treated as abandoned. */
export const SENDING_STALE_MS = 2 * 60_000;

export function dailyLimits() {
  return {
    perAccount: Math.max(0, Number.parseInt(process.env.DAILY_EMAIL_LIMIT || '300', 10) || 300),
    provider: Math.max(0, Number.parseInt(process.env.EMAIL_PROVIDER_DAILY_LIMIT || '300', 10) || 300),
  };
}

export function normalizeRecipient(email: string): string {
  return email.trim().toLowerCase();
}

export function recipientHash(email: string): string {
  return createHash('sha256').update(normalizeRecipient(email)).digest('hex');
}

export function deliveryIdFor(input: { userId: string; certificateId: string; to: string; idempotencyKey: string }): string {
  return createHash('sha256')
    .update([input.userId, input.certificateId, normalizeRecipient(input.to), input.idempotencyKey].join('\u0000'))
    .digest('hex')
    .slice(0, 40);
}

export type Reservation =
  | { outcome: 'proceed'; deliveryId: string; attempt: number; remaining: number }
  | { outcome: 'duplicate'; deliveryId: string; messageId: string | null }
  | { outcome: 'in_progress'; deliveryId: string }
  | { outcome: 'unknown'; deliveryId: string }
  | { outcome: 'suppressed'; deliveryId: string; reason: string }
  | { outcome: 'account_limit'; limit: number }
  | { outcome: 'provider_limit'; limit: number };

/**
 * Decides, in one transaction, whether this send may go ahead, and if so
 * marks it `sending` and takes one unit of both daily budgets.
 */
export async function reserveDelivery(
  db: Firestore,
  input: { userId: string; certificateId: string; to: string; idempotencyKey: string; day: string; now?: number },
): Promise<Reservation> {
  const now = input.now ?? Date.now();
  const limits = dailyLimits();
  const deliveryId = deliveryIdFor(input);
  const deliveryRef = db.collection('emailDeliveries').doc(deliveryId);
  const suppressionRef = db.collection('emailSuppressions').doc(recipientHash(input.to));
  // Same document the allowance always used, so today's count carries over.
  const accountRef = db.collection('rateLimits').doc(`email_${input.userId}_${input.day}`);
  const providerRef = db.collection('rateLimits').doc(`email_provider_${input.day}`);

  return db.runTransaction(async (transaction) => {
    const [delivery, suppression, account, provider] = await Promise.all([
      transaction.get(deliveryRef),
      transaction.get(suppressionRef),
      transaction.get(accountRef),
      transaction.get(providerRef),
    ]);

    const existing = delivery.data();
    if (existing) {
      const status = existing.status as DeliveryStatus;
      if (status === 'accepted' || status === 'delivered' || status === 'deferred') {
        return { outcome: 'duplicate', deliveryId, messageId: existing.messageId ?? null };
      }
      if (status === 'unknown') return { outcome: 'unknown', deliveryId };
      if (status === 'bounced' || status === 'suppressed') {
        return { outcome: 'suppressed', deliveryId, reason: existing.reason || status };
      }
      const updatedAt = Number(existing.updatedAtMs) || 0;
      if (status === 'sending' && now - updatedAt < SENDING_STALE_MS) return { outcome: 'in_progress', deliveryId };
    }

    if (suppression.exists) {
      return { outcome: 'suppressed', deliveryId, reason: String(suppression.get('reason') || 'suppressed') };
    }

    const accountCount = Number(account.get('count')) || 0;
    if (accountCount >= limits.perAccount) return { outcome: 'account_limit', limit: limits.perAccount };
    const providerCount = Number(provider.get('count')) || 0;
    if (providerCount >= limits.provider) return { outcome: 'provider_limit', limit: limits.provider };

    const attempt = (Number(existing?.attempts) || 0) + 1;
    transaction.set(deliveryRef, {
      userId: input.userId,
      certificateId: input.certificateId,
      recipientHash: recipientHash(input.to),
      idempotencyKey: input.idempotencyKey,
      status: 'sending',
      attempts: attempt,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    transaction.set(accountRef, {
      count: accountCount + 1, date: input.day, userId: input.userId, lastEmailAt: FieldValue.serverTimestamp(),
      ...(account.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    transaction.set(providerRef, {
      count: providerCount + 1, date: input.day, lastEmailAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { outcome: 'proceed', deliveryId, attempt, remaining: Math.max(0, limits.perAccount - accountCount - 1) };
  });
}

export type ProviderFailure = { kind: 'rejected'; retryable: boolean; status?: number; message: string } | { kind: 'unknown'; message: string };

/** Why a provider call failed, and whether the message may have gone out anyway. */
export function classifyProviderError(error: unknown): ProviderFailure {
  const status = (error as { status?: unknown })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (typeof status === 'number') {
    // The provider answered: nothing was accepted. Rate limits and server
    // errors can pass; other 4xx (bad address, bad request) will not.
    return { kind: 'rejected', retryable: status === 429 || status >= 500, status, message };
  }
  // Timeout or broken connection: the provider may have accepted it.
  return { kind: 'unknown', message };
}

/** Records how an attempt ended. A rejected attempt returns its provider budget unit. */
export async function completeDelivery(
  db: Firestore,
  input: { deliveryId: string; day: string; now?: number }
    & ({ status: 'accepted'; messageId: string } | { status: 'failed'; retryable: boolean; reason: string } | { status: 'unknown'; reason: string }),
): Promise<void> {
  const now = input.now ?? Date.now();
  const update: Record<string, unknown> = { status: input.status, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() };
  if (input.status === 'accepted') Object.assign(update, { messageId: input.messageId, acceptedAt: FieldValue.serverTimestamp(), reason: null });
  else Object.assign(update, { reason: input.reason.slice(0, 300), ...(input.status === 'failed' ? { retryable: input.retryable } : {}) });

  const batch = db.batch();
  batch.set(db.collection('emailDeliveries').doc(input.deliveryId), update, { merge: true });
  if (input.status === 'failed') {
    batch.set(db.collection('rateLimits').doc(`email_provider_${input.day}`), { count: FieldValue.increment(-1) }, { merge: true });
  }
  await batch.commit();
}

/* ---------------------------- provider events ---------------------------- */

/** Brevo transactional webhook events mapped to delivery outcomes. */
export function mapProviderEvent(event: string): { status: DeliveryStatus; suppress?: 'hard_bounce' | 'complaint' | 'unsubscribed' } | null {
  switch (event) {
    case 'request':
    case 'sent': return { status: 'accepted' };
    case 'deferred':
    case 'soft_bounce': return { status: 'deferred' };
    case 'delivered': return { status: 'delivered' };
    case 'hard_bounce':
    case 'invalid_email':
    case 'invalid': return { status: 'bounced', suppress: 'hard_bounce' };
    case 'blocked':
    case 'error': return { status: 'bounced' };
    case 'spam':
    case 'complaint': return { status: 'suppressed', suppress: 'complaint' };
    case 'unsubscribed': return { status: 'suppressed', suppress: 'unsubscribed' };
    default: return null; // opens, clicks and anything new are ignored
  }
}

const RANK: Record<DeliveryStatus, number> = {
  sending: 0, unknown: 0, failed: 0, accepted: 1, deferred: 2, delivered: 3, bounced: 4, suppressed: 5,
};

/** Provider events can arrive late or twice; a status only ever moves forward. */
export function nextDeliveryStatus(current: DeliveryStatus | undefined, incoming: DeliveryStatus): DeliveryStatus {
  if (!current) return incoming;
  return RANK[incoming] > RANK[current] ? incoming : current;
}

/** What History shows for a certificate's email, from the legacy field and the delivery status. */
export function certificateEmailFields(status: DeliveryStatus): Record<string, unknown> {
  switch (status) {
    case 'accepted':
    case 'deferred':
    case 'delivered': return { deliveryStatus: status };
    case 'bounced':
    case 'suppressed': return { deliveryStatus: status, emailStatus: 'failed', emailError: status === 'bounced' ? 'The recipient’s mail server rejected the message.' : 'The recipient reported or unsubscribed from these emails.' };
    default: return { deliveryStatus: status };
  }
}
