import { describe, expect, test } from 'vitest';
import { parseTemplateFile } from '@/lib/fabric/templateSerialization';
import { GOOGLE_FONTS } from '@/lib/fonts/googleFonts';
import { CERTIFICATE_DESIGNS } from '@/lib/templates/certificateDesigns';
import { curatedPublicTemplates, getCuratedPublicTemplate } from '@/lib/templates/curatedPublicTemplates';
import { toProofDataUri, toProofSymbol } from '@/lib/templates/designKit';

const KNOWN_TYPES = new Set(['rect', 'ellipse', 'textbox', 'variableTextbox']);

describe('curated certificate designs', () => {
  test('keep the ids earlier links and saved bookmarks open', () => {
    for (const id of ['academic-course', 'workshop', 'training', 'achievement', 'employee', 'event', 'hackathon', 'minimal']) {
      expect(getCuratedPublicTemplate(`bundled-${id}`), id).not.toBeNull();
    }
    expect(getCuratedPublicTemplate('bundled-honours')).not.toBeNull();
  });

  test.each(CERTIFICATE_DESIGNS.map((design) => [design.id, design] as const))(
    '%s is a valid editable template with one name field and one locked verification link',
    (_, design) => {
      const template = curatedPublicTemplates.find((entry) => entry.id === design.id)!;
      const result = parseTemplateFile(template.canvasJSON, { isKnownType: (type) => KNOWN_TYPES.has(type) });
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
      if (!result.ok) return;

      const objects = result.template.objects as Array<Record<string, unknown>>;
      expect(objects.filter((object) => object.dynamicKey === 'Name')).toHaveLength(1);
      const links = objects.filter((object) => object.isVerificationUrl);
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({ isLocked: true, editable: false, text: '{{VERIFICATION_URL}}' });
    },
  );

  test('only use fonts the editor can load', () => {
    const loadable = new Set(GOOGLE_FONTS.map((font) => font.name));
    for (const template of curatedPublicTemplates.filter((entry) => entry.id !== 'bundled-honours')) {
      const objects = JSON.parse(template.canvasJSON).objects as Array<{ fontFamily?: string }>;
      for (const family of Array.from(new Set(objects.map((object) => object.fontFamily).filter(Boolean)))) {
        expect(loadable.has(family!), `${template.id} uses ${family}`).toBe(true);
      }
    }
  });

  test('proofs render synthetic values and escape them', () => {
    const [design] = CERTIFICATE_DESIGNS;
    const uri = decodeURIComponent(toProofDataUri(design, 'Ada <Lovelace> & Co'));
    expect(uri).toContain('Ada &lt;Lovelace&gt; &amp; Co');
    expect(uri).not.toContain('{{Name}}');
    const symbol = toProofSymbol(design, 'cert-test');
    expect(symbol).toContain(`id="cert-test"`);
    expect(symbol).toContain(design.sampleName);
    expect(symbol).toContain('class="cert-');
  });
});
