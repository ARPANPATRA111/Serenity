import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { faqs } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free with the full workflow. Pro starts at $20 per month and is arranged through a request.',
  alternates: { canonical: '/pricing' },
};

const pricingQuestions = faqs.filter((item) => /free|pro|data/i.test(item.question));

export default function PricingPage() {
  return (
    <MarketingPage
      title="Start free. Upgrade when you grow."
      lead="The free plan covers the whole workflow. Pro starts at $20 per month and is arranged through a request — there is no self-serve checkout yet."
    >
      <PricingSection showHeading={false} />
      <section className="sr-section sr-section-tight">
        <div className="sr-container">
          <div className="mx-auto max-w-3xl">
            <h2 className="sr-h2 text-center">Questions about plans</h2>
            <FaqAccordion items={pricingQuestions} />
            <p className="mt-8 text-center">
              <Link href="/faq" className="sr-link inline-flex items-center gap-1.5">
                All questions <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
