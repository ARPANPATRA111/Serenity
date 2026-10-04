import { describe, expect, test } from 'vitest';
import { chunk, sanitizeCertificateInput, sanitizeMetadata } from '../src/lib/certificates/record';

const valid = {
  id: 'AbC123xyz_-9',
  templateId: 'template-1',
  templateName: 'Workshop',
  recipientName: 'Asha Rao',
  recipientEmail: ' asha@example.test ',
  title: 'Workshop Participation',
  description: '',
  issuedAt: 1_760_000_000_000,
  issuerName: 'Serenity Demo',
  metadata: { Name: 'Asha Rao', Email: 'asha@example.test' },
  generationBatchId: 'batchAbc12345',
  rowIndex: 0,
  idempotencyKey: 'batchAbc12345:0',
  certificateImage: 'https://store.public.blob.vercel-storage.com/certificates/u/AbC123xyz_-9.jpg',
};

describe('sanitizeCertificateInput', () => {
  test('keeps allowlisted fields and trims the recipient email', () => {
    const result = sanitizeCertificateInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ id: valid.id, recipientEmail: 'asha@example.test', generationBatchId: 'batchAbc12345', rowIndex: 0 });
  });

  test('drops server-owned fields a client might try to set', () => {
    const result = sanitizeCertificateInput({
      ...valid,
      userId: 'someone-else',
      isActive: false,
      viewCount: 99999,
      emailStatus: 'sent',
      createdAt: '1999-01-01T00:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const key of ['userId', 'isActive', 'viewCount', 'emailStatus', 'createdAt']) {
      expect(result.value).not.toHaveProperty(key);
    }
  });

  test('rejects malformed IDs and unapproved image hosts', () => {
    expect(sanitizeCertificateInput({ ...valid, id: 'bad id' }).ok).toBe(false);
    expect(sanitizeCertificateInput({ ...valid, id: undefined }).ok).toBe(false);
    expect(sanitizeCertificateInput({ ...valid, certificateImage: 'https://evil.example/x.png' }).ok).toBe(false);
    expect(sanitizeCertificateInput(null).ok).toBe(false);
  });

  test('fills defaults the history view relies on', () => {
    const result = sanitizeCertificateInput({ id: 'AbC123xyz_-9' }, 1234);
    expect(result.ok && result.value).toMatchObject({
      templateId: 'local',
      title: 'Certificate of Completion',
      issuerName: 'Serenity',
      issuedAt: 1234,
      certificateImage: '',
      metadata: {},
    });
  });

  test('ignores malformed batch IDs and row indexes instead of storing them', () => {
    const result = sanitizeCertificateInput({ ...valid, generationBatchId: '../x', rowIndex: -1 });
    expect(result.ok && result.value).not.toHaveProperty('generationBatchId');
    expect(result.ok && result.value).not.toHaveProperty('rowIndex');
  });
});

describe('sanitizeMetadata', () => {
  test('keeps wide spreadsheets by clipping rather than rejecting', () => {
    const wide = Object.fromEntries(Array.from({ length: 250 }, (_, index) => [`Column ${index}`, 'x'.repeat(5000)]));
    const result = sanitizeMetadata(wide);
    expect(Object.keys(result)).toHaveLength(200);
    expect(String(result['Column 0'])).toHaveLength(2000);
  });

  test('stringifies nested values and drops reserved or empty keys', () => {
    expect(sanitizeMetadata({ nested: { a: 1 }, '': 'empty', __name__: 'reserved', ok: 1, flag: true, none: null }))
      .toEqual({ nested: '{"a":1}', ok: 1, flag: true, none: null });
  });
});

describe('chunk', () => {
  test('splits into bounded consecutive chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });
});
