import type { Metadata } from 'next';

export const metadata: Metadata = {
  // An object title keeps the site suffix on the certificate pages below.
  title: { default: 'Verify a certificate', template: '%s | Serenity Certificate Generator' },
  alternates: { canonical: '/verify' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
