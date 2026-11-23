import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--color-secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          foreground: 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
          foreground: 'rgb(var(--color-card-foreground) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        input: 'rgb(var(--color-input) / <alpha-value>)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        // `text-destructive` / `bg-destructive/10` were used across the app
        // without a definition, so sign-out and error states rendered uncoloured.
        destructive: 'rgb(var(--color-error) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          foreground: 'rgb(var(--color-ink-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Headlines across the public pages and the signed-in app share the
        // Bodoni display cut; body copy and controls stay in Instrument Sans.
        display: ['var(--font-serif)', 'Georgia', 'serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      // A tighter radius scale: controls 10px, cards 14px, sheets 20px. The
      // previous 12/16/24 steps read soft and toy-like next to the Didone type.
      borderRadius: {
        xl: '0.625rem',
        '2xl': '0.875rem',
        '3xl': '1.25rem',
      },
      // Shadows are tinted with the ink colour and kept low; elevation is
      // mostly carried by hairline borders.
      boxShadow: {
        sm: '0 1px 2px rgb(var(--shadow-ink) / 0.06)',
        DEFAULT: '0 1px 2px rgb(var(--shadow-ink) / 0.06), 0 2px 6px rgb(var(--shadow-ink) / 0.04)',
        md: '0 1px 2px rgb(var(--shadow-ink) / 0.05), 0 6px 16px -4px rgb(var(--shadow-ink) / 0.10)',
        lg: '0 2px 4px rgb(var(--shadow-ink) / 0.05), 0 14px 32px -8px rgb(var(--shadow-ink) / 0.16)',
        xl: '0 2px 6px rgb(var(--shadow-ink) / 0.05), 0 24px 48px -12px rgb(var(--shadow-ink) / 0.20)',
        '2xl': '0 4px 10px rgb(var(--shadow-ink) / 0.06), 0 36px 72px -16px rgb(var(--shadow-ink) / 0.28)',
        'glow-sm': '0 0 10px rgba(var(--color-primary), 0.3)',
        'glow-md': '0 0 20px rgba(var(--color-primary), 0.4)',
        'glow-lg': '0 0 40px rgba(var(--color-primary), 0.5)',
        'glow-accent': '0 0 20px rgba(var(--color-accent), 0.4)',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
      },
    },
  },
  plugins: [],
};

export default config;
