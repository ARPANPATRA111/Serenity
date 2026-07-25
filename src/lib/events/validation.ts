import type { EventInput, EventLink } from '@/types/events';

const EVENT_TYPES = new Set([
  'Hackathon',
  'Workshop',
  'Course',
  'Conference',
  'Competition',
  'Training',
  'Webinar',
  'Community',
  'Corporate',
  'Other',
]);

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function optionalUrl(value: unknown): string | undefined {
  const normalized = optionalText(value, 2_000);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => optionalText(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maxItems);
}

function imageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(optionalUrl)
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 12);
}

function links(value: unknown): EventLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>;
    const label = optionalText(candidate.label, 80);
    const url = optionalUrl(candidate.url);
    return label && url ? [{ label, url }] : [];
  }).slice(0, 10);
}

function optionalDate(value: unknown): string | undefined {
  const normalized = optionalText(value, 80);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseEventInput(value: unknown): { event?: EventInput; error?: string } {
  if (!value || typeof value !== 'object') return { error: 'Event details are required.' };
  const body = value as Record<string, unknown>;
  const name = optionalText(body.name, 140);
  if (!name) return { error: 'Event name is required.' };

  const requestedType = optionalText(body.type, 50) || 'Other';
  const type = EVENT_TYPES.has(requestedType) ? requestedType : 'Other';
  const startAt = optionalDate(body.startAt);
  const endAt = optionalDate(body.endAt);
  if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
    return { error: 'Event end time cannot be before its start time.' };
  }

  return {
    event: {
      name,
      type,
      description: optionalText(body.description, 2_000),
      organizerName: optionalText(body.organizerName, 140),
      startAt,
      endAt,
      timezone: optionalText(body.timezone, 80),
      venueName: optionalText(body.venueName, 180),
      address: optionalText(body.address, 300),
      city: optionalText(body.city, 100),
      country: optionalText(body.country, 100),
      websiteUrl: optionalUrl(body.websiteUrl),
      registrationUrl: optionalUrl(body.registrationUrl),
      coverImageUrl: optionalUrl(body.coverImageUrl),
      galleryImageUrls: imageUrls(body.galleryImageUrls),
      links: links(body.links),
      tags: stringList(body.tags, 12, 50),
    },
  };
}
