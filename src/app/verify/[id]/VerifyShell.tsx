import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SerenityBrand } from '@/components/brand/SerenityBrand';

/**
 * Shared frame for every verification state, usable from server and client
 * boundaries. A public record needs no site navigation: just the mark (home)
 * and the theme switch, out of the way of the certificate.
 */
export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Serenity home"><SerenityBrand /></Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-16">
        {children}

        <div className="mt-12 text-center">
          <Link href="/verify" className="text-sm font-medium text-primary hover:underline">
            Verify another certificate
          </Link>
          <p className="mt-6 text-sm text-muted-foreground">Create your own verifiable certificates with</p>
          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-2 font-display font-semibold text-primary hover:underline"
          >
            Serenity Certificate Generator
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
