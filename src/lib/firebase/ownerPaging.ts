import { FieldPath, Timestamp } from 'firebase-admin/firestore';

/**
 * Cursor paging for an owner's documents ordered newest first by one date
 * field. Releases stored dates as ISO strings, Timestamps or epoch numbers;
 * the cursor records which, so the next page starts from a value of the same
 * type and no record is skipped. Firestore orders mixed types by type first,
 * so every record is still reached, only grouped by how its date was stored.
 */

interface OwnerCursor {
  id: string;
  kind: 'string' | 'timestamp' | 'number' | 'missing';
  value: string | number | null;
}

export function encodeOwnerCursor(document: FirebaseFirestore.QueryDocumentSnapshot, field: string): string {
  const raw = document.get(field);
  let cursor: OwnerCursor;
  if (raw?.toMillis instanceof Function) cursor = { id: document.id, kind: 'timestamp', value: raw.toMillis() };
  else if (typeof raw === 'number') cursor = { id: document.id, kind: 'number', value: raw };
  else if (typeof raw === 'string') cursor = { id: document.id, kind: 'string', value: raw };
  else cursor = { id: document.id, kind: 'missing', value: null };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeOwnerCursor(value: string): { id: string; value: unknown } | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<OwnerCursor>;
    if (typeof parsed.id !== 'string' || !parsed.id || parsed.id.includes('/')) return null;
    switch (parsed.kind) {
      case 'timestamp': return typeof parsed.value === 'number' ? { id: parsed.id, value: Timestamp.fromMillis(parsed.value) } : null;
      case 'number': return typeof parsed.value === 'number' ? { id: parsed.id, value: parsed.value } : null;
      case 'string': return typeof parsed.value === 'string' ? { id: parsed.id, value: parsed.value } : null;
      default: return null;
    }
  } catch {
    return null;
  }
}

export interface OwnerPage {
  docs: FirebaseFirestore.QueryDocumentSnapshot[];
  nextCursor: string | null;
}

/** One page of `collection` for `userId`, newest `field` first. */
export async function getOwnerPage(
  db: FirebaseFirestore.Firestore,
  collection: string,
  userId: string,
  options: { field: string; limit: number; cursor?: string | null; select?: string[] },
): Promise<OwnerPage> {
  let query: FirebaseFirestore.Query = db.collection(collection)
    .where('userId', '==', userId)
    .orderBy(options.field, 'desc')
    .orderBy(FieldPath.documentId(), 'desc');
  if (options.select?.length) query = query.select(...options.select, options.field);

  if (options.cursor) {
    const cursor = decodeOwnerCursor(options.cursor);
    if (!cursor) throw Object.assign(new Error('Invalid cursor'), { code: 'INVALID_CURSOR' });
    query = query.startAfter(cursor.value, cursor.id);
  }

  const snapshot = await query.limit(options.limit + 1).get();
  const docs = snapshot.docs.slice(0, options.limit);
  const nextCursor = snapshot.docs.length > options.limit && docs.length > 0
    ? encodeOwnerCursor(docs[docs.length - 1], options.field)
    : null;
  return { docs, nextCursor };
}

/** True for Firestore's "index not ready" error. */
export function isMissingIndexError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === 9 || code === 'failed-precondition';
}
