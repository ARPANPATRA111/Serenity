import { Check } from 'lucide-react';

/**
 * Scrolling capability strip under the hero.
 *
 * Every item is a shipped feature — never a metric, customer, or count. The
 * track is duplicated so the loop is seamless, and the duplicate is hidden
 * from assistive technology so the list is announced once.
 *
 * `prefers-reduced-motion` stops the animation entirely (see marketing.css),
 * which leaves a static, readable strip rather than an empty band.
 */
const capabilities = [
  'Bulk personalisation',
  'PDF, PNG, and ZIP export',
  'CSV and Excel import',
  'Email delivery',
  'QR verification',
  'Reusable templates',
  'Public verification page',
  'Alignment guides',
];

function Track({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="sr-marquee-track" aria-hidden={duplicate || undefined}>
      {capabilities.map((item) => (
        <span key={item} className="sr-marquee-item">
          <Check className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--sr-teal-vivid))]" />
          {item}
        </span>
      ))}
    </div>
  );
}

export function CapabilityMarquee() {
  return (
    <div className="sr-section-deep border-y border-[rgb(var(--sr-deep-line))] py-4">
      <div className="sr-marquee">
        <Track />
        <Track duplicate />
      </div>
    </div>
  );
}
