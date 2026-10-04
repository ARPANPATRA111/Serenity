/**
 * Response headers.
 *
 * Every route gets conservative baseline headers. Signed-in application pages
 * also refuse to be framed by other sites (clickjacking). Verification pages
 * are deliberately left frameable so issuers who embed them keep working. The
 * operator console refuses framing entirely and is never cached or indexed.
 */
const baselineHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const sameOriginFraming = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
];

const applicationRoutes = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/premium',
  '/auth/:path*',
  '/dashboard/:path*',
  '/editor/:path*',
  '/history/:path*',
  '/my-templates/:path*',
  '/templates/:path*',
  '/settings/:path*',
  '/events/:path*',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: baselineHeaders },
      ...applicationRoutes.map((source) => ({ source, headers: sameOriginFraming })),
      {
        source: '/ops/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/api/console/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
