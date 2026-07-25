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
        <Link href="/" className="rounded-lg" aria-label="Serenity Certificate Generator â€” home">
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Wrappers carry the responsive display so Tailwind's utility never
              has to out-specify the `.sr-btn` display rule. */}
          <div className="hidden sm:block">
            <Link href="/login" className="sr-btn sr-btn-quiet text-sm">
              Sign in
            </Link>
          </div>
          <Link href="/signup" className="sr-btn sr-btn-primary h-10 min-h-10 text-sm">
            Start free
          </Link>
          <div className="xl:hidden">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="sr-btn sr-btn-secondary h-10 min-h-10 w-10 px-0"
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
          </ul>
        </div>
      )}
    </header>
  );
}

