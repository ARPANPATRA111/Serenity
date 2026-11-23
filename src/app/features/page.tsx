import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Download, Eye, FileSpreadsheet, Image as ImageIcon, Lock, Mail, QrCode, Ruler, ShieldCheck, Undo2 } from 'lucide-react';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { FeatureStory } from '@/components/marketing/FeatureStory';
import { ProductShot } from '@/components/marketing/ProductShot';
import { DesignArt } from '@/components/marketing/Illustrations';
import { Reveal } from '@/components/marketing/Reveal';

export const metadata: Metadata = {
  title: 'Product',
  description: 'The Serenity certificate editor, spreadsheet personalisation, bulk PDF generation, email delivery and public verification.',
  alternates: { canonical: '/features' },
};

const capabilities = [
  { icon: Ruler, label: 'Alignment guides and print boundaries' },
  { icon: ImageIcon, label: 'Logos, signatures and seals' },
  { icon: Undo2, label: 'Undo, redo and drafts' },
  { icon: FileSpreadsheet, label: 'CSV, XLSX, XLS and ODS' },
  { icon: Download, label: '300 DPI PDFs in one ZIP' },
  { icon: Mail, label: 'Email to each recipient' },
  { icon: QrCode, label: 'QR code on every design' },
  { icon: Lock, label: 'Private, account-scoped data' },
];

export default function FeaturesPage() {
  return (
    <MarketingPage
      title="Everything a certificate needs, in one studio."
      lead="Design it, personalise it from a spreadsheet, deliver it and let anyone check it."
      art={<DesignArt />}
    >
      <section className="sr-section sr-section-tight" aria-label="Capabilities">
        <div className="sr-container">
          <ul className="capability-grid">
            {capabilities.map(({ icon: Icon, label }, index) => (
              <Reveal as="li" key={label} delay={(index % 4) * 60} className="capability">
                <span className="capability-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                {label}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section id="editor" className="sr-section" style={{ scrollMarginTop: '5rem' }}>
        <div className="sr-container">
          <FeatureStory
            eyebrow="Certificate editor"
            title="Design once. Personalise for everyone."
            lead="Compose the layout once. Guides and an A4 frame keep it print-ready."
            points={[
              'Reusable templates keep layout, variables and details together',
              'Upload PNG, JPEG or WebP media once and reuse it',
              'The verification field is locked into every template',
            ]}
            media={
              <ProductShot
                src="/product/editor.webp"
                alt="The Serenity certificate editor with an A4 landscape canvas, a media sidebar, a toolbar, and a template containing placeholder variables for name, issuer, date, and the verification URL."
                caption="Certificate editor with a template loaded."
                width={1440}
                height={900}
              />
            }
          />
        </div>
      </section>

      <section id="personalise" className="sr-section" style={{ scrollMarginTop: '5rem' }}>
        <div className="sr-container">
          <FeatureStory
            eyebrow="Bulk personalisation"
            title="One spreadsheet. A complete batch."
            lead="Every column becomes a field you can place. Preview real rows before you generate."
            points={[
              'Step through records to check real values',
              'Import limits guard rows, columns and cell length',
              'One personalised PDF per row, downloaded as a ZIP',
            ]}
            reverse
            media={
              <ProductShot
                src="/product/mapping.webp"
                alt="A spreadsheet with two sample recipients in the Data Source panel. The canvas previews the first recipient’s name in Hindi alongside the issuer and date."
                caption="Column mapping and row preview. Sample data only."
                width={1440}
                height={900}
              />
            }
          />
        </div>
      </section>

      <section id="verification" className="sr-section" style={{ scrollMarginTop: '5rem' }}>
        <div className="sr-container">
          <FeatureStory
            eyebrow="Verification"
            title="Every certificate can prove it is genuine."
            lead="The PDF links to a public record. A QR code lets anyone holding a printed copy check it."
            points={[
              'Shows recipient, title, issuer, issue date and certificate ID',
              'Never shows email addresses, spreadsheet rows or owner identifiers',
              'Recipient pages stay out of search results',
            ]}
            media={
              <ProductShot
                src="/product/verification.webp"
                alt="A public Serenity verification page showing a verified certificate badge, the certificate title, the issuing organisation, the recipient name, the issue date, the verification count, and the certificate identifier."
                caption="Public verification page. Sample certificate only."
                width={900}
                height={1194}
                sizes="(min-width: 1024px) 420px, 100vw"
                className="mx-auto max-w-sm"
              />
            }
            footer={
              <p className="sr-body flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--sr-brand-text))]" aria-hidden="true" />
                <span>Every private read and write is checked on the server and scoped to its owner.</span>
              </p>
            }
          />
        </div>
      </section>

      <section className="sr-section sr-section-tight">
        <Reveal className="sr-container section-more">
          <Link href="/signup" className="sr-btn sr-btn-primary">Create certificates</Link>
          <Link href="/how-it-works" className="sr-link inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" aria-hidden="true" /> See the workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Reveal>
      </section>
    </MarketingPage>
  );
}
