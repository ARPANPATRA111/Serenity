import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter, Space_Grotesk } from 'next/font/google';
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
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

/**
 * Display face for the public marketing and authentication pages only.
 *
 * The variable is declared on `<body>` so the class is available everywhere,
 * but it is referenced solely from `.sr-scope`, so the authenticated
 * application keeps Space Grotesk and its type does not shift.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-marketing',
  weight: ['600', '700', '800'],
  display: 'swap',
  fallback: ['Space Grotesk', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
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
        className={`${inter.variable} ${spaceGrotesk.variable} ${bricolage.variable} font-sans antialiased`}
      >
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
