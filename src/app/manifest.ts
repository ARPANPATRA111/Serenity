import type { MetadataRoute } from 'next';

/**
 * Minimal, honest web manifest. Uses the branded scalable SVG icon
 * (app/icon.svg, served at /icon.svg). Raster PWA icons (192/512 PNG)
 * can be added later for install prompts on browsers that require them.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Serenity Certificate Generator',
    short_name: 'Serenity',
    description:
      'Design, personalize from a spreadsheet, email, and verify certificates in bulk.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
