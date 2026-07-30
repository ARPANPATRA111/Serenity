import { describe, expect, test } from 'vitest';
import { buildVerificationUrl } from '../src/lib/verification/url';

describe('buildVerificationUrl', () => {
  test('uses one normalized environment base for verification links', () => {
    expect(buildVerificationUrl('cert-123', 'https://staging.example.test/app/'))
      .toBe('https://staging.example.test/verify/cert-123');
  });

  test('rejects missing and path-like certificate identifiers', () => {
    expect(() => buildVerificationUrl('', 'https://example.test')).toThrow();
    expect(() => buildVerificationUrl('../other', 'https://example.test')).toThrow();
  });
});
