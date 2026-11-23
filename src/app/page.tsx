import Link from 'next/link';
import { ArrowRight, Check, Eye, Link2, QrCode, ShieldCheck } from 'lucide-react';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { HeroShowcase, type ShowcaseSlide } from '@/components/marketing/HeroShowcase';
import { CertificateSprite, certificateSymbolId } from '@/components/marketing/CertificateSprite';
import { TemplateMarquee } from '@/components/marketing/TemplateMarquee';
import { DeliverArt, DesignArt, ImportArt, VerifyArt } from '@/components/marketing/Illustrations';
import { Reveal } from '@/components/marketing/Reveal';
import { GuillocheSeal } from '@/components/brand/GuillocheSeal';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';
import { CERTIFICATE_DESIGNS } from '@/lib/templates/certificateDesigns';

/**
 * Public landing page: the product in one screenful each — what it makes,
 * how it works, what the library looks like, and how a certificate proves
 * itself. The detail lives on /features, /how-it-works, /pricing and /faq.
 *
 * Every certificate shown is a real curated template rendered from the same
 * definition the editor opens, with synthetic recipient names. No invented
 * social proof, ratings or usage counts.
 */

const slides: ShowcaseSlide[] = CERTIFICATE_DESIGNS.map((design) => ({
  symbolId: certificateSymbolId(design.id),
  templateId: design.id,
  templateName: design.name,
  category: design.category,
  recipient: design.sampleName,
}));

const steps = [
  { art: DesignArt, title: 'Design once', body: 'Lay out one reusable certificate with your logo, signatures and seal.' },
  { art: ImportArt, title: 'Import a spreadsheet', body: 'Each CSV or Excel row becomes its own personalised PDF.' },
  { art: DeliverArt, title: 'Deliver and verify', body: 'Download the batch or email it. Every certificate carries a QR code.' },
];

const proofs = [
  { icon: Link2, label: 'A permanent public link on every certificate' },
  { icon: QrCode, label: 'A QR code for printed copies' },
  { icon: Eye, label: 'Only public-safe fields are ever shown' },
];

export default function HomePage() {
  return (
    <MarketingPage>
      <CertificateSprite />

      {/* ---------------------------------------------------------------- hero */}
      <section className="press-hero">
        <div className="sr-container press-spread">
          <div className="press-intro">
            <p className="press-product">Serenity Certificate Generator</p>
            <h1 aria-label="Certificates worth keeping.">
              {['Certificates', 'worth', 'keeping.'].map((word, index) => (
                <span key={word} className="press-word" aria-hidden="true">
                  <span style={{ animationDelay: `${120 + index * 110}ms` }}>{word}</span>
                </span>
              ))}
            </h1>
            <p className="sr-lead">
              Turn a spreadsheet into personalised PDF certificates, each with a QR code anyone can verify.
            </p>
            <div className="press-actions">
              <Link href="/signup" className="sr-btn sr-btn-primary">Create certificates</Link>
              <Link href="/templates" className="sr-btn sr-btn-secondary">Explore templates</Link>
            </div>
            <p className="press-allowance">
              <Check size={16} aria-hidden="true" /> Your first {FREE_CERTIFICATE_LIMIT} certificates are free.
            </p>
          </div>
          <HeroShowcase slides={slides} />
        </div>
      </section>

      {/* --------------------------------------------------------------- steps */}
      <section className="sr-section" aria-labelledby="steps-title">
        <div className="sr-container">
          <Reveal className="section-head">
            <h2 id="steps-title" className="sr-h2">From spreadsheet to signed, sealed and verifiable.</h2>
          </Reveal>
          <ol className="step-grid">
            {steps.map(({ art: Art, title, body }, index) => (
              <Reveal as="li" key={title} delay={index * 90} className="step">
                <Art className="step-art" />
                <h3 className="sr-h3 mt-6">{title}</h3>
                <p className="sr-body mt-2">{body}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="section-more">
            <Link href="/how-it-works" className="sr-link inline-flex items-center gap-1.5">
              See the full workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- templates */}
      <section id="templates" className="sr-section sr-section-flush" aria-labelledby="templates-title">
        <div className="sr-container">
          <Reveal className="section-head">
            <h2 id="templates-title" className="sr-h2">Designs worth printing.</h2>
            <p className="sr-lead mt-4">Start from a finished template and make it yours in the editor.</p>
          </Reveal>
        </div>
        <TemplateMarquee />
        <div className="sr-container">
          <Reveal className="section-more">
            <Link href="/templates" className="sr-link inline-flex items-center gap-1.5">
              Browse all templates <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- verification */}
      <section className="sr-section" aria-labelledby="verify-title">
        <div className="sr-container verify-split">
          <Reveal>
            <VerifyArt className="verify-art" />
          </Reveal>
          <Reveal delay={90}>
            <h2 id="verify-title" className="sr-h2">Every certificate can prove it is genuine.</h2>
            <ul className="proof-list">
              {proofs.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <span className="proof-list-icon"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  {label}
                </li>
              ))}
            </ul>
            <Link href="/features#verification" className="sr-link mt-8 inline-flex items-center gap-1.5">
              How verification works <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------------- closing */}
      <section className="closing" aria-labelledby="closing-title">
        <GuillocheSeal id="closing-seal" className="closing-rosette" />
        <Reveal className="sr-container closing-inner">
          <ShieldCheck className="closing-icon" aria-hidden="true" />
          <h2 id="closing-title" className="sr-h2">Your next batch starts with one design.</h2>
          <div className="closing-actions">
            <Link href="/signup" className="sr-btn sr-btn-primary">Start for free</Link>
            <Link href="/pricing" className="sr-btn sr-btn-secondary">See pricing</Link>
          </div>
        </Reveal>
      </section>
    </MarketingPage>
  );
}
