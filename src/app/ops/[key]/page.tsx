import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdminConsoleEnabled, matchesPathKey } from '@/lib/admin/config';
import { OpsConsole } from '@/components/console/OpsConsole';

export const dynamic = 'force-dynamic';

/**
 * The key check runs in generateMetadata because metadata resolves before the
 * response starts streaming; a check in the page alone would still answer 200
 * (inside the root loading boundary) with not-found content.
 */
export async function generateMetadata({ params }: { params: { key: string } }): Promise<Metadata> {
  if (!isAdminConsoleEnabled() || !matchesPathKey(params.key)) notFound();
  return {
    title: 'Serenity',
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: 'no-referrer',
  };
}

/**
 * The operator console. Anyone without the deployment's path key, or on a
 * deployment where the console is disabled, gets the ordinary 404 page.
 * Access to data is enforced separately by every console API route.
 */
export default function OpsPage({ params }: { params: { key: string } }) {
  if (!isAdminConsoleEnabled() || !matchesPathKey(params.key)) notFound();
  return <OpsConsole />;
}
