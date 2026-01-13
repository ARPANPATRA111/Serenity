'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Theme Toggle Button
 * Switches between "Neon Future" (dark) and "Academic Gold" (light) themes
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="toolbar-button"
        aria-label="Toggle theme"
        disabled
      >
        <div className="h-5 w-5" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="toolbar-button group relative"
      aria-label={`Switch to ${isDark ? 'Academic Gold (light)' : 'Neon Future (dark)'} theme`}
      title={isDark ? 'Switch to Academic Gold' : 'Switch to Neon Future'}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-accent transition-transform group-hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 text-primary transition-transform group-hover:-rotate-12" />
      )}
    </button>
  );
}
