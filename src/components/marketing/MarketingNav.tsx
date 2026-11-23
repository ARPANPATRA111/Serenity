'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, LogOut, Menu, Plus, Settings, X } from 'lucide-react';
import { SerenityBrand } from '@/components/brand/SerenityBrand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { EVENTS_ENABLED } from '@/lib/featureFlags';
import '@/styles/marketing.css';

const publicLinks = [
  { href: '/features', label: 'Product' },
  { href: '/templates', label: 'Templates' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

const studioLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-templates', label: 'My templates' },
  { href: '/templates', label: 'Templates' },
  { href: '/history', label: 'History' },
  ...(EVENTS_ENABLED ? [{ href: '/events', label: 'Events' }] : []),
];

/**
 * The one navigation bar used on every page that has one: the public pages,
 * the template gallery and every signed-in page. The editor and the public
 * verification pages deliberately have none.
 *
 * Signed out it offers the product pages, Log in and Create certificates;
 * signed in it offers the studio pages, New Certificate and the account
 * menu. Both share one layout, one style and one mobile menu.
 *
 * The header carries its own `sr-scope`, so it brings its design tokens to
 * any page it sits on.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const signedIn = Boolean(user);
  const links = signedIn ? studioLinks : publicLinks;
  const isCurrent = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`));

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

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || 'U';

  return (
    <header className="sr-scope sr-nav sticky top-0 z-50">
      <nav className="sr-container flex h-16 items-center justify-between gap-3" aria-label="Primary">
        <Link
          href={signedIn ? '/dashboard' : '/'}
          className="shrink-0 rounded-lg"
          aria-label="Serenity Certificate Generator — home"
        >
          <SerenityBrand stacked className="hidden sm:inline-flex" />
          <SerenityBrand compact className="sm:hidden" />
        </Link>

        <ul className="hidden items-center gap-1 xl:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="sr-btn sr-btn-quiet sr-nav-link whitespace-nowrap text-sm"
                aria-current={isCurrent(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* While the session is being restored the actions hold their
              space, so the bar does not jump between the two layouts. */}
          {isLoading && !signedIn ? (
            <span className="sr-nav-placeholder" aria-hidden="true" />
          ) : signedIn ? (
            <>
              <Link href="/editor" className="sr-btn sr-btn-primary shrink-0 whitespace-nowrap text-sm" aria-label="New Certificate">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">New Certificate</span>
              </Link>
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  className="sr-account"
                  aria-expanded={accountOpen}
                >
                  <span className="sr-avatar" aria-hidden="true">{initial}</span>
                  <span className="hidden max-w-[8rem] truncate text-sm font-semibold lg:inline">{user?.name || 'Account'}</span>
                  <span className="sr-only lg:hidden">{user?.name || 'Account'}</span>
                </button>
                {accountOpen && (
                  <div className="sr-account-menu">
                    <div className="sr-account-head">
                      <p className="flex items-center gap-2 truncate font-semibold">
                        {user?.name}
                        {user?.isPremium && <span className="sr-pro"><Crown className="h-3 w-3" aria-hidden="true" />PRO</span>}
                      </p>
                      <p className="sr-hint truncate">{user?.email}</p>
                    </div>
                    {!user?.isPremium && (
                      <Link href="/premium" className="sr-account-item is-upgrade">
                        <Crown className="h-4 w-4" aria-hidden="true" /> Upgrade to Premium
                      </Link>
                    )}
                    <Link href="/settings" className="sr-account-item">
                      <Settings className="h-4 w-4" aria-hidden="true" /> Settings
                    </Link>
                    <button
                      type="button"
                     
                      className="sr-account-item is-danger"
                      onClick={() => {
                        setAccountOpen(false);
                        logout();
                      }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="hidden sm:block">
                <Link href="/login" className="sr-btn sr-btn-quiet text-sm">
                  Log in
                </Link>
              </div>
              <Link href="/signup" className="sr-btn sr-btn-primary shrink-0 whitespace-nowrap text-sm">
                Create certificates
              </Link>
            </>
          )}

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

      <span className="sr-progress" aria-hidden="true" />

      {open && (
        <div id="marketing-menu" className="sr-menu-panel bg-[rgb(var(--sr-canvas))] xl:hidden">
          <ul className="sr-container flex flex-col gap-1 py-4">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="sr-btn sr-btn-quiet w-full justify-start text-base"
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {!signedIn && (
              <li className="mt-2">
                <Link href="/login" onClick={() => setOpen(false)} className="sr-btn sr-btn-secondary w-full">
                  Log in
                </Link>
              </li>
            )}
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

/** Earlier name, kept so existing imports keep working. */
export const MarketingNav = SiteNav;
