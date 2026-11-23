import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Template library',
  alternates: { canonical: '/templates' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
