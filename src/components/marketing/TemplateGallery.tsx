'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ShowcaseTemplate } from '@/lib/templates/publicShowcase';

/**
 * Public template gallery.
 *
 * The templates are the real published ones read from Firestore on the server,
 * topped up with the curated designs that ship with Serenity. Only a name, a
 * category, and a thumbnail cross the boundary — see `publicShowcase.ts`.
 *
 * Filtering is client state over server-rendered data: every card is in the
 * initial HTML, so the gallery is crawlable and works before hydration. The
 * filter is a set of toggle buttons rather than a `<select>` so the active
 * category is visible at a glance, as in the source design.
 */
const ALL = 'All';

export function TemplateGallery({
  templates,
  categories,
}: {
  templates: ShowcaseTemplate[];
  categories: string[];
}) {
  const [active, setActive] = useState(ALL);

  const visible = useMemo(
    () => (active === ALL ? templates : templates.filter((item) => item.category === active)),
    [active, templates],
  );

  if (templates.length === 0) return null;

  return (
    <>
      {categories.length > 1 && (
        <div
          className="mt-8 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter templates by category"
        >
          {[ALL, ...categories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              aria-pressed={active === category}
              className="sr-filter"
            >
              {category}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((template) => (
          <li key={template.id} className="sr-tpl">
            <div className="sr-tpl-canvas">
              {template.thumbnail ? (
                // Thumbnails are inline SVG/PNG data URIs generated from the
                // canvas, so there is nothing for the image optimiser to fetch
                // or resize — `next/image` would only add a wrapper. The
                // authenticated gallery renders them the same way, via
                // `unoptimized`.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={template.thumbnail}
                  alt={`${template.name} certificate template preview`}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span
                  className="grid h-full w-full place-items-center bg-[rgb(var(--sr-canvas-sunken))] text-[0.75rem] text-[rgb(var(--sr-ink-faint))]"
                  aria-hidden="true"
                >
                  Preview unavailable
                </span>
              )}
            </div>
            <div className="sr-tpl-body">
              <div className="min-w-0">
                <p className="truncate text-[0.9375rem] font-semibold text-[rgb(var(--sr-deep-ink))]">
                  {template.name}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-[rgb(var(--sr-deep-soft))]">
                  {template.category}
                </p>
              </div>
              <Link
                href="/signup"
                // `text-white` fails on the lighter dark-mode brand blue
                // (2.78:1); `--sr-brand-ink` flips with the theme.
                className="shrink-0 rounded-full bg-[rgb(var(--sr-brand))] px-3.5 py-1.5 text-[0.75rem] font-bold text-[rgb(var(--sr-brand-ink))] transition-colors hover:bg-[rgb(var(--sr-brand-strong))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Use
                <span className="sr-only"> the {template.name} template</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p
        className="mt-4 text-[0.8125rem] text-[rgb(var(--sr-deep-soft))]"
        role="status"
        aria-live="polite"
      >
        {visible.length} {visible.length === 1 ? 'template' : 'templates'}
        {active === ALL ? '' : ` in ${active}`}
      </p>

      <div className="mt-9">
        <Link href="/signup" className="sr-btn sr-btn-primary">
          Start from a template
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
