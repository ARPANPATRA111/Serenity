import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset your password',
  alternates: { canonical: '/forgot-password' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
