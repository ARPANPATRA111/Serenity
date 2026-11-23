import Link from 'next/link';
import { CERTIFICATE_DESIGNS } from '@/lib/templates/certificateDesigns';
import { certificateSymbolId } from './CertificateSprite';

/**
 * Two rows of finished certificates drifting in opposite directions. Each one
 * opens the design in the editor. The second copy of each row only makes the
 * loop seamless, so it is hidden from assistive technology and the tab order.
 * Hover or focus pauses a row; reduced motion stops it.
 */
export function TemplateMarquee() {
  const half = Math.ceil(CERTIFICATE_DESIGNS.length / 2);
  const rows = [CERTIFICATE_DESIGNS.slice(0, half), CERTIFICATE_DESIGNS.slice(half)];

  return (
    <div className="tpl-marquee">
      {rows.map((designs, row) => (
        <div key={row} className={`tpl-row ${row ? 'is-reverse' : ''}`}>
          {[0, 1].map((copy) => (
            <ul key={copy} className="tpl-track" aria-hidden={copy === 1 || undefined}>
              {designs.map((design) => (
                <li key={design.id} className="tpl-item">
                  <Link
                    href={`/editor?template=${design.id}`}
                    tabIndex={copy === 1 ? -1 : undefined}
                  >
                    <svg viewBox="0 0 842 595" role="img" aria-label={`${design.name} template`}>
                      <use href={`#${certificateSymbolId(design.id)}`} />
                    </svg>
                    <span className="tpl-name">{design.name}</span>
                    <span className="tpl-category">{design.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      ))}
    </div>
  );
}
