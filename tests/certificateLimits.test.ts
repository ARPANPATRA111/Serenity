import { describe, expect, test } from 'vitest';
import {
  FREE_CERTIFICATE_LIMIT,
  getCertificateAllowance,
} from '../src/lib/plans/certificateLimits';

describe('certificate plan limits', () => {
  test('free users stop after five persisted certificates', () => {
    expect(FREE_CERTIFICATE_LIMIT).toBe(5);
    expect(getCertificateAllowance(false, 4)).toEqual({ limit: 5, canGenerate: true, remaining: 1 });
    expect(getCertificateAllowance(false, 5)).toEqual({ limit: 5, canGenerate: false, remaining: 0 });
    expect(getCertificateAllowance(false, 8)).toEqual({ limit: 5, canGenerate: false, remaining: 0 });
  });

  test('premium entitlement has a higher unbounded persisted allowance', () => {
    expect(getCertificateAllowance(true, 50_000)).toEqual({ limit: null, canGenerate: true, remaining: null });
  });
});
