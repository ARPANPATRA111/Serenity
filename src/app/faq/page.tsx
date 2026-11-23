import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { DeliverArt } from '@/components/marketing/Illustrations';
import { faqs } from '@/lib/marketing/content';
import { faqPageSchema, jsonLd } from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about importing recipients, output formats, email delivery, verification, pricing and data ownership.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return (
    <MarketingPage title="Common questions" lead="Short answers about the workflow, verification, pricing and your data." art={<DeliverArt />}>
      <script {...jsonLd(faqPageSchema(faqs))} />
      <section id="faq" className="sr-section sr-section-tight">
        <div className="sr-container">
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={faqs} />
            <p className="sr-body mt-10 text-center">
              Still unsure? <Link href="/signup" className="sr-link">Create a free account</Link> and take one certificate from design to verification.
            </p>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
