import { CERTIFICATE_DESIGNS } from '@/lib/templates/certificateDesigns';
import { toProofSymbol } from '@/lib/templates/designKit';

export const certificateSymbolId = (templateId: string) => `cert-${templateId}`;

/**
 * Every curated design drawn once as an SVG <symbol>. The hero slideshow and
 * the template marquee reference these with <use>, so each certificate's
 * markup ships a single time however often it appears on the page.
 */
export function CertificateSprite() {
  const markup = CERTIFICATE_DESIGNS.map((design) => toProofSymbol(design, certificateSymbolId(design.id))).join('');
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: `<defs>${markup}</defs>` }}
    />
  );
}
