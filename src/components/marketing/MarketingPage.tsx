import type { ReactNode } from 'react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { GuillocheSeal } from '@/components/brand/GuillocheSeal';
import { scriptFont } from '@/lib/fonts/showcaseFonts';
import '@/styles/marketing.css';

/**
 * Shell for every public page: the skip link, the bar, an optional page
 * header, the content and the footer, all on the shared paper backdrop.
 */
export function MarketingPage({
  title,
  lead,
  art,
  children,
}: {
  title?: string;
  lead?: string;
  art?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`sr-scope sr-shell ${scriptFont.variable}`}>
      <a
        href="#main"
        className="sr-btn sr-btn-primary sr-skip absolute left-4 top-4 z-[60] -translate-y-24 focus:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main">
        {title && (
          <header className="page-hero">
            <GuillocheSeal id="page-seal" className="page-hero-rosette" draw />
            <div className="sr-container page-hero-grid">
              <div>
                <h1 className="page-hero-title">{title}</h1>
                {lead && <p className="sr-lead page-hero-lead">{lead}</p>}
              </div>
              {art && <div className="page-hero-art">{art}</div>}
            </div>
          </header>
        )}
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
