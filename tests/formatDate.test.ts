import { describe, expect, it } from 'vitest';
import { formatDate } from '../src/lib/utils';

describe('formatDate', () => {
  it('formats Date, epoch, and ISO inputs', () => {
    expect(formatDate(new Date('2026-07-16T10:00:00Z'), { timeZone: 'UTC' })).toBe('July 16, 2026');
    expect(formatDate('2026-07-16T10:00:00Z', { timeZone: 'UTC' })).toBe('July 16, 2026');
    expect(formatDate(Date.UTC(2026, 6, 16), { timeZone: 'UTC' })).toBe('July 16, 2026');
  });

  it('formats Firestore timestamps that survived a JSON round trip', () => {
    const seconds = Math.floor(Date.UTC(2026, 6, 16) / 1000);

    // Admin SDK shape once serialised through an API response.
    expect(formatDate({ _seconds: seconds, _nanoseconds: 0 }, { timeZone: 'UTC' })).toBe('July 16, 2026');
    // Client SDK shape.
    expect(formatDate({ seconds, nanoseconds: 0 }, { timeZone: 'UTC' })).toBe('July 16, 2026');
    // Live Timestamp instance.
    expect(formatDate({ toDate: () => new Date(seconds * 1000) }, { timeZone: 'UTC' })).toBe('July 16, 2026');
  });

  it('returns the fallback instead of throwing on unusable input', () => {
    // A thrown TypeError here previously took the whole template gallery down.
    expect(formatDate(undefined)).toBe('Unknown date');
    expect(formatDate(null)).toBe('Unknown date');
    expect(formatDate({})).toBe('Unknown date');
    expect(formatDate('not a date')).toBe('Unknown date');
    expect(formatDate({ toDate: () => { throw new Error('boom'); } })).toBe('Unknown date');
    expect(formatDate(undefined, undefined, 'â€”')).toBe('â€”');
  });
});
