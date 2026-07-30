import type { LucideIcon } from 'lucide-react';
import { Reveal } from './Reveal';

export type WorkflowStep = {
  icon: LucideIcon;
  title: string;
  body: string;
};

/**
 * The six stages a certificate actually moves through in Serenity.
 * Each stage maps to an implemented feature, not an aspiration.
 *
 * Laid out as a single connected rail on wide screens (the hairline lives in
 * `.sr-rail`), and as a plain stacked list below that, where a horizontal
 * connector would only add noise.
 */
export function WorkflowSteps({ steps }: { steps: WorkflowStep[] }) {
  return (
    // Two columns even on a phone: six full-width blocks is a lot of scroll
    // for six short captions.
    <ol className="sr-rail mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:mt-14 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-6">
      {steps.map((step, index) => (
        <Reveal as="li" key={step.title} delay={index * 70} className="relative lg:text-center">
          <div className="flex items-center gap-3 lg:flex-col lg:gap-2.5">
            <span className="sr-rail-marker text-[rgb(var(--sr-brand))]">
              <step.icon className="h-[1.375rem] w-[1.375rem]" aria-hidden="true" />
            </span>
            <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--sr-ink-faint))]">
              Step {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <h3 className="sr-h3 mt-3.5">{step.title}</h3>
          <p className="sr-body mt-1.5 text-[0.9062rem] lg:mx-auto lg:max-w-[15rem]">{step.body}</p>
        </Reveal>
      ))}
    </ol>
  );
}
