import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { FirebaseProvider } from '@/components/providers/FirebaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { Analytics } from '@vercel/analytics/next';
import type { FirebaseConfig } from '@/lib/firebase/client';
import {
  jsonLd,
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from '@/lib/seo/structuredData';
import { SiteBackdrop } from '@/components/brand/SiteBackdrop';
import './globals.css';

/**
 * Interface face: every label, control, table and paragraph.
 */
const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/**
 * Display face for headlines and certificate-like moments. Fraunces with its
 * "soft" axis raised: warm, rounded serifs that stay calm at large sizes.
 */
const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity-certificate.vercel.app';

const DESCRIPTION =
  'Serenity is a certificate generator for designing, personalizing from CSV/Excel, emailing, and verifying certificates in bulk — each with a permanent verification URL and QR code.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Serenity Certificate Generator — Create, Email & Verify Certificates in Bulk',
    template: '%s | Serenity Certificate Generator',
  },
  description: DESCRIPTION,
  applicationName: 'Serenity Certificate Generator',
  keywords: [
    'certificate generator',
    'bulk certificate generator',
    'certificate generator from Excel',
    'certificate generator from CSV',
    'certificate maker',
    'certificate verification',
    'QR certificate verification',
    'email certificates in bulk',
  ],
  authors: [{ name: 'Serenity' }],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Serenity Certificate Generator',
    url: '/',
    title: 'Serenity Certificate Generator — Create, Email & Verify Certificates in Bulk',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Serenity Certificate Generator',
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firebaseConfig: FirebaseConfig = {
    apiKey: process.env.FB_CREDENTIAL || '',
    authDomain: process.env.FB_AUTH_DOMAIN || '',
    projectId: process.env.FB_PROJECT || '',
    storageBucket: process.env.FB_BUCKET || '',
    messagingSenderId: process.env.FB_SENDER || '',
    appId: process.env.FB_APP || '',
    useEmulators: process.env.USE_FIREBASE_EMULATORS === 'true',
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script {...jsonLd(organizationSchema())} />
        <script {...jsonLd(websiteSchema())} />
        <script {...jsonLd(softwareApplicationSchema())} />
      </head>
      <body
        className={`${sans.variable} ${serif.variable} font-sans antialiased`}
      >
        <SiteBackdrop />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FirebaseProvider config={firebaseConfig}>
            <AuthProvider>
              {children}
              <Analytics />
            </AuthProvider>
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
