/**
 * Certificate ID handling shared by the verification page, the search box and
 * the APIs.
 *
 * Every certificate Serenity has issued uses `nanoid(12)`, whose alphabet is
 * exactly `A-Z a-z 0-9 _ -`. The accepted length range is deliberately wider
 * than 12 so IDs from any older or future generator keep verifying.
 *
 * Verification links reach this code after being printed on certificates,
 * scanned from QR codes, and pasted from emails and chat apps. Normalisation
 * repairs the damage those paths cause (surrounding punctuation, whitespace,
 * zero-width characters, percent-encoding, tracking parameters) without ever
 * altering a character that can legitimately appear in an ID.
 */

export const CERTIFICATE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export const ISSUED_CERTIFICATE_ID_LENGTH = 12;

const LEADING_ID_RUN = /^[A-Za-z0-9_-]+/;
const NON_ID_PREFIX = /^[^A-Za-z0-9_-]+/;
const ZERO_WIDTH_CHARACTERS = /[​-‍⁠﻿]/g;

export function isValidCertificateId(value: unknown): value is string {
  return typeof value === 'string' && CERTIFICATE_ID_PATTERN.test(value);
}

function safeDecode(value: string): string {
  let decoded = value;
  // Links pass through several encoders (mail clients, chat apps, QR
  // scanners). Decode repeatedly but boundedly until the value is stable.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

/**
 * Returns the canonical ID for a raw `/verify/[id]` path segment, or null when
 * the segment cannot be repaired into a well-formed ID.
 *
 * The ID is the first run of ID characters after any leading punctuation, so
 * trailing sentence stops, brackets, quotes, `?utm=` parameters and fragments
 * are all dropped.
 */
export function normalizeCertificateId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const value = safeDecode(raw)
    .replace(ZERO_WIDTH_CHARACTERS, '')
    .trim()
    .replace(NON_ID_PREFIX, '');

  const match = value.match(LEADING_ID_RUN);
  if (!match) return null;
  return isValidCertificateId(match[0]) ? match[0] : null;
}

/**
 * Extracts a certificate ID from free-form input: a bare ID, a full
 * verification URL (any host, with or without scheme, repeated slashes,
 * query parameters, or fragments), or a short line of text that contains one.
 */
export function extractCertificateId(input: unknown): string | null {
  if (typeof input !== 'string') return null;

  const text = safeDecode(input).replace(ZERO_WIDTH_CHARACTERS, '').trim();
  if (!text) return null;

  const marker = text.toLowerCase().lastIndexOf('/verify/');
  if (marker !== -1) {
    const afterMarker = text.slice(marker + '/verify/'.length).split(/\s/)[0];
    return normalizeCertificateId(afterMarker);
  }

  // `verify?id=...` and `?certificateId=...` style links.
  const queryMatch = text.match(/[?&](?:id|certificateId|cert)=([^&#\s]+)/i);
  if (queryMatch) {
    return normalizeCertificateId(queryMatch[1]);
  }

  const tokens = text.split(/\s+/);
  if (tokens.length === 1) return normalizeCertificateId(tokens[0]);

  // Free text such as "Certificate ID: AbC123xyz_-9". Ordinary words are also
  // well-formed IDs, so in a sentence only tokens that look issued count: the
  // issued length, or at least one digit. Prefer the issued length.
  const candidates = tokens
    .map((token) => normalizeCertificateId(token))
    .filter((token): token is string =>
      token !== null && (token.length === ISSUED_CERTIFICATE_ID_LENGTH || /\d/.test(token)));

  const issuedLength = candidates.filter((token) => token.length === ISSUED_CERTIFICATE_ID_LENGTH);
  if (issuedLength.length > 0) return issuedLength[issuedLength.length - 1];
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}
