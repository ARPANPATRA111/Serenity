'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { SerenityBrand } from '@/components/brand/SerenityBrand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const links = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#editor', label: 'Product' },
  { href: '#verification', label: 'Verification' },
  { href: '#templates', label: 'Templates' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  // The panel takes the whole small viewport, so the page behind it must not
  // scroll, and Escape has to return focus to the page.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas)/0.88)] backdrop-blur-md">
      <nav
        className="sr-container flex h-16 items-center justify-between gap-3"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="shrink-0 rounded-lg"
          aria-label="Serenity Certificate Generator — home"
        >
          <SerenityBrand />
        </Link>

        <ul className="hidden items-center gap-1 xl:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="sr-btn sr-btn-quiet text-sm">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
          {/* Wrappers carry the responsive display so Tailwind's utility never
              has to out-specify the `.sr-btn` display rule. Below `sm` the bar
              would squeeze the CTA onto two lines, so the toggle and "Sign in"
              move into the menu panel and the CTA keeps its single line. */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <div className="hidden sm:block">
            <Link href="/login" className="sr-btn sr-btn-quiet text-sm">
              Sign in
            </Link>
          </div>
          <Link
            href="/signup"
            className="sr-btn sr-btn-primary shrink-0 whitespace-nowrap text-sm"
          >
            Start free
          </Link>
          <div className="xl:hidden">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="sr-btn sr-btn-secondary sr-btn-icon"
              aria-expanded={open}
              aria-controls="marketing-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <div
          id="marketing-menu"
          className="border-t border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas))] xl:hidden"
        >
          <ul className="sr-container flex flex-col gap-1 py-4">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="sr-btn sr-btn-quiet w-full justify-start text-base"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="mt-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="sr-btn sr-btn-secondary w-full"
              >
                Sign in
              </Link>
            </li>
            {/* The bar drops the toggle below `sm`; the panel carries it there. */}
            <li className="mt-1 flex items-center justify-between px-3 py-2 sm:hidden">
              <span className="sr-body text-sm">Appearance</span>
              <ThemeToggle />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

