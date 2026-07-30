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
  { href: '/login', label: 'Log in' },
  { href: '/forgot-password', label: 'Reset password' },
  { href: '/dashboard', label: 'Dashboard' },
];

const learnLinks = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/llms.txt', label: 'llms.txt' },
];

/**
 * Footer sits on the inverted band in both themes, closing the page against
 * the same deep surface the template gallery uses.
 */
export function MarketingFooter() {
  return (
    <footer className="sr-footer sr-section-deep">
      <div className="sr-container grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <SerenityBrand stacked />
          <p className="sr-body mt-5 max-w-xs">
            Design one certificate, personalise it from a spreadsheet, deliver the batch, and give
            every recipient a link anyone can verify.
          </p>
        </div>

        <nav aria-labelledby="footer-product">
          <h2 id="footer-product" className="sr-footer-head">
            Product
          </h2>
          <ul className="mt-4 space-y-3">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-6 items-center text-[0.9375rem]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-account">
          <h2 id="footer-account" className="sr-footer-head">
            Account
          </h2>
          <ul className="mt-4 space-y-3">
            {accountLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-6 items-center text-[0.9375rem]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-learn">
          <h2 id="footer-learn" className="sr-footer-head">
            Learn
          </h2>
          <ul className="mt-4 space-y-3">
            {learnLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-6 items-center text-[0.9375rem]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-[rgb(var(--sr-deep-line))]">
        <div className="sr-container flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="sr-hint">© 2026 Serenity Certificate Generator</p>
          <p className="sr-hint">Recipient verification pages show only public-safe fields.</p>
        </div>
      </div>
    </footer>
  );
}
