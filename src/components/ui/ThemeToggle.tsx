'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

/**
 * Light/dark switch.
 *
 * The theme changes on the same frame as the click. The previous version ran
 * a full-page View Transition (snapshot the page, swap, then a 560 ms circular
 * reveal), so the new theme only finished arriving about a second later on a
 * page with a fixed backdrop and blurred bars. The knob still slides; the page
 * itself swaps instantly.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      disabled={!mounted}
      className={cn('theme-toggle-button', className)}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className={`theme-toggle-thumb ${isDark ? 'is-dark' : ''}`}>
          {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </span>
      </span>
    </button>
  );
}
