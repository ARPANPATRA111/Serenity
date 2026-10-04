import { describe, expect, test } from 'vitest';
import { isPremiumActive, summarizePremium, toMillis } from '../src/lib/plans/premium';

const NOW = Date.UTC(2026, 8, 30, 12);

describe('isPremiumActive', () => {
  test('keeps every existing premium record premium (no end date)', () => {
    expect(isPremiumActive({ isPremium: true }, NOW)).toBe(true);
    expect(isPremiumActive({ isPremium: true, premiumUntil: null }, NOW)).toBe(true);
  });

  test('honours an end date stored as an ISO string, Timestamp, or number', () => {
    const future = new Date(NOW + 86_400_000).toISOString();
    const past = new Date(NOW - 1).toISOString();
    expect(isPremiumActive({ isPremium: true, premiumUntil: future }, NOW)).toBe(true);
    expect(isPremiumActive({ isPremium: true, premiumUntil: past }, NOW)).toBe(false);
    expect(isPremiumActive({ isPremium: true, premiumUntil: { toMillis: () => NOW + 5 } }, NOW)).toBe(true);
    expect(isPremiumActive({ isPremium: true, premiumUntil: { _seconds: (NOW - 1000) / 1000 } }, NOW)).toBe(false);
    expect(isPremiumActive({ isPremium: true, premiumUntil: NOW + 1 }, NOW)).toBe(true);
  });

  test('only an explicit true grants premium', () => {
    expect(isPremiumActive({ isPremium: 'true' }, NOW)).toBe(false);
    expect(isPremiumActive({ isPremium: false, premiumUntil: new Date(NOW + 1e9).toISOString() }, NOW)).toBe(false);
    expect(isPremiumActive(null, NOW)).toBe(false);
  });

  test('an unparseable end date is treated as no end date rather than revoking', () => {
    expect(isPremiumActive({ isPremium: true, premiumUntil: 'not a date' }, NOW)).toBe(true);
  });
});

describe('summarizePremium', () => {
  test('reports lapsed plans as expired', () => {
    const summary = summarizePremium({ isPremium: true, premiumUntil: new Date(NOW - 1000).toISOString(), premiumSource: 'console' }, NOW);
    expect(summary).toEqual({ active: false, until: new Date(NOW - 1000).toISOString(), expired: true, source: 'console' });
  });

  test('toMillis rejects values it cannot interpret', () => {
    expect(toMillis('')).toBeNull();
    expect(toMillis({})).toBeNull();
    expect(toMillis(Number.NaN)).toBeNull();
  });
});
