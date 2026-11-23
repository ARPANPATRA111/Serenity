import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { createLogger } from '@/lib/logger';
import {
  certificateEmailFields,
  mapProviderEvent,
  nextDeliveryStatus,
  recipientHash,
  type DeliveryStatus,
} from '@/lib/email/delivery';

const logger = createLogger('Email.Events');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Delivery events from the email provider (Brevo transactional webhooks).
 *
 * Off unless EMAIL_WEBHOOK_SECRET is set; the provider must then send it as
 * `Authorization: Bearer <secret>` (or `?token=<secret>`). Each event moves a
 * delivery forward only (late or repeated events change nothing), updates
 * the certificate's delivery status for History, and puts addresses that
 * hard-bounced or complained on a suppression list (stored as a hash) so they
 * are not mailed again. Opens and clicks are ignored.
 */

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : new URL(request.url).searchParams.get('token') || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface ProviderEvent {
  event?: unknown;
  email?: unknown;
  'message-id'?: unknown;
  'X-Mailin-custom'?: unknown;
  'x-mailin-custom'?: unknown;
  ts_event?: unknown;
  date?: unknown;
}

const CUSTOM_PREFIX = 'serenity-delivery:';

async function applyEvent(payload: ProviderEvent): Promise<'applied' | 'ignored' | 'duplicate' | 'unmatched'> {
  const name = typeof payload.event === 'string' ? payload.event : '';
  const mapped = mapProviderEvent(name);
  if (!mapped) return 'ignored';

  const db = getAdminFirestore();
  const messageId = typeof payload['message-id'] === 'string' ? payload['message-id'] : '';
  const custom = String(payload['X-Mailin-custom'] ?? payload['x-mailin-custom'] ?? '');
  let deliveryId = custom.startsWith(CUSTOM_PREFIX) ? custom.slice(CUSTOM_PREFIX.length).replace(/[^a-f0-9]/g, '') : '';
  if (!deliveryId && messageId) {
    const match = await db.collection('emailDeliveries').where('messageId', '==', messageId).limit(1).get();
    deliveryId = match.docs[0]?.id || '';
  }
  if (!deliveryId) return 'unmatched';

  const eventId = createHash('sha256')
    .update([deliveryId, name, String(payload.ts_event ?? payload.date ?? ''), messageId].join('|'))
    .digest('hex').slice(0, 40);

  return db.runTransaction(async (transaction) => {
    const eventRef = db.collection('emailDeliveryEvents').doc(eventId);
    const deliveryRef = db.collection('emailDeliveries').doc(deliveryId);
    const [seen, delivery] = await Promise.all([transaction.get(eventRef), transaction.get(deliveryRef)]);
    if (seen.exists) return 'duplicate' as const;
    if (!delivery.exists) return 'unmatched' as const;

    const current = delivery.get('status') as DeliveryStatus | undefined;
    const next = nextDeliveryStatus(current, mapped.status);
    transaction.create(eventRef, { deliveryId, event: name, receivedAt: FieldValue.serverTimestamp() });
    if (next !== current) {
      transaction.update(deliveryRef, { status: next, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), lastEvent: name });
      const certificateId = delivery.get('certificateId');
      if (typeof certificateId === 'string' && certificateId) {
        transaction.set(db.collection('certificates').doc(certificateId), certificateEmailFields(next), { merge: true });
      }
    }
    if (mapped.suppress && typeof payload.email === 'string' && payload.email.includes('@')) {
      transaction.set(db.collection('emailSuppressions').doc(recipientHash(payload.email)), {
        reason: mapped.suppress, createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return 'applied' as const;
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  if (!authorized(request, secret)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const events: ProviderEvent[] = Array.isArray(body) ? body : body && typeof body === 'object' ? [body] : [];
  if (events.length === 0 || events.length > 100) {
    return NextResponse.json({ success: false, error: 'Expected 1 to 100 events' }, { status: 400 });
  }

  const results: string[] = [];
  for (const event of events) {
    try {
      results.push(await applyEvent(event));
    } catch (error) {
      logger.warn('Delivery event not applied', { event: String(event.event ?? '') }, error as Error);
      results.push('error');
    }
  }
  // 200 for everything understood, so the provider does not retry forever;
  // a 500 asks it to retry events that hit a transient error.
  const status = results.includes('error') ? 500 : 200;
  return NextResponse.json({ success: status === 200, results }, { status });
}
