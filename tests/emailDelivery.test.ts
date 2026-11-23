import { describe, expect, test } from 'vitest';
import {
  certificateEmailFields,
  classifyProviderError,
  deliveryIdFor,
  mapProviderEvent,
  nextDeliveryStatus,
  recipientHash,
} from '../src/lib/email/delivery';

describe('delivery identity', () => {
  const base = { userId: 'uid-a', certificateId: 'Cert01', to: 'Ada@Example.test', idempotencyKey: 'batch:b1:Cert01' };

  test('the same send intent always maps to the same delivery', () => {
    expect(deliveryIdFor(base)).toBe(deliveryIdFor({ ...base, to: ' ada@example.TEST ' }));
    expect(deliveryIdFor(base)).toMatch(/^[a-f0-9]{40}$/);
  });

  test('a corrected address or an explicit resend is a new delivery', () => {
    expect(deliveryIdFor({ ...base, to: 'ada.new@example.test' })).not.toBe(deliveryIdFor(base));
    expect(deliveryIdFor({ ...base, idempotencyKey: 'resend:x1' })).not.toBe(deliveryIdFor(base));
    expect(deliveryIdFor({ ...base, userId: 'uid-b' })).not.toBe(deliveryIdFor(base));
  });

  test('recipients are stored as a hash of the normalised address', () => {
    expect(recipientHash('Ada@Example.test')).toBe(recipientHash('ada@example.test'));
    expect(recipientHash('ada@example.test')).not.toContain('ada');
  });
});

describe('classifyProviderError', () => {
  test('a provider answer means nothing was accepted', () => {
    expect(classifyProviderError(Object.assign(new Error('slow down'), { status: 429 }))).toMatchObject({ kind: 'rejected', retryable: true });
    expect(classifyProviderError(Object.assign(new Error('boom'), { status: 503 }))).toMatchObject({ kind: 'rejected', retryable: true });
    expect(classifyProviderError(Object.assign(new Error('bad address'), { status: 400 }))).toMatchObject({ kind: 'rejected', retryable: false });
  });

  test('no answer (timeout, dropped connection) leaves the outcome unknown', () => {
    expect(classifyProviderError(new DOMException('The operation timed out.', 'TimeoutError'))).toMatchObject({ kind: 'unknown' });
    expect(classifyProviderError(new TypeError('fetch failed'))).toMatchObject({ kind: 'unknown' });
  });
});

describe('provider events', () => {
  test('map to outcomes, and only hard bounces and complaints suppress the address', () => {
    expect(mapProviderEvent('delivered')).toEqual({ status: 'delivered' });
    expect(mapProviderEvent('soft_bounce')).toEqual({ status: 'deferred' });
    expect(mapProviderEvent('hard_bounce')).toEqual({ status: 'bounced', suppress: 'hard_bounce' });
    expect(mapProviderEvent('blocked')).toEqual({ status: 'bounced' });
    expect(mapProviderEvent('spam')).toEqual({ status: 'suppressed', suppress: 'complaint' });
    expect(mapProviderEvent('opened')).toBeNull();
    expect(mapProviderEvent('click')).toBeNull();
  });

  test('a status only moves forward, whatever order events arrive in', () => {
    expect(nextDeliveryStatus('sending', 'accepted')).toBe('accepted');
    expect(nextDeliveryStatus('delivered', 'accepted')).toBe('delivered');
    expect(nextDeliveryStatus('delivered', 'deferred')).toBe('delivered');
    expect(nextDeliveryStatus('deferred', 'delivered')).toBe('delivered');
    expect(nextDeliveryStatus('delivered', 'bounced')).toBe('bounced');
    expect(nextDeliveryStatus(undefined, 'delivered')).toBe('delivered');
  });

  test('History keeps reading emailStatus; a bounce turns it to failed', () => {
    expect(certificateEmailFields('delivered')).toEqual({ deliveryStatus: 'delivered' });
    expect(certificateEmailFields('bounced')).toMatchObject({ deliveryStatus: 'bounced', emailStatus: 'failed' });
    expect(certificateEmailFields('suppressed')).toMatchObject({ emailStatus: 'failed' });
  });
});
