import Link from 'next/link';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SerenityBrand } from '@/components/brand/SerenityBrand';
import '@/styles/marketing.css';

/**
 * Shared authentication layout.
 *
 * Login renders the form alone on a calm canvas; signup passes an `aside`
 * that becomes a benefits panel beside the form on wide screens and drops
 * *below* it on small ones, so the form is always what loads first.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  aside,
  footer,
  loading = false,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
}) {
  const split = Boolean(aside);

  return (
    <div className="sr-scope sr-shell flex min-h-screen flex-col">
      <header className="border-b border-[rgb(var(--sr-line))]">
        <div className="sr-container flex h-16 items-center justify-between">
          <Link href="/" className="rounded-lg" aria-label="Serenity Certificate Generator — home">
            <SerenityBrand />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="sr-hero flex flex-1 items-start py-10 sm:py-12">
        <div className="sr-container">
          <div className={split ? 'mx-auto max-w-4xl' : 'mx-auto max-w-md'}>
            <h1 className="sr-h1 text-[clamp(1.9rem,4.2vw,2.5rem)]">{title}</h1>
            <p className="sr-body mt-2">{subtitle}</p>
          </div>

          <div
            className={
              split
                ? 'mx-auto mt-8 grid max-w-4xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] lg:items-start lg:gap-14'
                : 'mx-auto mt-8 max-w-md'
            }
          >
            <div className="w-full">
              {loading ? (
                <div className="sr-card p-8 text-center">
                  <span
                    className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[rgb(var(--sr-brand-wash))] text-[rgb(var(--sr-brand))]"
                    aria-hidden="true"
                  >
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </span>
                  <p role="status" className="mt-4 font-semibold">
                    Restoring your signed-in session
                  </p>
                  <p className="sr-body mt-2">
                    You will be taken to your dashboard once Firebase confirms the session.
                  </p>
                </div>
              ) : (
                children
              )}

              {footer && <div className="mt-6">{footer}</div>}
            </div>

            {aside && <aside className="w-full">{aside}</aside>}
          </div>
        </div>
      </main>

      <footer className="border-t border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas-subtle))]">
        <div className="sr-container flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="sr-hint">© 2026 Serenity Certificate Generator</p>
          <p className="sr-hint">
            Authentication protects your private workspace and ownership-scoped data.
          </p>
        </div>
      </footer>
    </div>
  );
}
