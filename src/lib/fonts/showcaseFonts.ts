import { Pinyon_Script } from 'next/font/google';

/**
 * The calligraphic face several certificate designs use for the recipient's
 * name. Loaded only by the public pages that draw certificate proofs.
 */
export const scriptFont = Pinyon_Script({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
  display: 'swap',
  fallback: ['Brush Script MT', 'Segoe Script', 'cursive'],
});
