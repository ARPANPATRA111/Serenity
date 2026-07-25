import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity-certificate.vercel.app';

/**
 * Only stable, public marketing/product pages are listed. Per-recipient
 * verification pages are intentionally excluded (thin/duplicate content
 * and recipient privacy). `/editor`, `/dashboard`, and other private app
 * surfaces are excluded as non-indexable application routes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/templates', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/verify', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/login', priority: 0.4, changeFrequency: 'yearly' },
    { path: '/signup', priority: 0.5, changeFrequency: 'yearly' },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
