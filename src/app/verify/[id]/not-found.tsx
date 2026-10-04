import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { VerifyShell } from './VerifyShell';

export default function VerifyNotFound() {
  return (
    <VerifyShell>
      <section className="mx-auto max-w-xl text-center" aria-labelledby="not-found-heading">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-warning/15">
          <SearchX className="h-10 w-10 text-warning" aria-hidden="true" />
        </div>
        <h1 id="not-found-heading" className="font-display text-3xl font-bold">Certificate not found</h1>
        <p className="mt-4 text-muted-foreground">
          No certificate matches this verification link.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5 text-left sm:p-6">
          <h2 className="font-semibold">Things to check</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>If you typed the link from a printed certificate, compare it character by character. IDs are case-sensitive.</li>
            <li>If the certificate was issued moments ago, wait a minute and reload this page.</li>
            <li>If you still cannot verify it, contact the organisation that issued the certificate.</li>
          </ul>
        </div>

        <Link href="/verify" className="btn-primary mt-8 inline-flex min-h-11 px-6">
          Check another certificate
        </Link>
      </section>
    </VerifyShell>
  );
}
