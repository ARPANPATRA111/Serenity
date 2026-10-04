import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SerenityBrand } from '@/components/brand/SerenityBrand';

/** Shared frame for every verification state, usable from server and client boundaries. */
export function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-transparent px-3 pt-3 sm:px-5" aria-label="Site">
        <div className="app-nav-frame mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 shadow-xl backdrop-blur-2xl sm:px-6 lg:px-8">
          <Link href="/" aria-label="Serenity home"><SerenityBrand /></Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/verify" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Verify another
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-16">
        {children}

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">Create your own verifiable certificates with</p>
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
