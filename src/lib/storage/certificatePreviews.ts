import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Where new certificate preview images live.
 *
 * Every generated certificate stores one preview image for its verification
 * page. Vercel Blob's Hobby plan includes 2,000 uploads a month and blocks the
 * whole store for 30 days once any limit is exceeded, which would take down
 * every preview and every uploaded logo. Firestore's free tier allows 20,000
 * writes a day and degrades per request instead, so previews are stored there
 * (as small JPEGs, well under the 1 MiB document limit) and served through a
 * public, immutable, CDN-cached route: each preview is read from Firestore only
 * on a CDN miss.
 *
 * Set CERTIFICATE_PREVIEW_STORE=blob to keep using Vercel Blob (e.g. on a paid
 * plan). Previews already issued keep their stored URLs in either mode.
 */

export const PREVIEW_COLLECTION = 'certificatePreviews';
/** Leaves headroom under Firestore's 1 MiB document limit. */
export const MAX_FIRESTORE_PREVIEW_BYTES = 900 * 1024;
export const PREVIEW_ROUTE = '/api/certificates/preview/';

export type PreviewStore = 'firestore' | 'blob';

export function previewStore(): PreviewStore {
  return process.env.CERTIFICATE_PREVIEW_STORE === 'blob' ? 'blob' : 'firestore';
}

export interface StoredPreview {
  userId: string;
  contentType: 'image/jpeg' | 'image/png';
  data: Buffer;
  bytes: number;
  sha256: string;
  createdAt: string;
}

export class PreviewOwnershipError extends Error {
  constructor() {
    super('This certificate preview belongs to another account');
  }
}

/** Public URL of a stored preview. The hash makes the URL immutable per image. */
export function previewUrl(baseUrl: string, certificateId: string, sha256: string): string {
  return `${baseUrl.replace(/\/$/, '')}${PREVIEW_ROUTE}${certificateId}?v=${sha256.slice(0, 12)}`;
}

/**
 * Saves a preview for a certificate the caller owns. The common case is one
 * write and no reads (`create`); a retry for the same certificate by the same
 * account replaces the image, and another account can never overwrite it.
 */
export async function savePreview(
  db: Firestore,
  input: { certificateId: string; userId: string; contentType: StoredPreview['contentType']; data: Buffer },
): Promise<StoredPreview> {
  const reference = db.collection(PREVIEW_COLLECTION).doc(input.certificateId);
  const preview: StoredPreview = {
    userId: input.userId,
    contentType: input.contentType,
    data: input.data,
    bytes: input.data.length,
    sha256: createHash('sha256').update(input.data).digest('hex'),
    createdAt: new Date().toISOString(),
  };

  try {
    await reference.create(preview);
    return preview;
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code !== 6 && code !== 'already-exists') throw error;
  }

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists && existing.get('userId') !== input.userId) throw new PreviewOwnershipError();
    transaction.set(reference, preview);
  });
  return preview;
}

export async function readPreview(db: Firestore, certificateId: string): Promise<StoredPreview | null> {
  const snapshot = await db.collection(PREVIEW_COLLECTION).doc(certificateId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Partial<StoredPreview> & { data?: Buffer | Uint8Array };
  if (!data.data || (data.contentType !== 'image/jpeg' && data.contentType !== 'image/png')) return null;
  const bytes = Buffer.isBuffer(data.data) ? data.data : Buffer.from(data.data);
  return {
    userId: String(data.userId || ''),
    contentType: data.contentType,
    data: bytes,
    bytes: bytes.length,
    sha256: String(data.sha256 || ''),
    createdAt: String(data.createdAt || ''),
  };
}
