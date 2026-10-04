import { isValidCertificateId } from '@/lib/verification/certificateId';
import { isSafeCertificateMediaUrl } from '@/lib/security/mediaUrl';

/**
 * Validation and normalisation for certificate records submitted by the
 * generator. Only allowlisted fields reach Firestore; server-owned fields
 * (owner, revocation state, view count, timestamps, delivery status) are never
 * taken from the request.
 */

/** Largest batch accepted in one request. The generator sends 100 at a time. */
export const MAX_CERTIFICATES_PER_REQUEST = 200;

const LIMITS = {
  shortText: 300,
  templateId: 128,
  description: 2_000,
  email: 320,
  idempotencyKey: 200,
  metadataKeys: 200,
  metadataValue: 2_000,
} as const;

const BATCH_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export interface CertificateInput {
  id: string;
  templateId: string;
  templateName: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  description: string;
  eventId?: string;
  issuedAt: number;
  issuerName: string;
  metadata: Record<string, string | number | boolean | null>;
  generationBatchId?: string;
  rowIndex?: number;
  idempotencyKey?: string;
  certificateImage: string;
}

export type SanitizeResult =
  | { ok: true; value: CertificateInput }
  | { ok: false; error: string };

function clip(value: unknown, max: number, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const text = typeof value === 'string' ? value : String(value);
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Spreadsheet rows are stored so issuers can see what each certificate was
 * generated from. Oversized or nested values are clipped or stringified, never
 * rejected, so a wide spreadsheet can always be saved.
 */
export function sanitizeMetadata(raw: unknown): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, LIMITS.metadataKeys)) {
    // Firestore rejects empty field names and treats `__x__` names as reserved.
    const safeKey = clip(key, 200).trim();
    if (!safeKey || /^__.*__$/.test(safeKey)) continue;
    if (value === null || typeof value === 'boolean') {
      output[safeKey] = value;
    } else if (typeof value === 'number') {
      output[safeKey] = Number.isFinite(value) ? value : String(value);
    } else if (typeof value === 'string') {
      output[safeKey] = clip(value, LIMITS.metadataValue);
    } else if (value !== undefined) {
      output[safeKey] = clip(JSON.stringify(value), LIMITS.metadataValue);
    }
  }
  return output;
}

export function sanitizeCertificateInput(raw: unknown, now = Date.now()): SanitizeResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Each certificate must be an object' };
  const input = raw as Record<string, unknown>;

  if (!isValidCertificateId(input.id)) {
    return { ok: false, error: 'Each certificate must include a valid id' };
  }

  const certificateImage = typeof input.certificateImage === 'string' ? input.certificateImage : '';
  if (certificateImage && !isSafeCertificateMediaUrl(certificateImage)) {
    return { ok: false, error: 'Certificate image URL is not from an approved media host' };
  }

  const issuedAt = typeof input.issuedAt === 'number' && Number.isFinite(input.issuedAt) && input.issuedAt > 0
    ? input.issuedAt
    : now;

  const rowIndex = typeof input.rowIndex === 'number' && Number.isInteger(input.rowIndex) && input.rowIndex >= 0
    ? input.rowIndex
    : undefined;

  const generationBatchId = typeof input.generationBatchId === 'string' && BATCH_ID_PATTERN.test(input.generationBatchId)
    ? input.generationBatchId
    : undefined;

  const eventId = typeof input.eventId === 'string' && input.eventId.trim()
    ? clip(input.eventId.trim(), LIMITS.templateId)
    : undefined;

  return {
    ok: true,
    value: {
      id: input.id,
      templateId: clip(input.templateId, LIMITS.templateId, 'local') || 'local',
      templateName: clip(input.templateName, LIMITS.shortText),
      recipientName: clip(input.recipientName, LIMITS.shortText),
      recipientEmail: clip(input.recipientEmail, LIMITS.email).trim(),
      title: clip(input.title, LIMITS.shortText, 'Certificate of Completion') || 'Certificate of Completion',
      description: clip(input.description, LIMITS.description),
      ...(eventId ? { eventId } : {}),
      issuedAt,
      issuerName: clip(input.issuerName, LIMITS.shortText, 'Serenity') || 'Serenity',
      metadata: sanitizeMetadata(input.metadata),
      ...(generationBatchId ? { generationBatchId } : {}),
      ...(rowIndex !== undefined ? { rowIndex } : {}),
      ...(typeof input.idempotencyKey === 'string' ? { idempotencyKey: clip(input.idempotencyKey, LIMITS.idempotencyKey) } : {}),
      certificateImage,
    },
  };
}

/** Splits a list into consecutive chunks of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('Chunk size must be at least 1');
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
