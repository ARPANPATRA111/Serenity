import { describe, expect, test } from 'vitest';
import { toIsoDate } from '../src/lib/dates';

describe('toIsoDate', () => {
  test('normalizes Firestore-like timestamps, strings, and epoch numbers', () => {
    expect(toIsoDate({ toDate: () => new Date('2026-01-02T03:04:05.000Z') }))
      .toBe('2026-01-02T03:04:05.000Z');
    expect(toIsoDate('2025-02-03T04:05:06Z')).toBe('2025-02-03T04:05:06.000Z');
    expect(toIsoDate(0)).toBe('1970-01-01T00:00:00.000Z');
  });

  test('uses a stable fallback for missing or malformed legacy values', () => {
    expect(toIsoDate(undefined)).toBe('1970-01-01T00:00:00.000Z');
    expect(toIsoDate('not-a-date', 'fallback')).toBe('fallback');
  });
});
