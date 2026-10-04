import type { PublicEventContext } from '@/types/events';
import { toIsoDate } from '@/lib/dates';
import { isSafeCertificateMediaUrl } from '@/lib/security/mediaUrl';
import { isValidCertificateId } from './certificateId';

/**
 * Pure verification logic, independent of Firestore and of Next.js caching so
 * it can be unit tested. `service.ts` wires it to the database.
 */

export interface PublicCertificate {
  id: string;
  certificateId: string;
  recipientName: string;
  title: string;
  issuerName: string;
  /** Always an ISO-8601 string, whatever type the record stored. */
  issuedAt: string;
  description: string | null;
  status: 'active';
  viewCount: number;
  certificateImage: string | null;
  event: PublicEventContext | null;
}

export type UnavailableReason = 'quota' | 'unavailable' | 'config' | 'rate_limited' | 'error';

export type VerificationLookup =
  | { status: 'valid'; certificate: PublicCertificate; stale?: boolean }
  | { status: 'revoked'; certificateId: string; stale?: boolean }
  | { status: 'not_found'; certificateId: string }
  | { status: 'invalid_id' }
  | { status: 'unavailable'; certificateId: string; reason: UnavailableReason };

/** Fields the verification path may read. Everything else stays private. */
export const PUBLIC_CERTIFICATE_FIELDS = [
  'recipientName',
  'title',
  'issuerName',
  'issuedAt',
  'createdAt',
  'description',
  'isActive',
  'viewCount',
  'certificateImage',
  'eventId',
  'userId',
] as const;

export type CertificateFields = Partial<Record<(typeof PUBLIC_CERTIFICATE_FIELDS)[number], unknown>>;

export interface CertificateSource {
  /** Resolves null when the record does not exist; throws on infrastructure errors. */
  fetchCertificate(id: string): Promise<CertificateFields | null>;
  /** Optional linked-event lookup; failures must resolve null, never throw. */
  fetchEventContext?(eventId: string, ownerId: unknown): Promise<PublicEventContext | null>;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/**
 * Only an explicit `false` revokes. Every issued record stored `isActive:
 * true`, but a record that lost the field must keep verifying rather than
 * suddenly reading as revoked.
 */
export function isRevoked(data: CertificateFields): boolean {
  return data.isActive === false;
}

export function toPublicCertificate(
  id: string,
  data: CertificateFields,
  event: PublicEventContext | null = null,
): PublicCertificate {
  const createdAt = toIsoDate(data.createdAt);
  const viewCount = typeof data.viewCount === 'number' && Number.isFinite(data.viewCount)
    ? Math.max(0, Math.floor(data.viewCount))
    : 0;

  return {
    id,
    certificateId: id,
    recipientName: text(data.recipientName, 'Certificate holder'),
    title: text(data.title, 'Certificate'),
    issuerName: text(data.issuerName, 'Serenity'),
    issuedAt: toIsoDate(data.issuedAt, createdAt),
    description: typeof data.description === 'string' && data.description.trim() ? data.description : null,
    status: 'active',
    viewCount,
    certificateImage: isSafeCertificateMediaUrl(data.certificateImage) ? data.certificateImage : null,
    event,
  };
}

/**
 * Maps an infrastructure failure to a user-facing reason. The distinction
 * matters: a verifier must never be told a genuine certificate is invalid
 * because the database was briefly unreachable or out of daily quota.
 */
export function classifyLookupError(error: unknown): UnavailableReason {
  const code = (error as { code?: unknown })?.code;
  const message = String((error as { message?: unknown })?.message || '');

  if (code === 8 || code === 'resource-exhausted' || /RESOURCE_EXHAUSTED|quota/i.test(message)) return 'quota';
  if (code === 14 || code === 4 || code === 'unavailable' || code === 'deadline-exceeded') return 'unavailable';
  if (/credential|private key|project id|FIREBASE_ADMIN|Service account/i.test(message)) return 'config';
  return 'error';
}

export async function lookupCertificate(
  rawId: unknown,
  source: CertificateSource,
): Promise<VerificationLookup> {
  if (!isValidCertificateId(rawId)) return { status: 'invalid_id' };
  const id = rawId;

  let data: CertificateFields | null;
  try {
    data = await source.fetchCertificate(id);
  } catch (error) {
    return { status: 'unavailable', certificateId: id, reason: classifyLookupError(error) };
  }

  if (!data) return { status: 'not_found', certificateId: id };
  if (isRevoked(data)) return { status: 'revoked', certificateId: id };

  let event: PublicEventContext | null = null;
  if (typeof data.eventId === 'string' && data.eventId && source.fetchEventContext) {
    event = await source.fetchEventContext(data.eventId, data.userId).catch(() => null);
  }

  return { status: 'valid', certificate: toPublicCertificate(id, data, event) };
}
