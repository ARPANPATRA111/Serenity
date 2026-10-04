import { describe, expect, test } from 'vitest';
import { formatCount, formatRelative, niceScale } from '../src/components/console/format';
import { qrPixelSize, QR_LOGICAL_SIZE } from '../src/lib/fabric/exportQuality';

describe('niceScale', () => {
  test('uses whole-number ticks for small counts', () => {
    expect(niceScale(0)).toEqual({ top: 1, ticks: [0, 1] });
    expect(niceScale(3)).toEqual({ top: 3, ticks: [0, 1, 2, 3] });
  });

  test('uses 1-2-5 steps for larger counts', () => {
    expect(niceScale(37)).toEqual({ top: 40, ticks: [0, 10, 20, 30, 40] });
    expect(niceScale(1234)).toEqual({ top: 1500, ticks: [0, 500, 1000, 1500] });
  });
});

describe('console formatting', () => {
  test('compacts only large numbers', () => {
    expect(formatCount(1284)).toBe('1,284');
    expect(formatCount(12_900)).toBe('12.9K');
  });

  test('describes relative times', () => {
    const now = Date.UTC(2026, 8, 30, 12);
    expect(formatRelative(null, now)).toBe('never');
    expect(formatRelative(new Date(now - 30_000).toISOString(), now)).toBe('just now');
    expect(formatRelative(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5 min ago');
  });
});

describe('qrPixelSize', () => {
  test('renders the QR at export resolution, never below the logical size', () => {
    expect(qrPixelSize(100, 4.166)).toBe(417);
    expect(qrPixelSize(10, 4.166)).toBe(QR_LOGICAL_SIZE);
    expect(qrPixelSize(5000, 4.166)).toBe(2048);
  });
});
