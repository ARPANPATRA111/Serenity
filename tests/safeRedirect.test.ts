import { describe, expect, test } from 'vitest';
import { authPageHref, sanitizeAuthRedirect } from '../src/lib/navigation/safeRedirect';

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

test('a template selection survives signup and the verification notice', () => {
  const template = '/editor?template=bundled-honours';
  const signup = new URL(authPageHref('/signup', template), 'https://serenity.local');
  const login = new URL(authPageHref('/login', signup.searchParams.get('redirect'), true), signup);
  expect(login.searchParams.get('redirect')).toBe(template);
  expect(login.searchParams.get('message')).toBe('verification-sent');
  expect(authPageHref('/signup', null)).toBe('/signup');
  expect(authPageHref('/login', '//external.example')).toBe('/login?redirect=%2Fdashboard');
});
