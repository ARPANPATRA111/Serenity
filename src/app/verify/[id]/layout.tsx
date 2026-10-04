import type { Metadata } from 'next';

// Every per-certificate response stays out of search indexes, including the
// "not found" page an unknown ID renders (the page itself sets noindex for
// valid and revoked certificates).
export const metadata: Metadata = {
  title: { default: 'Verify certificate', template: '%s | Serenity Certificate Generator' },
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
