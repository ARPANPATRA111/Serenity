import { randomBytes, scrypt } from 'node:crypto';

/**
 * Produces the same encoded scrypt hash that src/lib/admin/passphrase.ts
 * verifies: scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>.
 * tests/consolePassphrase.test.ts keeps the two implementations in step.
 */
export const MIN_PASSPHRASE_LENGTH = 12;

export function hashPassphrase(passphrase, params = { N: 32768, r: 8, p: 1 }) {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return Promise.reject(new Error(`The passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`));
  }
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(passphrase.normalize('NFKC'), salt, 32, { ...params, maxmem: 256 * params.N * params.r }, (error, key) => {
      if (error) reject(error);
      else resolve(['scrypt', params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$'));
    });
  });
}
