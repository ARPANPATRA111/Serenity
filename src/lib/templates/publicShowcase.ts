import { getPublicTemplates, type Template } from '@/lib/firebase/templates';
import { curatedPublicTemplates } from '@/lib/templates/curatedPublicTemplates';

/**
 * Template data for the public landing gallery.
 *
 * Deliberately narrower than `Template`: the landing page renders a name, a
 * category, and a thumbnail and nothing else. `userId`, `creatorEmail`,
 * `creatorName`, and `canvasJSON` never reach the marketing HTML — a homepage
 * is not the place to surface who authored a template.
 */
export type ShowcaseTemplate = {
  id: string;
  name: string;
  category: string;
  thumbnail: string | null;
  /** `live` came from Firestore; `curated` ships with the app. */
  origin: 'live' | 'curated';
};

export type TemplateShowcase = {
  templates: ShowcaseTemplate[];
  categories: string[];
  liveCount: number;
};

const FALLBACK_CATEGORY = 'Certificate';

/**
 * Templates published before the publication-review fields existed carry
 * `isPublic: true` and nothing else — no `publicationStatus`, no `reviewedAt`,
 * no `category`. Requiring a review marker would hide every real template on
 * the site, so review status ranks rather than excludes: reviewed designs sort
 * first, everything else follows.
 *
 * A template still needs a usable thumbnail to be featured — a card with no
 * preview is worse than one fewer card.
 *
 * Note for operators: this shows the same set the public `/templates` gallery
 * already lists. If community publishing is opened up, enable
 * `PUBLIC_TEMPLATE_PUBLISHING_V2` so `reviewedAt` becomes meaningful and this
 * list can be tightened back to reviewed-only.
 */
function reviewRank(template: Template): number {
  if (template.source === 'serenity_curated') return 0;
  if (template.publicationStatus === 'public' && template.reviewedAt) return 1;
  return 2;
}

function toShowcase(template: Template, origin: 'live' | 'curated'): ShowcaseTemplate {
  const thumbnail = typeof template.thumbnail === 'string' ? template.thumbnail.trim() : '';

  return {
    id: template.id,
    name: template.name,
    category: template.category?.trim() || FALLBACK_CATEGORY,
    // Only inline data URIs and absolute https URLs are rendered; anything
    // else (a relative path, a javascript: value) is dropped rather than
    // written into an <img src>.
    thumbnail:
      thumbnail.startsWith('data:image/') || thumbnail.startsWith('https://') ? thumbnail : null,
    origin,
  };
}

/**
 * Reads the real public templates from Firestore and tops the list up with the
 * curated designs.
 *
 * Every failure mode — Firebase Admin not configured, missing index, network
 * error — degrades to the curated set instead of throwing, because this runs
 * during `next build`, where the placeholder configuration has no backend at
 * all.
 */
export async function getTemplateShowcase(limit = 6): Promise<TemplateShowcase> {
  let live: ShowcaseTemplate[] = [];

  try {
    const fetched = await getPublicTemplates(Math.max(limit * 3, 24));
    live = fetched
      .slice()
      .sort((a, b) => reviewRank(a) - reviewRank(b))
      .map((template) => toShowcase(template, 'live'))
      .filter((template) => template.thumbnail !== null);
  } catch {
    // Expected whenever the build or a test runs without Admin credentials.
    live = [];
  }

  const seen = new Set(live.map((template) => template.id));
  const curated = curatedPublicTemplates
    .filter((template) => !seen.has(template.id))
    .map((template) => toShowcase(template, 'curated'));

  const templates = [...live, ...curated].slice(0, limit);

  const categories = Array.from(
    new Set(templates.map((template) => template.category)),
  ).sort((a, b) => a.localeCompare(b));

  return {
    templates,
    categories,
    liveCount: templates.filter((template) => template.origin === 'live').length,
  };
}
