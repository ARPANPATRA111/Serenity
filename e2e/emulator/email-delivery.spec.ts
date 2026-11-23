import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { admin, ensureUser, idTokenFor, readOutbox } from './helpers';

/**
 * Work package 5, against the local JSON outbox (nothing leaves the machine):
 * duplicate clicks and retries never send twice, budgets hold under
 * concurrency, suppressed addresses are not mailed, provider events move a
 * delivery forward only, and messages carry a plain-text part and Reply-To.
 */

const USER = { uid: 'email-delivery-user', email: 'email-delivery@example.test' };
const WEBHOOK_SECRET = 'local-webhook-secret';
const today = () => new Date().toISOString().slice(0, 10);

async function resetState() {
  const { db } = admin();
  for (const collection of ['certificates', 'emailDeliveries']) {
    const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
    await Promise.all(owned.docs.map((document) => document.ref.delete()));
  }
  const suppressions = await db.collection('emailSuppressions').get();
  await Promise.all(suppressions.docs.map((document) => document.ref.delete()));
  await db.collection('rateLimits').doc(`email_${USER.uid}_${today()}`).delete();
  await db.collection('rateLimits').doc(`email_provider_${today()}`).delete();
  await ensureUser(USER.uid, USER.email);
}

async function createCertificate(id: string) {
  await admin().db.collection('certificates').doc(id).set({
    id, userId: USER.uid, recipientName: 'Ada Lovelace', recipientEmail: 'ada@example.test', title: 'Delivery Check',
    issuerName: 'Serenity QA', issuedAt: new Date().toISOString(), createdAt: new Date().toISOString(), isActive: true,
    viewCount: 0, emailStatus: 'not_sent',
  });
}

function sender(baseURL: string, token: string) {
  return (certificateId: string, to: string, idempotencyKey?: string) => fetch(`${baseURL}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, recipientName: 'Ada Lovelace', certificateId, certificateTitle: 'Delivery Check', issuerName: 'Serenity QA', ...(idempotencyKey ? { idempotencyKey } : {}) }),
  }).then(async (response) => ({ status: response.status, body: await response.json() }));
}

const outboxFor = (address: string) => readOutbox().filter((message) => message.to.some((recipient) => recipient.email === address));

test.describe('email delivery', () => {
  test.beforeEach(resetState);
  test.afterAll(async () => {
    // The provider budget is shared by every account; leave it clean.
    await admin().db.collection('rateLimits').doc(`email_provider_${today()}`).delete();
  });

  test('duplicate clicks and retries of one send deliver exactly once; a corrected address sends again', async ({ baseURL }) => {
    await createCertificate('DeliveryOnce1');
    const send = sender(baseURL!, await idTokenFor(USER.email));
    const address = `once-${Date.now()}@example.test`;

    const concurrent = await Promise.all([1, 2, 3].map(() => send('DeliveryOnce1', address, 'batch:b1:DeliveryOnce1')));
    expect(concurrent.filter((result) => result.status === 200 && !result.body.duplicate)).toHaveLength(1);
    for (const result of concurrent.filter((entry) => entry.status !== 200 || entry.body.duplicate)) {
      expect(result.body.duplicate === true || result.body.code === 'DELIVERY_IN_PROGRESS').toBe(true);
    }
    const retry = await send('DeliveryOnce1', address, 'batch:b1:DeliveryOnce1');
    expect(retry).toMatchObject({ status: 200, body: { success: true, duplicate: true } });
    expect(outboxFor(address)).toHaveLength(1);

    // The message: configured sender, Reply-To, plain text with the link.
    const [message] = outboxFor(address) as Array<Record<string, any>>;
    expect(message.from.email).toBe('certificates@example.test');
    expect(message.replyTo.email).toBe('support@example.test');
    expect(message.text).toContain('/verify/DeliveryOnce1');
    expect(message.headers['X-Mailin-custom']).toMatch(/^serenity-delivery:[a-f0-9]{40}$/);

    const corrected = `corrected-${Date.now()}@example.test`;
    expect((await send('DeliveryOnce1', corrected, 'resend:r1')).status).toBe(200);
    expect(outboxFor(corrected)).toHaveLength(1);
    const certificate = await admin().db.collection('certificates').doc('DeliveryOnce1').get();
    expect(certificate.data()).toMatchObject({ emailStatus: 'sent', deliveryStatus: 'accepted', recipientEmail: corrected });
  });

  test('the daily allowance and the shared provider budget hold under concurrent sends', async ({ baseURL }) => {
    const send = sender(baseURL!, await idTokenFor(USER.email));
    for (let index = 0; index < 6; index += 1) await createCertificate(`DeliveryBudget${index}`);
    const { db } = admin();

    // Learn the configured allowance, then leave room for exactly two more.
    const first = await send('DeliveryBudget0', `budget-0-${Date.now()}@example.test`, 'k0');
    expect(first.status).toBe(200);
    const limit = 1 + first.body.remaining;
    await db.collection('rateLimits').doc(`email_${USER.uid}_${today()}`).set({ count: limit - 2 }, { merge: true });
    const burst = await Promise.all([1, 2, 3, 4, 5].map((index) => send(`DeliveryBudget${index}`, `budget-${index}-${Date.now()}@example.test`, `k${index}`)));
    expect(burst.filter((result) => result.status === 200)).toHaveLength(2);
    expect(burst.filter((result) => result.body.code === 'RATE_LIMIT_EXCEEDED')).toHaveLength(3);

    // Provider budget, shared by all accounts.
    await db.collection('rateLimits').doc(`email_${USER.uid}_${today()}`).delete();
    // EMAIL_PROVIDER_DAILY_LIMIT is not set locally, so the default 300 applies.
    await db.collection('rateLimits').doc(`email_provider_${today()}`).set({ count: 299 }, { merge: true });
    const providerBurst = await Promise.all([1, 2, 3].map((index) => send(`DeliveryBudget${index}`, `provider-${index}-${Date.now()}@example.test`, `p${index}`)));
    expect(providerBurst.filter((result) => result.status === 200)).toHaveLength(1);
    expect(providerBurst.filter((result) => result.body.code === 'PROVIDER_DAILY_LIMIT')).toHaveLength(2);
  });

  test('provider events move a delivery forward only, and a hard bounce stops further mail to that address', async ({ baseURL, request }) => {
    await createCertificate('DeliveryEvents1');
    await createCertificate('DeliveryEvents2');
    const send = sender(baseURL!, await idTokenFor(USER.email));
    const bouncing = `bounce-${Date.now()}@example.test`;
    const sent = await send('DeliveryEvents1', `events-${Date.now()}@example.test`, 'e1');
    const bounced = await send('DeliveryEvents2', bouncing, 'e2');
    const post = (events: unknown, token = WEBHOOK_SECRET) => request.post('/api/email/events', {
      headers: { Authorization: `Bearer ${token}` }, data: events,
    });

    expect((await post({ event: 'delivered' }, 'wrong-secret')).status()).toBe(401);
    const delivered = { event: 'delivered', 'X-Mailin-custom': `serenity-delivery:${sent.body.deliveryId}`, ts_event: 1 };
    expect(await (await post(delivered)).json()).toMatchObject({ results: ['applied'] });
    expect(await (await post(delivered)).json()).toMatchObject({ results: ['duplicate'] });
    // A late "request" event does not move it back.
    await post({ event: 'request', 'X-Mailin-custom': `serenity-delivery:${sent.body.deliveryId}`, ts_event: 0 });
    await post({ event: 'opened', 'X-Mailin-custom': `serenity-delivery:${sent.body.deliveryId}`, ts_event: 2 });
    const first = await admin().db.collection('certificates').doc('DeliveryEvents1').get();
    expect(first.data()).toMatchObject({ emailStatus: 'sent', deliveryStatus: 'delivered' });

    // Matched by message ID when the custom header is missing.
    await post({ event: 'hard_bounce', 'message-id': bounced.body.messageId, email: bouncing, ts_event: 3 });
    const second = await admin().db.collection('certificates').doc('DeliveryEvents2').get();
    expect(second.data()).toMatchObject({ emailStatus: 'failed', deliveryStatus: 'bounced' });
    const hash = createHash('sha256').update(bouncing).digest('hex');
    expect((await admin().db.collection('emailSuppressions').doc(hash).get()).exists).toBe(true);

    const blocked = await send('DeliveryEvents1', bouncing, 'e3');
    expect(blocked).toMatchObject({ status: 422, body: { code: 'RECIPIENT_SUPPRESSED' } });
    expect(outboxFor(bouncing)).toHaveLength(1);
  });

  test('requests without a key keep the old contract: each one is a new attempt', async ({ baseURL }) => {
    await createCertificate('DeliveryLegacy1');
    const send = sender(baseURL!, await idTokenFor(USER.email));
    const address = `legacy-${Date.now()}@example.test`;
    expect((await send('DeliveryLegacy1', address)).body).toMatchObject({ success: true });
    expect((await send('DeliveryLegacy1', address)).body).toMatchObject({ success: true });
    expect(outboxFor(address)).toHaveLength(2);
  });
});
