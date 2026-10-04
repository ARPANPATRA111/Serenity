import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Console passphrase hashing (scrypt, as recommended by OWASP for password
 * storage). Only the encoded hash is stored, in a Firestore document that
 * browser clients cannot read. Format:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
 */

const DEFAULT_PARAMS = { N: 32_768, r: 8, p: 1 };
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
export const MIN_PASSPHRASE_LENGTH = 12;

function derive(passphrase: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r bytes.
    scrypt(passphrase.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function passphraseProblems(passphrase: string): string[] {
  const problems: string[] = [];
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) problems.push(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  if (passphrase.length > 1024) problems.push('Use at most 1024 characters.');
  if (/^(.)\1+$/.test(passphrase)) problems.push('Do not repeat a single character.');
  return problems;
}

export async function hashPassphrase(passphrase: string, params = DEFAULT_PARAMS): Promise<string> {
  const problems = passphraseProblems(passphrase);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(passphrase, salt, params.N, params.r, params.p);
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassphrase(passphrase: unknown, encoded: unknown): Promise<boolean> {
  if (typeof passphrase !== 'string' || typeof encoded !== 'string') return false;
  if (passphrase.length === 0 || passphrase.length > 1024) return false;

  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0) || N > 1_048_576) return false;

  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  const actual = await derive(passphrase, salt, N, r, p);
  return timingSafeEqual(actual, expected);
}
