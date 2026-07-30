import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  Download,
  FileSpreadsheet,
  GraduationCap,
  HeartHandshake,
  Layers,
  Mail,
  Paintbrush,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { CapabilityMarquee } from '@/components/marketing/CapabilityMarquee';
import { HeroShowcase } from '@/components/marketing/HeroShowcase';
import { Reveal } from '@/components/marketing/Reveal';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { WorkflowSteps, type WorkflowStep } from '@/components/marketing/WorkflowSteps';
import { FeatureStory } from '@/components/marketing/FeatureStory';
import { ProductShot } from '@/components/marketing/ProductShot';
import { UseCaseCard } from '@/components/marketing/UseCaseCard';
import { TemplateGallery } from '@/components/marketing/TemplateGallery';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';
import { EVENTS_ENABLED } from '@/lib/featureFlags';
import { getTemplateShowcase } from '@/lib/templates/publicShowcase';
import { faqPageSchema, jsonLd, type FaqItem } from '@/lib/seo/structuredData';
import '@/styles/marketing.css';

/**
 * Public landing page.
 *
 * Server-rendered end to end. Every product claim maps to shipped behaviour,
 * the screenshots are captures of the real UI running against the local
 * emulator with synthetic recipients, the template gallery reads the real
 * published templates from Firestore, and there is no invented social proof,
 * rating, customer, or usage count anywhere on the page.
 */

// Templates are read on the server and the page is re-generated periodically,
// so the gallery stays a static document rather than a per-request Firestore
// round trip.
export const revalidate = 1800;

const workflow: WorkflowStep[] = [
  {
    icon: Paintbrush,
    title: 'Design',
    body: 'Lay out one reusable certificate — text, logos, signatures, seals, and the verification field.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Import',
    body: 'Upload a CSV or Excel file. Serenity reads the header row and lists every column.',
  },
  {
    icon: Users,
    title: 'Map',
    body: 'Drop a column onto the design to bind it to a field, then preview real rows.',
  },
  {
    icon: Layers,
    title: 'Generate',
    body: 'Produce one personalised certificate per row as PDF, PNG, or a ZIP archive.',
  },
  {
    icon: Mail,
    title: 'Deliver',
    body: 'Download the batch, or email a certificate to its recipient after an ownership check.',
  },
  {
    icon: QrCode,
    title: 'Verify',
    body: 'Every certificate carries a permanent verification URL and matching QR code.',
  },
];

const useCases = [
  {
    icon: GraduationCap,
    audience: 'Education and colleges',
    body: 'Issue course, semester, and programme certificates for a whole cohort from the registrar’s spreadsheet.',
  },
  {
    icon: CalendarCheck,
    audience: 'Workshops and events',
    body: 'Turn a participant list into participation and speaker certificates once the event has closed.',
  },
  {
    icon: Building2,
    audience: 'HR and employee recognition',
    body: 'Recognise internal training, compliance completion, and long-service milestones from one template.',
  },
  {
    icon: Sparkles,
    audience: 'Training programmes',
    body: 'Reuse one branded design across every intake and give learners a link they can share with employers.',
  },
  {
    icon: HeartHandshake,
    audience: 'Communities and nonprofits',
    body: 'Thank volunteers and contributors with certificates that carry proof anyone can check.',
  },
];

const faqs: FaqItem[] = [
  {
    question: 'What is Serenity Certificate Generator?',
    answer:
      'Serenity is a certificate generator for designing, personalising, generating, emailing, and verifying certificates in bulk. You build one reusable template, connect a spreadsheet of recipients, and generate a personalised certificate for every row — each with a permanent verification URL and QR code.',
  },
  {
    question: 'Can I import recipients from CSV or Excel?',
    answer:
      'Yes. Upload a CSV, XLSX, XLS, or ODS file and Serenity lists every column from the header row as a variable. Drop a variable onto the canvas to bind it to a field, then step through the rows to preview the real values before generating.',
  },
  {
    question: 'What output formats are supported?',
    answer:
      'Generated certificates can be exported as PDF, as PNG, or as both, packaged into a single ZIP archive for the whole batch.',
  },
  {
    question: 'Can Serenity email certificates to recipients?',
    answer:
      'Yes. A generated certificate can be emailed to its recipient after Serenity confirms you own that certificate and your own address is verified. Sending is rate-limited per day, and the bulk email endpoint is disabled by default and returns 501 until an operator enables it.',
  },
  {
    question: 'How does certificate verification work?',
    answer:
      'Every certificate can carry a permanent verification URL and a matching QR code. Scanning or opening it loads a public verification page showing the recipient name, certificate title, issuer, issue date, and certificate ID. Recipient email addresses, spreadsheet rows, owner identifiers, and template identifiers are never exposed.',
  },
  {
    question: 'Is Serenity free?',
    answer: `The free plan includes ${FREE_CERTIFICATE_LIMIT} persisted certificates in total, with no card required, and covers the whole workflow from design to verification. Pro starts at $20 per month and is arranged through a request — there is no self-serve checkout.`,
  },
  {
    question: 'Who owns and can read my data?',
    answer:
      'Every private read and write is authenticated server-side and scoped to the signed-in account. Firestore and Storage rules deny client access by default, so certificates, templates, and media stay with the account that created them.',
  },
];

export default async function HomePage() {
  const showcase = await getTemplateShowcase(6);

  return (
    <div className="sr-scope sr-shell">
      <a
        href="#main"
        className="sr-btn sr-btn-primary sr-skip absolute left-4 top-4 z-[60] -translate-y-24 focus:translate-y-0"
      >
        Skip to content
      </a>

      <MarketingNav />

      <main id="main">
        {/* ------------------------------------------------------------ hero */}
        <section className="sr-hero pb-12 pt-10 sm:pb-20 sm:pt-20 lg:pb-24">
          <div className="sr-container grid items-center gap-10 sm:gap-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-16">
            <Reveal eager>
              <p className="sr-pill">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Batch certificate generation
              </p>

              <h1 className="sr-h1 mt-6">
                Create, send &amp; <span className="sr-accent">verify</span> professional
                certificates at scale.
              </h1>

              <p className="sr-lead mt-6 max-w-xl">
                Design a reusable template, import recipients from CSV or Excel, generate
                personalised certificates, and deliver them by email — with built-in QR
                verification.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="sr-btn sr-btn-primary">
                  Create certificates
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#templates" className="sr-btn sr-btn-secondary">
                  Explore templates
                </a>
              </div>

              <p className="sr-body mt-5 flex items-center gap-2 text-sm">
                <Check
                  className="h-4 w-4 shrink-0 text-[rgb(var(--sr-teal))]"
                  aria-hidden="true"
                />
                Start free · {FREE_CERTIFICATE_LIMIT} persisted certificates · No card required
              </p>

              {/*
                The source design carries a "10K+ certificates / 500+ organizations"
                strip here. Serenity has no verified usage to cite, so this states
                what the product does instead of inventing adoption.
              */}
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-[rgb(var(--sr-line))] pt-7">
                {[
                  { value: 'CSV · XLSX', label: 'Recipient import' },
                  { value: 'PDF · PNG', label: 'Batch export' },
                  { value: 'QR + URL', label: 'On every certificate' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-display text-lg sm:text-xl">{stat.value}</dt>
                    <dd className="sr-hint mt-1.5">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal eager delay={120}>
              <HeroShowcase />
            </Reveal>
          </div>
        </section>

        <CapabilityMarquee />

        {/* --------------------------------------------------- how it works */}
        <section id="how-it-works" className="sr-section" style={{ scrollMarginTop: '5rem' }}>
          <div className="sr-container">
            <SectionHeading
              eyebrow="How it works"
              title="Six steps from template to inbox."
              lead="Every stage below maps to a feature that ships today — nothing here is a roadmap item."
              align="center"
            />
            <WorkflowSteps steps={workflow} />
          </div>
        </section>

        {/* ------------------------------------------------------- the editor */}
        <section id="product" className="sr-section sr-section-deep" style={{ scrollMarginTop: '5rem' }}>
          <div className="sr-container">
            <FeatureStory
              eyebrow="Certificate editor"
              title="Design once. Personalise for everyone."
              lead="Compose the layout once with text, imported logos, signatures, and seals. Print boundaries, alignment guides, and an A4 landscape frame keep the design production-ready."
              points={[
                'Reusable templates keep layout, variables, and certificate details together',
                'Upload PNG, JPEG, or WebP media once and reuse it across designs',
                'The verification field is a locked, mandatory part of every template',
                'Undo, redo, alignment guides, and a print-boundary overlay',
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

        {/* ------------------------------------------- data and generation */}
        <section className="sr-section sr-section-tint">
          <div className="sr-container">
            <FeatureStory
              eyebrow="Bulk personalisation"
              title="One spreadsheet. A complete certificate batch."
              lead="Upload CSV, XLSX, XLS, or ODS. Serenity reads the header row, lists every column as a draggable variable, and previews any row against the live design before a single certificate is written."
              points={[
                'Every column becomes a variable you can drop onto the canvas',
                'Step through records to check real values before generating',
                'Import limits guard row count, column count, and cell length',
                'One personalised certificate per row, exported as PDF, PNG, or ZIP',
              ]}
              reverse
              media={
                <ProductShot
                  src="/product/mapping.webp"
                  alt="The Data Source panel confirming six records loaded successfully, listing Name, Email, Course, and Date as available variables, and previewing record one of six with sample values."
                  caption="Column mapping and row preview. Sample data only."
                  width={1440}
                  height={900}
                />
              }
              footer={
                <div className="sr-card p-5">
                  <p className="sr-h3 flex items-center gap-2">
                    <Download
                      className="h-4 w-4 text-[rgb(var(--sr-brand-text))]"
                      aria-hidden="true"
                    />
                    Delivery
                  </p>
                  <p className="sr-body mt-2">
                    Download the whole batch, or email a generated certificate to its recipient.
                    Serenity checks that you own the certificate and that your own address is
                    verified first, and sending is rate-limited per day. Bulk email is disabled by
                    default.
                  </p>
                </div>
              }
            />
          </div>
        </section>

        {/* ------------------------------------------------------ verification */}
        <section id="verification" className="sr-section" style={{ scrollMarginTop: '5rem' }}>
          <div className="sr-container">
            <FeatureStory
              eyebrow="Verification"
              title="Every certificate can prove it is genuine."
              lead="Each generated certificate carries a permanent verification URL and matching QR code. Opening it loads a public page that proves the certificate is genuine without leaking anything about the recipient."
              points={[
                'The public page shows recipient name, title, issuer, issue date, and certificate ID',
                'Recipient email addresses, spreadsheet rows, and owner identifiers are never returned',
                'Recipient pages are marked noindex, so they stay out of search results',
                'Recipients can copy the link or add the credential to LinkedIn',
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
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--sr-brand-text))]"
                    aria-hidden="true"
                  />
                  <span>
                    Firestore and Storage rules deny client access by default. Every private read
                    and write is authenticated server-side and scoped to the account that owns the
                    record.
                  </span>
                </p>
              }
            />
          </div>
        </section>

        {/* --------------------------------------------------------- templates */}
        <section
          id="templates"
          className="sr-section sr-section-deep"
          style={{ scrollMarginTop: '5rem' }}
        >
          <div className="sr-container">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="sr-eyebrow">Template library</p>
                <h2 className="sr-h2 mt-4">Start from a polished template.</h2>
                <p className="sr-lead mt-4">
                  {showcase.liveCount > 0
                    ? 'Published templates from the Serenity library, ready to open in the editor and rename for your programme.'
                    : 'Curated designs that ship with Serenity, ready to open in the editor and rename for your programme.'}
                </p>
              </div>
              <Link href="/templates" className="sr-link inline-flex items-center gap-1.5">
                View all templates
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <TemplateGallery templates={showcase.templates} categories={showcase.categories} />
          </div>
        </section>

        {/* --------------------------------------------------------- use cases */}
        <section className="sr-section">
          <div className="sr-container">
            <SectionHeading
              eyebrow="Use cases"
              title="Built for every team that recognises achievement."
              lead="If recognition currently means editing the same file once per person, this is the part Serenity replaces."
              align="center"
            />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {useCases.map((useCase, index) => (
                <Reveal key={useCase.audience} delay={(index % 3) * 70}>
                  <UseCaseCard {...useCase} />
                </Reveal>
              ))}

              <Reveal delay={140}>
                <div className="sr-section-brand flex h-full flex-col justify-between rounded-[var(--sr-r-lg)] p-7">
                  <div>
                    <h3 className="sr-display text-xl leading-tight">
                      Not sure how it maps to your programme?
                    </h3>
                    <p className="sr-body mt-3">
                      Create a free account and take one certificate all the way from a blank canvas
                      to a verification page.
                    </p>
                  </div>
                  <Link href="/signup" className="sr-btn sr-btn-primary mt-7 self-start">
                    Try it free
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            </div>

            {EVENTS_ENABLED && (
              <Reveal className="mt-8">
                <p className="sr-body">
                  Certificates can also link to optional event context — the workshop, course, or
                  ceremony behind the award.
                </p>
              </Reveal>
            )}
          </div>
        </section>

        <PricingSection />

        {/* --------------------------------------------------------------- faq */}
        <section id="faq" className="sr-section" style={{ scrollMarginTop: '5rem' }}>
          <script {...jsonLd(faqPageSchema(faqs))} />
          <div className="sr-container">
            <div className="mx-auto max-w-3xl">
              <SectionHeading eyebrow="FAQ" title="Common questions" align="center" />
              <FaqAccordion items={faqs} />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- final CTA */}
        <section className="sr-section sr-section-brand">
          <Reveal className="sr-container text-center">
            <div className="mx-auto max-w-3xl">
              <h2 className="sr-h2">Your next certificate batch starts with one template.</h2>
              <p className="sr-lead mt-5">
                Design, personalise, deliver, and verify — all in one focused workflow.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/signup" className="sr-btn sr-btn-primary">
                  Start creating
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#templates" className="sr-btn sr-btn-secondary">
                  Browse templates
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
