import { getAdminFirestore } from './admin';
import type { EventInput, PublicEventContext, SerenityEvent } from '@/types/events';

const COLLECTION = 'events';

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export function toPublicEventContext(event: SerenityEvent): PublicEventContext {
  const {
    id,
    name,
    type,
    description,
    organizerName,
    startAt,
    endAt,
    timezone,
    venueName,
    address,
    city,
    country,
    websiteUrl,
    registrationUrl,
    coverImageUrl,
    galleryImageUrls,
    links,
    tags,
  } = event;

  return removeUndefined({
    id,
    name,
    type,
    description,
    organizerName,
    startAt,
    endAt,
    timezone,
    venueName,
    address,
    city,
    country,
    websiteUrl,
    registrationUrl,
    coverImageUrl,
    galleryImageUrls,
    links,
    tags,
  });
}

export async function listUserEvents(userId: string, limit = 50): Promise<SerenityEvent[]> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTION)
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs
    .map((document) => document.data() as SerenityEvent)
    .filter((event) => !event.archivedAt);
}

export async function getEvent(id: string): Promise<SerenityEvent | null> {
  const document = await getAdminFirestore().collection(COLLECTION).doc(id).get();
  return document.exists ? document.data() as SerenityEvent : null;
}

export async function createEvent(userId: string, input: EventInput): Promise<SerenityEvent> {
  const db = getAdminFirestore();
  const reference = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const event = removeUndefined({
    ...input,
    id: reference.id,
    userId,
    createdAt: now,
    updatedAt: now,
  }) as SerenityEvent;

  await reference.set(event);
  return event;
}

export async function updateEvent(id: string, input: EventInput): Promise<SerenityEvent | null> {
  const db = getAdminFirestore();
  const reference = db.collection(COLLECTION).doc(id);
  const existing = await reference.get();
  if (!existing.exists) return null;

  await reference.update(removeUndefined({
    ...input,
    updatedAt: new Date().toISOString(),
  }));

  const updated = await reference.get();
  return updated.data() as SerenityEvent;
}

export async function archiveEvent(id: string): Promise<void> {
  await getAdminFirestore().collection(COLLECTION).doc(id).update({
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
