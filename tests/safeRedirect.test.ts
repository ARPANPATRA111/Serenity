import { describe, expect, test } from 'vitest';
import { sanitizeAuthRedirect } from '../src/lib/navigation/safeRedirect';

describe('sanitizeAuthRedirect', () => {
  test.each([
    null,
    '',
    'https://attacker.example/steal',
    '//attacker.example/steal',
    '/\\attacker.example/steal',
    '/verify/public-id',
  ])('rejects unsafe or non-application target %s', (target) => {
    expect(sanitizeAuthRedirect(target)).toBe('/dashboard');
  });

  test('preserves allowed internal route details', () => {
    expect(sanitizeAuthRedirect('/editor?template=abc#canvas')).toBe('/editor?template=abc#canvas');
  });
});
