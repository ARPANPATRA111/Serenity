import type { Template } from '@/lib/firebase/templates';

import { HONOURS_ID, HONOURS_NAME, honoursCanvasJSON, honoursProof } from './honoursDesign';
import { CERTIFICATE_DESIGNS } from './certificateDesigns';
import { toCanvasJSON, toProofDataUri } from './designKit';

/**
 * Templates that ship with Serenity. They live in code, not Firestore, so
 * changing the artwork here never touches stored user data: a template a user
 * already opened was copied into their own account at that point.
 */
const classicTemplates: Template[] = CERTIFICATE_DESIGNS.map((design, index) => ({
  id: design.id,
  name: design.name,
  normalizedName: design.name.toLocaleLowerCase('en-US'),
  canvasJSON: toCanvasJSON(design),
  thumbnail: toProofDataUri(design),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-11-24T00:00:00.000Z',
  certificateCount: 0,
  isPublic: true,
  creatorName: 'Serenity',
  stars: 80 - index * 7,
  tags: [design.category.toLocaleLowerCase('en-US'), 'curated', 'ready to edit'],
  category: design.category,
  certificateMetadata: {
    title: design.name,
    issuedBy: 'Organization Name',
    description: '',
  },
  schemaVersion: 2,
  publicationStatus: 'public',
  publishedAt: '2026-07-01T00:00:00.000Z',
  reviewedAt: '2026-11-24T00:00:00.000Z',
  source: 'serenity_curated',
}));

const honoursTemplate: Template = {
  certificateCount: 0,
  isPublic: true,
  creatorName: 'Serenity',
  schemaVersion: 2,
  publicationStatus: 'public',
  source: 'serenity_curated',
  id: HONOURS_ID,
  name: HONOURS_NAME,
  normalizedName: HONOURS_NAME.toLowerCase(),
  canvasJSON: honoursCanvasJSON,
  thumbnail: honoursProof('Recipient Name'),
  stars: 0,
  category: 'Participation',
  tags: ['hackathon', 'participation', 'curated'],
  certificateMetadata: { title: HONOURS_NAME, issuedBy: '', description: '' },
  createdAt: '2026-11-23T00:00:00.000Z',
  updatedAt: '2026-11-23T00:00:00.000Z',
  publishedAt: '2026-11-23T00:00:00.000Z',
};

export const curatedPublicTemplates = [...classicTemplates, honoursTemplate];

export function getCuratedPublicTemplate(id: string) {
  return curatedPublicTemplates.find((template) => template.id === id) || null;
}

/** Serenity's own designs lead the gallery; published community templates follow. */
export function mergeWithCuratedTemplates(templates: Template[], limit: number) {
  const curatedIds = new Set(curatedPublicTemplates.map((template) => template.id));
  return [
    ...curatedPublicTemplates,
    ...templates.filter((template) => !curatedIds.has(template.id)),
  ].slice(0, limit);
}

export function searchCuratedTemplates(query: string) {
  const normalized = query.trim().toLocaleLowerCase('en-US');
  if (!normalized) return curatedPublicTemplates;
  return curatedPublicTemplates.filter((template) =>
    template.name.toLocaleLowerCase('en-US').includes(normalized)
    || template.category?.toLocaleLowerCase('en-US').includes(normalized)
    || template.tags?.some((tag) => tag.includes(normalized)),
  );
}
