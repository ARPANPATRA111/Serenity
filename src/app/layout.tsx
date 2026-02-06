import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { FirebaseProvider } from '@/components/providers/FirebaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import type { FirebaseConfig } from '@/lib/firebase/client';
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

export const metadata: Metadata = {
  title: 'Serenity - Certificate Generator',
  description: 'Professional certificate generator with bulk processing, verification, and email delivery.',
  keywords: ['certificate', 'generator', 'bulk', 'PDF', 'verification'],
  authors: [{ name: 'Serenity' }],
  openGraph: {
    title: 'Serenity - Certificate Generator',
    description: 'Professional certificate generator with bulk processing, verification, and email delivery.',
    type: 'website',
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
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          <FirebaseProvider config={firebaseConfig}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
