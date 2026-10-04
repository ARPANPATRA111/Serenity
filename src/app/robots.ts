import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity-certificate.vercel.app';

/**
 * Crawl policy.
 *
 * Public marketing/product pages are crawlable. Private application
 * surfaces and API routes are disallowed. Per-recipient verification
 * pages (/verify/<id>) are intentionally NOT disallowed here so their
 * links stay followable; they instead carry `noindex, follow` metadata
 * (see src/app/verify/[id]/page.tsx) to keep recipient data out of the
 * index without blocking crawl of the verification concept.
 *
 * A per-AI-crawler policy (e.g. GPTBot / OAI-SearchBot / ClaudeBot /
 * PerplexityBot) is deliberately left to an operator decision informed
 * by each crawler's current official documentation, rather than guessed
 * here. The default below applies to all user agents.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/editor',
          '/settings',
          '/history',
          '/my-templates',
          '/auth/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
