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
 */
export function WorkflowSteps({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="sr-rail mt-12 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, index) => (
        <Reveal as="li" key={step.title} delay={index * 60} className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas))] text-[rgb(var(--sr-brand))] shadow-[var(--sr-shadow-1)]">
              <step.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="sr-hint font-mono text-xs">
              Step {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <h3 className="sr-h3 mt-4">{step.title}</h3>
          <p className="sr-body mt-2">{step.body}</p>
        </Reveal>
      ))}
    </ol>
  );
}
