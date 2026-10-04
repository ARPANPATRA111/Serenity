import { afterEach, describe, expect, test, vi } from 'vitest';
// The operator script hashes; the server verifies. They must stay compatible.
import { hashPassphrase as hashFromScript } from '../scripts/admin/lib/passphrase.mjs';
import { hashPassphrase, passphraseProblems, verifyPassphrase } from '../src/lib/admin/passphrase';
import {
  getAllowedAdminEmails,
  getConfiguredPathKey,
  getSessionMaxAgeMs,
  isAdminConsoleEnabled,
  matchesPathKey,
  sessionCookieName,
} from '../src/lib/admin/config';

// Cheap parameters keep the tests fast; production uses N = 32768.
const FAST = { N: 1024, r: 8, p: 1 };

describe('console passphrase hashing', () => {
  test('a hash written by the operator script verifies on the server', async () => {
    const encoded = await hashFromScript('correct horse battery staple', FAST);
    expect(encoded).toMatch(/^scrypt\$1024\$8\$1\$/);
    expect(await verifyPassphrase('correct horse battery staple', encoded)).toBe(true);
    expect(await verifyPassphrase('correct horse battery stapl', encoded)).toBe(false);
  });

  test('server hashes are salted and verify', async () => {
    const first = await hashPassphrase('another long passphrase', FAST);
    const second = await hashPassphrase('another long passphrase', FAST);
    expect(first).not.toBe(second);
    expect(await verifyPassphrase('another long passphrase', first)).toBe(true);
  });

  test('never throws on malformed input', async () => {
    for (const encoded of ['', 'plain', 'scrypt$1$1$1$$', 'scrypt$99999999$8$1$c2FsdA==$aGFzaA==', 'bcrypt$x', null, 42]) {
      expect(await verifyPassphrase('anything long enough', encoded)).toBe(false);
    }
    expect(await verifyPassphrase('', await hashPassphrase('valid passphrase here', FAST))).toBe(false);
    expect(await verifyPassphrase(undefined, 'scrypt$1024$8$1$c2FsdA==$aGFzaA==')).toBe(false);
  });

  test('rejects weak passphrases before hashing', async () => {
    expect(passphraseProblems('short')).not.toHaveLength(0);
    expect(passphraseProblems('aaaaaaaaaaaaaaaa')).not.toHaveLength(0);
    await expect(hashPassphrase('short', FAST)).rejects.toThrow();
    await expect(hashFromScript('short', FAST)).rejects.toThrow();
  });
});

describe('console configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('is disabled unless explicitly enabled', () => {
    vi.stubEnv('ADMIN_CONSOLE_ENABLED', '');
    expect(isAdminConsoleEnabled()).toBe(false);
    vi.stubEnv('ADMIN_CONSOLE_ENABLED', 'TRUE');
    expect(isAdminConsoleEnabled()).toBe(false);
    vi.stubEnv('ADMIN_CONSOLE_ENABLED', 'true');
    expect(isAdminConsoleEnabled()).toBe(true);
  });

  test('requires a long path key and compares it exactly', () => {
    vi.stubEnv('ADMIN_CONSOLE_PATH_KEY', 'too-short');
    expect(getConfiguredPathKey()).toBeNull();
    expect(matchesPathKey('too-short')).toBe(false);

    vi.stubEnv('ADMIN_CONSOLE_PATH_KEY', 'a-long-random-path-key-123');
    expect(matchesPathKey('a-long-random-path-key-123')).toBe(true);
    expect(matchesPathKey('a-long-random-path-key-12')).toBe(false);
    expect(matchesPathKey('A-LONG-RANDOM-PATH-KEY-123')).toBe(false);
    expect(matchesPathKey(undefined)).toBe(false);
  });

  test('parses the optional operator email allowlist case-insensitively', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Owner@Example.com, second@example.com ,, ');
    expect(getAllowedAdminEmails()).toEqual(['owner@example.com', 'second@example.com']);
  });

  test('bounds the session length', () => {
    vi.stubEnv('ADMIN_SESSION_TTL_MINUTES', '1');
    expect(getSessionMaxAgeMs()).toBe(5 * 60_000);
    vi.stubEnv('ADMIN_SESSION_TTL_MINUTES', '100000');
    expect(getSessionMaxAgeMs()).toBe(8 * 60 * 60_000);
    vi.stubEnv('ADMIN_SESSION_TTL_MINUTES', 'nonsense');
    expect(getSessionMaxAgeMs()).toBe(60 * 60_000);
  });

  test('uses a __Host- cookie over HTTPS', () => {
    expect(sessionCookieName(true)).toBe('__Host-serenity-console');
    expect(sessionCookieName(false)).toBe('serenity-console');
  });
});
