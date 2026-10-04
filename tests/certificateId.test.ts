import { describe, expect, test } from 'vitest';
import { extractCertificateId, isValidCertificateId, normalizeCertificateId } from '../src/lib/verification/certificateId';

// Every certificate issued so far used nanoid(12): A-Z a-z 0-9 _ -
const ISSUED = 'AbC123xyz_-9';

describe('isValidCertificateId', () => {
  test('accepts issued nanoid IDs, including ones that start or end with - or _', () => {
    expect(isValidCertificateId(ISSUED)).toBe(true);
    expect(isValidCertificateId('-AbC123xyz_')).toBe(true);
    expect(isValidCertificateId('_bC123xyz_-')).toBe(true);
    expect(isValidCertificateId('LegacyMain01')).toBe(true);
  });

  test('rejects short, long, and malformed values', () => {
    expect(isValidCertificateId('short')).toBe(false);
    expect(isValidCertificateId('a'.repeat(65))).toBe(false);
    expect(isValidCertificateId('has space1')).toBe(false);
    expect(isValidCertificateId('../../etc/passwd')).toBe(false);
    expect(isValidCertificateId(undefined)).toBe(false);
  });
});

describe('normalizeCertificateId', () => {
  test('keeps a clean ID unchanged', () => {
    expect(normalizeCertificateId(ISSUED)).toBe(ISSUED);
  });

  test('repairs damage from emails, chat apps, and QR scanners', () => {
    expect(normalizeCertificateId(`${ISSUED}.`)).toBe(ISSUED);
    expect(normalizeCertificateId(`${ISSUED})`)).toBe(ISSUED);
    expect(normalizeCertificateId(`"${ISSUED}"`)).toBe(ISSUED);
    expect(normalizeCertificateId(`${ISSUED}%20`)).toBe(ISSUED);
    expect(normalizeCertificateId(`%20${ISSUED}`)).toBe(ISSUED);
    expect(normalizeCertificateId(`${ISSUED}​`)).toBe(ISSUED);
    expect(normalizeCertificateId(`​${ISSUED}`)).toBe(ISSUED);
    expect(normalizeCertificateId(`${ISSUED}?utm_source=linkedin`)).toBe(ISSUED);
    expect(normalizeCertificateId(`${ISSUED}#share`)).toBe(ISSUED);
    expect(normalizeCertificateId(encodeURIComponent(encodeURIComponent(`${ISSUED} `)))).toBe(ISSUED);
  });

  test('never alters characters that belong to an ID', () => {
    expect(normalizeCertificateId('-_-AbC123xyz')).toBe('-_-AbC123xyz');
    expect(normalizeCertificateId('AbC123xyz-_-')).toBe('AbC123xyz-_-');
  });

  test('returns null when nothing usable remains', () => {
    expect(normalizeCertificateId('')).toBeNull();
    expect(normalizeCertificateId('...')).toBeNull();
    expect(normalizeCertificateId('abc')).toBeNull();
    expect(normalizeCertificateId(42)).toBeNull();
  });
});

describe('extractCertificateId', () => {
  test('reads IDs from every verification URL shape that has been issued', () => {
    // Origin-based links from early releases, env-based links, and the
    // trailing-slash fallback that produced a double slash.
    expect(extractCertificateId(`https://serenity-three-kappa.vercel.app/verify/${ISSUED}`)).toBe(ISSUED);
    expect(extractCertificateId(`https://serenity-three-kappa.vercel.app//verify/${ISSUED}`)).toBe(ISSUED);
    expect(extractCertificateId(`https://serenity-certificate.vercel.app/verify/${ISSUED}/`)).toBe(ISSUED);
    expect(extractCertificateId(`serenity.app/verify/${ISSUED}?utm_medium=qr`)).toBe(ISSUED);
    expect(extractCertificateId(`http://localhost:3000/VERIFY/${ISSUED}`)).toBe(ISSUED);
  });

  test('reads bare IDs and IDs inside a short line of text', () => {
    expect(extractCertificateId(`  ${ISSUED}  `)).toBe(ISSUED);
    expect(extractCertificateId(`Certificate ID: ${ISSUED}`)).toBe(ISSUED);
    expect(extractCertificateId(`Verify at https://example.test/verify/${ISSUED}. Thanks!`)).toBe(ISSUED);
  });

  test('reads query-string style links', () => {
    expect(extractCertificateId(`https://example.test/verify?id=${ISSUED}`)).toBe(ISSUED);
  });

  test('returns null for input without an ID', () => {
    expect(extractCertificateId('')).toBeNull();
    expect(extractCertificateId('   ')).toBeNull();
    expect(extractCertificateId('https://example.test/verify/')).toBeNull();
    // Ordinary words are well-formed IDs, so a sentence needs an ID-like token.
    expect(extractCertificateId('not a certificate')).toBeNull();
  });

  test('accepts a single typed token even when it has no digits', () => {
    expect(extractCertificateId('abcdefghij')).toBe('abcdefghij');
  });
});
