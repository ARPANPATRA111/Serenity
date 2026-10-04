import { describe, expect, test, vi } from 'vitest';
import {
  classifyLookupError,
  lookupCertificate,
  toPublicCertificate,
  type CertificateFields,
  type CertificateSource,
} from '../src/lib/verification/lookup';

function sourceWith(data: CertificateFields | null, extra: Partial<CertificateSource> = {}): CertificateSource {
  return { fetchCertificate: vi.fn(async () => data), ...extra };
}

const issuedMillis = Date.UTC(2026, 1, 17, 10, 30);

// Shaped exactly as the deployed main branch stored certificates.
const legacyRecord: CertificateFields = {
  recipientName: 'Legacy Recipient',
  title: 'Certificate of Completion',
  issuerName: 'Legacy Organization',
  issuedAt: issuedMillis,
  createdAt: new Date(issuedMillis).toISOString(),
  isActive: true,
  viewCount: 3,
  certificateImage: '',
  userId: 'user-a',
};

describe('lookupCertificate', () => {
  test('verifies a record shaped as deployed releases stored it', async () => {
    const result = await lookupCertificate('LegacyMain01', sourceWith(legacyRecord));
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.certificate).toMatchObject({
      id: 'LegacyMain01',
      certificateId: 'LegacyMain01',
      recipientName: 'Legacy Recipient',
      issuerName: 'Legacy Organization',
      issuedAt: new Date(issuedMillis).toISOString(),
      status: 'active',
      viewCount: 3,
      certificateImage: null,
      event: null,
    });
  });

  test('treats a record missing isActive as valid; only an explicit false revokes', async () => {
    const withoutFlag = { ...legacyRecord };
    delete withoutFlag.isActive;
    expect((await lookupCertificate('LegacyNoFlag1', sourceWith(withoutFlag))).status).toBe('valid');
    expect((await lookupCertificate('Revoked_Cert-01', sourceWith({ ...legacyRecord, isActive: false }))).status).toBe('revoked');
  });

  test('normalizes Timestamp and string issue dates to ISO strings', async () => {
    const timestampLike = { toDate: () => new Date(issuedMillis) };
    const fromTimestamp = await lookupCertificate('AbC123xyz_-9', sourceWith({ ...legacyRecord, issuedAt: timestampLike }));
    const fromMissing = await lookupCertificate('AbC123xyz_-9', sourceWith({ ...legacyRecord, issuedAt: undefined }));
    expect(fromTimestamp.status === 'valid' && fromTimestamp.certificate.issuedAt).toBe(new Date(issuedMillis).toISOString());
    // Falls back to createdAt when no issue date was stored.
    expect(fromMissing.status === 'valid' && fromMissing.certificate.issuedAt).toBe(new Date(issuedMillis).toISOString());
  });

  test('never exposes an image from an unapproved host', async () => {
    const result = await lookupCertificate('AbC123xyz_-9', sourceWith({ ...legacyRecord, certificateImage: 'https://evil.example/pixel.png' }));
    expect(result.status === 'valid' && result.certificate.certificateImage).toBeNull();

    const blob = 'https://store.public.blob.vercel-storage.com/certificates/u/AbC123xyz_-9.png';
    const approved = await lookupCertificate('AbC123xyz_-9', sourceWith({ ...legacyRecord, certificateImage: blob }));
    expect(approved.status === 'valid' && approved.certificate.certificateImage).toBe(blob);
  });

  test('reports not_found and invalid_id without touching the database for bad IDs', async () => {
    const source = sourceWith(null);
    expect((await lookupCertificate('AbC123xyz_-9', source)).status).toBe('not_found');
    expect((await lookupCertificate('bad id', source)).status).toBe('invalid_id');
    expect(source.fetchCertificate).toHaveBeenCalledTimes(1);
  });

  test('turns database failures into "unavailable", never into "invalid"', async () => {
    const quota = Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
    const result = await lookupCertificate('AbC123xyz_-9', { fetchCertificate: async () => { throw quota; } });
    expect(result).toEqual({ status: 'unavailable', certificateId: 'AbC123xyz_-9', reason: 'quota' });
  });

  test('a failing linked-event lookup does not fail verification', async () => {
    const result = await lookupCertificate('AbC123xyz_-9', sourceWith({ ...legacyRecord, eventId: 'event-a' }, {
      fetchEventContext: async () => { throw new Error('events unavailable'); },
    }));
    expect(result.status === 'valid' && result.certificate.event).toBeNull();
  });
});

describe('classifyLookupError', () => {
  test('distinguishes quota, availability, configuration, and unknown failures', () => {
    expect(classifyLookupError({ code: 8 })).toBe('quota');
    expect(classifyLookupError(new Error('Quota exceeded'))).toBe('quota');
    expect(classifyLookupError({ code: 14 })).toBe('unavailable');
    expect(classifyLookupError({ code: 4 })).toBe('unavailable');
    expect(classifyLookupError(new Error('Failed to parse private key'))).toBe('config');
    expect(classifyLookupError(new Error('boom'))).toBe('error');
  });
});

describe('toPublicCertificate', () => {
  test('fills safe defaults and clamps view counts', () => {
    const certificate = toPublicCertificate('AbC123xyz_-9', { viewCount: -4 });
    expect(certificate).toMatchObject({ recipientName: 'Certificate holder', title: 'Certificate', issuerName: 'Serenity', viewCount: 0 });
  });
});
