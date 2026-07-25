import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  Download,
  FileSpreadsheet,
  GraduationCap,
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
import { Reveal } from '@/components/marketing/Reveal';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { WorkflowSteps, type WorkflowStep } from '@/components/marketing/WorkflowSteps';
import { FeatureStory } from '@/components/marketing/FeatureStory';
import { ProductShot } from '@/components/marketing/ProductShot';
import { UseCaseCard } from '@/components/marketing/UseCaseCard';
import { CertificateFace, SealMotif } from '@/components/marketing/CertificateMotif';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';
import { EVENTS_ENABLED } from '@/lib/featureFlags';
import { faqPageSchema, jsonLd, type FaqItem } from '@/lib/seo/structuredData';
import '@/styles/marketing.css';

/**
 * Public landing page.
 *
 * Server-rendered end to end: every product claim below maps to shipped
 * behaviour, the screenshots are captures of the real UI running against the
 * local emulator with synthetic recipients, and there is no invented social
 * proof, rating, customer, or usage count anywhere on the page.
 */

const workflow: WorkflowStep[] = [
  {
    icon: Paintbrush,
    title: 'Design',
    body: 'Lay out one reusable certificate on the canvas — text, logos, signatures, seals, and the verification field.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Import',
    body: 'Upload a CSV or Excel file of recipients. Serenity reads the header row and lists every column as a variable.',
  },
  {
    icon: Users,
    title: 'Personalise',
    body: 'Drop a column onto the design to bind it to a field, then step through the rows to preview real values.',
  },
  {
    icon: Layers,
    title: 'Generate',
    body: 'Produce one personalised certificate per row and export the batch as PDF, PNG, or a ZIP archive.',
  },
  {
    icon: Mail,
    title: 'Deliver',
    body: 'Download the batch, or email a generated certificate to its recipient after an ownership check.',
  },
  {
    icon: QrCode,
    title: 'Verify',
    body: 'Every certificate carries a permanent verification URL and matching QR code that opens a public page.',
  },
];

const useCases = [
  {
    icon: GraduationCap,
    audience: 'Colleges and universities',
    body: 'Issue course, semester, and programme certificates for a whole cohort from the registrar’s spreadsheet.',
  },
  {
    icon: CalendarCheck,
    audience: 'Event organisers',
    body: 'Turn a participant list into participation and speaker certificates once the event has closed.',
  },
  {
    icon: Building2,
    audience: 'Companies',
    body: 'Recognise internal training, compliance completion, and long-service milestones with a consistent template.',
  },
  {
    icon: Sparkles,
    audience: 'Training providers',
    body: 'Reuse one branded design across every intake and give learners a link they can share with employers.',
  },
];

const templateDirections = [
  { accent: '#4338CA', wash: '#DDE1FB', label: 'Course completion', name: 'Academic', note: 'Formal and composed' },
  { accent: '#0D7C7C', wash: '#D3EEEE', label: 'Workshop participation', name: 'Workshop', note: 'Fresh and welcoming' },
  { accent: '#B0761A', wash: '#F7E7C8', label: 'Achievement award', name: 'Recognition', note: 'Warm and celebratory' },
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

export default function HomePage() {
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
        <section className="sr-hero pb-16 pt-12 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
          <div className="sr-container grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-14">
            <Reveal eager>
              <p className="sr-eyebrow">
                <SealMotif className="h-4 w-4" />
                Serenity Certificate Generator
              </p>
              <h1 className="sr-h1 mt-4">
                From spreadsheet to verified certificates in minutes.
              </h1>
              <p className="sr-lead mt-5 max-w-xl">
                Design one certificate, map a CSV or Excel column to every field, and generate a
                personalised certificate for each recipient — each with its own verification page
                and QR code.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="sr-btn sr-btn-primary">
                  Create a free account
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="sr-btn sr-btn-secondary">
                  See how it works
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                {[
                  `${FREE_CERTIFICATE_LIMIT} persisted certificates free`,
                  'No card required',
                  'PDF, PNG, and ZIP export',
                ].map((item) => (
                  <li key={item} className="sr-body flex items-center gap-2 text-sm">
                    <Check
                      className="h-4 w-4 shrink-0 text-[rgb(var(--sr-aqua))]"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal eager delay={110}>
              <ProductShot
                src="/product/mapping.webp"
                alt="The Serenity editor showing a certificate on the canvas beside the Data Source panel, where six imported spreadsheet records expose Name, Email, Course, and Date as variables and preview the first record."
                caption="The Serenity editor with a spreadsheet connected. Sample data only."
                width={1440}
                height={900}
                priority
                sizes="(min-width: 1024px) 640px, 100vw"
              />
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------- how it works */}
        <section
          id="how-it-works"
          className="sr-section sr-section-subtle"
          style={{ scrollMarginTop: '4rem' }}
        >
          <div className="sr-container">
            <SectionHeading
              eyebrow="How it works"
              title="Design once. Personalise every certificate."
              lead="Six stages take a batch from a blank canvas to a certificate a recipient can share and anyone can check."
            />
            <WorkflowSteps steps={workflow} />
          </div>
        </section>

        {/* ------------------------------------------------------- the editor */}
        <section className="sr-section">
          <div className="sr-container">
            <FeatureStory
              id="editor"
              eyebrow="Visual editor"
              title="A canvas built for certificates, not slides."
              lead="Compose the layout once with text, imported logos, signatures, and seals. Print boundaries, alignment guides, and an A4 landscape frame keep the design production-ready."
              points={[
                'Reusable templates keep the layout, variables, and certificate details together',
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
        <section className="sr-section sr-section-subtle">
          <div className="sr-container">
            <FeatureStory
              eyebrow="Spreadsheet personalisation"
              title="Your recipient list becomes the certificate."
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
                  <p className="sr-h3 flex items-center gap-2 text-base">
                    <Download className="h-4 w-4 text-[rgb(var(--sr-brand))]" aria-hidden="true" />
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
        <section className="sr-section">
          <div className="sr-container">
            <FeatureStory
              id="verification"
              eyebrow="QR and verification"
              title="Every certificate can be checked by anyone, safely."
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
                  sizes="(min-width: 1024px) 440px, 100vw"
                  className="mx-auto max-w-md"
                />
              }
              footer={
                <p className="sr-body flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--sr-brand))]"
                    aria-hidden="true"
                  />
                  <span>
                    Firestore and Storage rules deny client access by default. Every private read and
                    write is authenticated server-side and scoped to the account that owns the record.
                  </span>
                </p>
              }
            />
          </div>
        </section>

        {/* --------------------------------------------------------- templates */}
        <section
          id="templates"
          className="sr-section sr-section-subtle"
          style={{ scrollMarginTop: '4rem' }}
        >
          <div className="sr-container">
            <SectionHeading
              eyebrow="Templates"
              title="Save a design once, reuse it every intake."
              lead="A template keeps the layout, the bound variables, and the certificate details together, so the next cohort only needs a new spreadsheet."
              align="center"
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templateDirections.map((template, index) => (
                <Reveal key={template.name} delay={index * 70}>
                  <article className="sr-card sr-card-lift h-full overflow-hidden">
                    <div className="p-4" style={{ background: template.wash }}>
                      <CertificateFace
                        accent={template.accent}
                        wash={template.wash}
                        label={template.label}
                        className="rounded-md shadow-[var(--sr-shadow-2)]"
                      />
                    </div>
                    <div className="border-t border-[rgb(var(--sr-line))] p-5">
                      <h3 className="sr-h3">{template.name}</h3>
                      <p className="sr-body mt-1 text-sm">{template.note}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-10 text-center">
              <p className="sr-hint">
                Illustrative directions, not stock artwork. Template browsing opens once you have an
                account.
              </p>
              <Link href="/signup" className="sr-btn sr-btn-secondary mt-4">
                Create an account to browse templates
              </Link>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------------- use cases */}
        <section className="sr-section">
          <div className="sr-container">
            <SectionHeading
              eyebrow="Who it is for"
              title="Built for the people who issue certificates in batches."
              lead="If recognition currently means editing the same file once per person, this is the part Serenity replaces."
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map((useCase, index) => (
                <Reveal key={useCase.audience} delay={(index % 4) * 60}>
                  <UseCaseCard {...useCase} />
                </Reveal>
              ))}
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
        <section id="faq" className="sr-section" style={{ scrollMarginTop: '4rem' }}>
          <script {...jsonLd(faqPageSchema(faqs))} />
          <div className="sr-container">
            <div className="mx-auto max-w-3xl">
              <SectionHeading eyebrow="FAQ" title="Frequently asked questions" align="center" />
              <dl className="mt-10 divide-y divide-[rgb(var(--sr-line))]">
                {faqs.map((item, index) => (
                  <Reveal key={item.question} delay={(index % 3) * 50}>
                    <div className="py-6">
                      <dt className="sr-h3">{item.question}</dt>
                      <dd className="sr-body mt-2">{item.answer}</dd>
                    </div>
                  </Reveal>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- final CTA */}
        <section className="sr-section sr-section-deep">
          <Reveal className="sr-container text-center">
            <div className="mx-auto max-w-2xl">
            <h2 className="sr-h2">Issue your next batch with verification built in.</h2>
            <p className="sr-lead mt-4">
              Create a free account and take one certificate all the way from a blank canvas to a
              verification page.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="sr-btn sr-btn-primary">
                Create a free account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="sr-btn sr-btn-secondary">
                Sign in
              </Link>
            </div>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
