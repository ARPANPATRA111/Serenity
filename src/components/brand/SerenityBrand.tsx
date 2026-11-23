import type { SVGProps } from 'react';

/**
 * Award-seal mark: a scalloped seal with an engraved "S" monogram, a brass
 * inner rule and two verdigris ribbon tails. The seal is ink on paper and
 * inverts to paper on night, so it reads on either theme.
 */
const SEAL_PATH = (() => {
  const points: string[] = [];
  const steps = 144;
  for (let index = 0; index < steps; index += 1) {
    const theta = (index / steps) * Math.PI * 2;
    const radius = 17.6 + 1.25 * Math.cos(18 * theta);
    points.push(`${(24 + radius * Math.cos(theta)).toFixed(2)} ${(20.5 + radius * Math.sin(theta)).toFixed(2)}`);
  }
  return `M${points.join(' ')}Z`;
})();

export function SerenityMark({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={`serenity-mark ${className}`} aria-hidden="true" {...props}>
      <path d="M18.2 31.2 13.6 45.4l5-2.4 3.1 4.4 3.5-12.8Z" className="sm-tail" />
      <path d="M29.8 31.2l4.6 14.2-5-2.4-3.1 4.4-3.5-12.8Z" className="sm-tail sm-tail-shade" />
      <path d={SEAL_PATH} className="sm-seal" />
      <circle cx="24" cy="20.5" r="13.6" className="sm-rule" strokeWidth="0.9" />
      <circle cx="24" cy="20.5" r="11.9" className="sm-rule" strokeWidth="0.45" strokeDasharray="0.6 1.1" />
      <path
        d="M28.6 15.1c-1-1.4-2.7-2.2-4.7-2.2-2.8 0-4.9 1.6-4.9 3.9 0 5.3 10.1 3.1 10.1 8.4 0 2.4-2.3 4.1-5.3 4.1-2.2 0-4.1-.9-5.1-2.5"
        className="sm-monogram"
        strokeWidth="2.3"
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
            <span className="sr-display text-[1.3rem] leading-none">Serenity</span>{' '}
            <span className="sr-brand-sub mt-1 text-[0.6875rem] font-medium leading-none text-[rgb(var(--sr-ink-faint))]">
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
          <span className="font-display sr-only text-xl font-medium tracking-[-0.015em] sm:not-sr-only sm:inline">Serenity</span>
        ))}
    </span>
  );
}
