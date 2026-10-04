/**
 * JSON-LD structured data builders.
 *
 * Only facts that are supported by visible, server-rendered content are
 * emitted. No aggregateRating, reviews, fake customers, or unsupported
 * pricing are included. The free tier is genuinely $0, so a single $0
 * Offer is accurate; Pro is intentionally omitted (arranged via contact).
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity-certificate.vercel.app';

const NAME = 'Serenity Certificate Generator';
const DESCRIPTION =
  'Serenity is a certificate generator for designing, personalizing from CSV/Excel, emailing, and verifying certificates in bulk — each with a permanent verification URL and QR code.';
const REPO_URL = 'https://github.com/ARPANPATRA111/Serenity';

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Serenity',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    sameAs: [REPO_URL],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: NAME,
    url: SITE_URL,
  };
}

export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: NAME,
    description: DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    // Free tier is genuinely $0; Pro is arranged via contact and is not asserted here.
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** Renderable <script> props for a JSON-LD object. */
export function jsonLd(schema: object) {
  return {
    type: 'application/ld+json' as const,
    dangerouslySetInnerHTML: { __html: JSON.stringify(schema) },
  };
}
