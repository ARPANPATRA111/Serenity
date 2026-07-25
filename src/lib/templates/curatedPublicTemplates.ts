import type { Template } from '@/lib/firebase/templates';

const definitions = [
  ['academic-course', 'Academic Course Completion', 'Education', '#4f46e5', '#a5b4fc'],
  ['workshop', 'Workshop Participation', 'Workshop', '#0f766e', '#99f6e4'],
  ['training', 'Professional Training', 'Course', '#1d4ed8', '#93c5fd'],
  ['achievement', 'Milestone Achievement', 'Achievement', '#b45309', '#fde68a'],
  ['employee', 'Employee Recognition', 'Corporate', '#be123c', '#fda4af'],
  ['event', 'Event Participation', 'Event', '#7c3aed', '#d8b4fe'],
  ['hackathon', 'Hackathon Completion', 'Participation', '#0369a1', '#7dd3fc'],
  ['minimal', 'Minimal General Certificate', 'Other', '#111827', '#cbd5e1'],
] as const;

function createCanvasJSON(title: string, accent: string) {
  return JSON.stringify({
    version: '5.3.0',
    background: '#ffffff',
    objects: [
      { type: 'rect', left: 20, top: 20, width: 802, height: 555, fill: 'transparent', stroke: accent, strokeWidth: 4 },
      { type: 'rect', left: 31, top: 31, width: 780, height: 533, fill: 'transparent', stroke: accent, strokeWidth: 1, opacity: 0.45 },
      { type: 'textbox', left: 421, top: 112, originX: 'center', originY: 'center', width: 650, text: title.toUpperCase(), fontFamily: 'Montserrat', fontSize: 24, fontWeight: 700, textAlign: 'center', fill: accent },
      { type: 'textbox', left: 421, top: 205, originX: 'center', originY: 'center', width: 540, text: 'PRESENTED TO', fontFamily: 'Inter', fontSize: 12, charSpacing: 240, textAlign: 'center', fill: '#64748b' },
      { type: 'textbox', left: 421, top: 280, originX: 'center', originY: 'center', width: 650, text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontFamily: 'Playfair Display', fontSize: 50, fontWeight: 600, textAlign: 'center', fill: '#111827', editable: false },
      { type: 'textbox', left: 421, top: 370, originX: 'center', originY: 'center', width: 620, text: 'Presented by {{Issuer}} on {{Date}}', fontFamily: 'Inter', fontSize: 16, textAlign: 'center', fill: '#475569' },
      { type: 'textbox', left: 421, top: 540, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, textAlign: 'center', fill: '#64748b', editable: false, visible: true, isVerificationUrl: true, isLocked: true, lockScalingX: true, lockScalingY: true, hasControls: false },
    ],
  });
}

function createThumbnail(title: string, accent: string, soft: string) {
  const safeTitle = title.replace(/[&<>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 842 595"><rect width="842" height="595" fill="#fffdf8"/><rect x="20" y="20" width="802" height="555" rx="2" fill="none" stroke="${accent}" stroke-width="6"/><rect x="34" y="34" width="774" height="527" fill="none" stroke="${soft}" stroke-width="2"/><circle cx="421" cy="112" r="30" fill="${soft}"/><path d="M405 112h32M421 96v32" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><text x="421" y="184" text-anchor="middle" fill="${accent}" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="3">${safeTitle.toUpperCase()}</text><text x="421" y="262" text-anchor="middle" fill="#64748b" font-family="Arial,sans-serif" font-size="12" letter-spacing="5">PRESENTED TO</text><text x="421" y="338" text-anchor="middle" fill="#111827" font-family="Georgia,serif" font-size="48" font-weight="700">Recipient Name</text><line x1="270" y1="369" x2="572" y2="369" stroke="${soft}" stroke-width="3"/><text x="421" y="416" text-anchor="middle" fill="#64748b" font-family="Arial,sans-serif" font-size="15">For dedication, contribution, and successful completion</text><text x="421" y="526" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="9">VERIFICATION URL INCLUDED</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const curatedPublicTemplates: Template[] = definitions.map(
  ([slug, name, category, accent, soft], index) => ({
    id: `bundled-${slug}`,
    name,
    normalizedName: name.toLocaleLowerCase('en-US'),
    canvasJSON: createCanvasJSON(name, accent),
    thumbnail: createThumbnail(name, accent, soft),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    certificateCount: 0,
    isPublic: true,
    creatorName: 'Serenity',
    stars: 80 - index * 7,
    tags: [category.toLocaleLowerCase('en-US'), 'curated', 'ready to edit'],
    category,
    certificateMetadata: {
      title: name,
      issuedBy: 'Organization Name',
      description: '',
    },
    schemaVersion: 2,
    publicationStatus: 'public',
    publishedAt: '2026-07-01T00:00:00.000Z',
    reviewedAt: '2026-07-01T00:00:00.000Z',
    source: 'serenity_curated',
  }),
);

export function getCuratedPublicTemplate(id: string) {
  return curatedPublicTemplates.find((template) => template.id === id) || null;
}

export function mergeWithCuratedTemplates(templates: Template[], limit: number) {
  const existingIds = new Set(templates.map((template) => template.id));
  return [
    ...templates,
    ...curatedPublicTemplates.filter((template) => !existingIds.has(template.id)),
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
