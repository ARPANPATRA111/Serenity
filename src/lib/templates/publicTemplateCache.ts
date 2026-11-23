import { revalidateTag, unstable_cache } from 'next/cache';
import { queryPublicTemplates, type Template } from '@/lib/firebase/templates';
import { mergeWithCuratedTemplates } from '@/lib/templates/curatedPublicTemplates';

/**
 * The public gallery, read from Firestore at most once an hour (or right
 * after a public template changes) and shared by every server instance.
 *
 * Previously each instance cached it for 60 seconds, keyed on nothing: the
 * dashboard's request for 6 templates filled the cache and the gallery's
 * request for 100 got those 6, and steady traffic re-read up to 100 documents
 * every minute (up to 144K reads a day, nearly three times the free quota).
 */

export const PUBLIC_TEMPLATES_TAG = 'public-templates';
/** Largest list any caller asks for; smaller requests are slices of it. */
export const PUBLIC_TEMPLATES_MAX = 100;
const SHARED_CACHE_SECONDS = 3600;
const INSTANCE_CACHE_MS = 60_000;

/** Public listings never expose owner identity or the design itself. */
export function sanitizePublicTemplate(template: Template, includeCanvasJSON = false): Template {
  const { creatorEmail: _creatorEmail, userId: _userId, canvasJSON, ...safeTemplate } = template;
  return {
    ...safeTemplate,
    canvasJSON: includeCanvasJSON ? canvasJSON : '',
  } as Template;
}

function withCurated(templates: Template[]): Template[] {
  return mergeWithCuratedTemplates(templates.map((template) => sanitizePublicTemplate(template)), PUBLIC_TEMPLATES_MAX)
    .map((template) => sanitizePublicTemplate(template));
}

// Throws on a Firestore failure, so a failure is never cached for an hour.
async function readPublicTemplates(): Promise<Template[]> {
  return withCurated(await queryPublicTemplates(PUBLIC_TEMPLATES_MAX));
}

const sharedPublicTemplates = unstable_cache(readPublicTemplates, ['public-templates', 'v2'], {
  revalidate: SHARED_CACHE_SECONDS,
  tags: [PUBLIC_TEMPLATES_TAG],
});

// A small per-instance layer in front of the shared cache. It also keeps the
// list cached if the shared cache rejects the entry (it caps entries at 2 MB,
// which a gallery of large inline thumbnails could exceed).
let instanceCache: { templates: Template[]; at: number } | null = null;

export async function getCachedPublicTemplates(limit: number): Promise<Template[]> {
  const size = Math.min(Math.max(Math.floor(limit) || 1, 1), PUBLIC_TEMPLATES_MAX);
  if (!instanceCache || Date.now() - instanceCache.at > INSTANCE_CACHE_MS) {
    try {
      instanceCache = { templates: await sharedPublicTemplates(), at: Date.now() };
    } catch (error) {
      // Degrade to the curated designs for this request only (as before).
      console.error('[Public templates] Firestore unavailable; serving curated designs:', error);
      return withCurated([]).slice(0, size);
    }
  }
  return instanceCache.templates.slice(0, size);
}

/** Call after creating, editing, publishing, unpublishing or deleting a public template. */
export function invalidatePublicTemplates(): void {
  instanceCache = null;
  try {
    revalidateTag(PUBLIC_TEMPLATES_TAG);
  } catch {
    // Outside a request (scripts, tests) there is no shared cache to clear.
  }
}

/** Whether a change to this template can change the public gallery. */
export function affectsPublicGallery(...states: Array<Pick<Template, 'isPublic'> | null | undefined | boolean>): boolean {
  return states.some((state) => (typeof state === 'boolean' ? state : state?.isPublic === true));
}
