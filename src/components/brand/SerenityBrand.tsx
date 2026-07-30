import type { SVGProps } from 'react';

/**
 * Certificate-sheet mark: a document with a ribboned seal.
 *
 * Tinted to the marketing palette — Serenity blue base, violet corner facet,
 * teal highlight, coral ribbon — so the mark belongs to the same system as the
 * pages it sits on.
 */
export function SerenityMark({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...props}>
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#1A5CFF" />
      <path
        d="M29 1h3c8.3 0 15 6.7 15 15v16c0 8.3-6.7 15-15 15H20L29 1Z"
        fill="#6B4FFF"
        fillOpacity=".7"
      />
      <path
        d="M34.8 10.8a15.2 15.2 0 0 1 11.4 11.4v9.4L25.4 10.8h9.4Z"
        fill="#00C9BC"
        fillOpacity=".3"
      />
      <path
        d="M14 9.5h15.2l5.3 5.3v19.7a3 3 0 0 1-3 3h-17a3 3 0 0 1-3-3v-22a3 3 0 0 1 2.5-3Z"
        fill="white"
      />
      <path d="M29 9.5v5.8h5.5" fill="#D6E2FF" />
      <path d="M29 9.5v5.8h5.5" stroke="#8FB0FF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 18.5h12M17 22.5h8" stroke="#6E9BFF" strokeWidth="2" strokeLinecap="round" />
      <path d="m20.5 33.2-2.2 7 5.7-3.1 5.7 3.1-2.2-7" fill="#FF5533" />
      <circle cx="24" cy="30.2" r="6.2" fill="#1A5CFF" stroke="white" strokeWidth="2" />
      <path
        d="m21.3 30.2 1.8 1.8 3.8-4"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * `stacked` renders the full product name under the wordmark. "Serenity" alone
 * does not say what the product is, so the public pages always pair it with
 * the category.
 */
export function SerenityBrand({
  compact = false,
  stacked = false,
  className = '',
}: {
  compact?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SerenityMark className="h-10 w-10 shrink-0" />
      {!compact &&
        (stacked ? (
          // The space between the two lines is a real text node so the lockup
          // still reads as "Serenity Certificate Generator" in textContent —
          // flex containers drop whitespace-only nodes, so nothing shifts.
          <span className="flex flex-col leading-none">
            <span className="sr-display text-[1.0625rem] leading-none">Serenity</span>{' '}
            <span className="sr-brand-sub mt-1 text-[0.5625rem] font-bold uppercase leading-none tracking-[0.16em] text-[rgb(var(--sr-ink-faint))]">
              Certificate Generator
            </span>
          </span>
        ) : (
          /*
           * The wordmark is hidden *visually* below `sm` so app headers have
           * room for their action buttons, but it stays in the accessibility
           * tree — the mark itself is `aria-hidden`, so dropping the text
           * outright would leave the home link with no accessible name.
           */
          <span className="sr-display sr-only text-lg sm:not-sr-only sm:inline">Serenity</span>
        ))}
    </span>
  );
}
