import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { DeliverArt, DesignArt, ImportArt, VerifyArt } from '@/components/marketing/Illustrations';
import { Reveal } from '@/components/marketing/Reveal';
import { workflow } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'Six steps from a blank certificate to a verified PDF in every recipient’s inbox: design, import, map, generate, deliver and verify.',
  alternates: { canonical: '/how-it-works' },
};

/** One illustration per step pair; the steps themselves come from the shared copy. */
const arts = [DesignArt, ImportArt, ImportArt, DeliverArt, DeliverArt, VerifyArt];

export default function HowItWorksPage() {
  return (
    <MarketingPage
      title="Six steps from template to inbox."
      lead="Most batches take minutes. Here is the whole path."
      art={<ImportArt />}
    >
      <section className="sr-section sr-section-tight">
        <div className="sr-container">
          <ol className="timeline">
            {workflow.map((step, index) => {
              const Art = arts[index];
              return (
                <Reveal as="li" key={step.title} className="timeline-step">
                  <span className="timeline-marker" aria-hidden="true">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <div className="timeline-copy">
                    <p className="timeline-count">Step {index + 1} of {workflow.length}</p>
                    <h2 className="sr-h3 timeline-title">{step.title}</h2>
                    <p className="sr-body mt-2">{step.body}</p>
                  </div>
                  <Art className="timeline-art" />
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="sr-section sr-section-tight">
        <Reveal className="sr-container section-more">
          <Link href="/signup" className="sr-btn sr-btn-primary">Try it with your spreadsheet</Link>
          <Link href="/templates" className="sr-btn sr-btn-secondary">Pick a template</Link>
        </Reveal>
      </section>
    </MarketingPage>
  );
}
