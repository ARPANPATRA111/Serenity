import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from './Reveal';

/**
 * Alternating narrative row: copy on one side, product evidence on the other.
 * `reverse` flips the order on wide screens only — mobile always reads
 * heading, then explanation, then evidence.
 */
export function FeatureStory({
  id,
  eyebrow,
  title,
  lead,
  points,
  media,
  footer,
  reverse = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead: string;
  points?: string[];
  media: ReactNode;
  footer?: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      id={id}
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
      style={{ scrollMarginTop: '5rem' }}
    >
      <Reveal className={reverse ? 'lg:order-2' : undefined}>
        <p className="sr-eyebrow">{eyebrow}</p>
        <h2 className="sr-h2 mt-3">{title}</h2>
        <p className="sr-lead mt-4">{lead}</p>
        {points && points.length > 0 && (
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="sr-body flex gap-3">
                <Check
                  className="mt-1 h-4 w-4 shrink-0 text-[rgb(var(--sr-teal))]"
                  aria-hidden="true"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
        {footer && <div className="mt-7">{footer}</div>}
      </Reveal>

      <Reveal delay={90} className={reverse ? 'lg:order-1' : undefined}>
        {media}
      </Reveal>
    </div>
  );
}
