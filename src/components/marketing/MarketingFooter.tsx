import Link from 'next/link';
import { SerenityBrand } from '@/components/brand/SerenityBrand';
import { EVENTS_ENABLED } from '@/lib/featureFlags';

const productLinks = [
  { href: '/templates', label: 'Template library' },
  { href: '/verify', label: 'Verify a certificate' },
  { href: '/editor', label: 'Certificate editor' },
  ...(EVENTS_ENABLED ? [{ href: '/events', label: 'Events' }] : []),
];

const accountLinks = [
  { href: '/signup', label: 'Create an account' },
  { href: '/login', label: 'Sign in' },
  { href: '/forgot-password', label: 'Reset password' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas-subtle))]">
      <div className="sr-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <SerenityBrand />
          <p className="sr-body mt-4 max-w-sm">
            Serenity Certificate Generator designs, personalizes, generates, delivers, and
            verifies certificates from a single reusable template.
          </p>
        </div>

        <nav aria-labelledby="footer-product">
          <h2 id="footer-product" className="text-sm font-bold">
            Product
          </h2>
          <ul className="mt-4 space-y-3">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="sr-body inline-flex min-h-6 items-center hover:text-[rgb(var(--sr-ink))]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-account">
          <h2 id="footer-account" className="text-sm font-bold">
            Account
          </h2>
          <ul className="mt-4 space-y-3">
            {accountLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="sr-body inline-flex min-h-6 items-center hover:text-[rgb(var(--sr-ink))]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-[rgb(var(--sr-line))]">
        <div className="sr-container flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="sr-hint">© 2026 Serenity Certificate Generator</p>
          <p className="sr-hint">
            Recipient verification pages show only public-safe fields.
          </p>
        </div>
      </div>
    </footer>
  );
}
