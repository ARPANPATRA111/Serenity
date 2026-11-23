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
  { href: '/features', label: 'Product' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/llms.txt', label: 'llms.txt' },
];

const columns = [
  { id: 'footer-product', title: 'Product', links: productLinks },
  { id: 'footer-learn', title: 'Learn', links: learnLinks },
  { id: 'footer-account', title: 'Account', links: accountLinks },
];

/**
 * Footer: open, on the same paper as the page rather than a dark slab; the
 * generous top space keeps it clear of the last section.
 */
export function MarketingFooter() {
  return (
    <footer className="sr-footer">
      <div className="sr-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <SerenityBrand stacked />
            <p className="sr-body mt-5 max-w-xs">
              Design once, personalise from a spreadsheet and give every recipient a certificate anyone can verify.
            </p>
            <Link href="/signup" className="sr-btn sr-btn-primary mt-7">Create certificates</Link>
          </div>

          {columns.map((column) => (
            <nav key={column.id} aria-labelledby={column.id}>
              <h2 id={column.id} className="sr-footer-head">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="footer-link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="footer-base mt-14">
          <p className="sr-hint">© 2026 Serenity Certificate Generator</p>
          <p className="sr-hint">Verification pages show only public-safe fields.</p>
        </div>
      </div>
    </footer>
  );
}
