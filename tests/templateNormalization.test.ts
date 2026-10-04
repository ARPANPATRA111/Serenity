import { describe, expect, test } from 'vitest';
import { normalizeTemplateJSON, substituteInlineTokens } from '../src/lib/fabric/templateNormalization';
import { curatedPublicTemplates } from '../src/lib/templates/curatedPublicTemplates';

describe('normalizeTemplateJSON', () => {
  test('adds the styles Fabric needs to serialise hand-written text objects', () => {
    const normalized = normalizeTemplateJSON({
      objects: [
        { type: 'textbox', text: 'Title' },
        { type: 'i-text', text: 'Subtitle', styles: [] },
        { type: 'rect' },
      ],
    });
    expect(normalized.objects![0]).toMatchObject({ styles: [] });
    expect(normalized.objects![1]).toMatchObject({ styles: [] });
    expect(normalized.objects![2]).not.toHaveProperty('styles');
  });

  test('turns dynamic placeholders into variable text boxes, whatever their stored type', () => {
    const normalized = normalizeTemplateJSON({
      objects: [
        { type: 'textbox', text: '{{Name}}', dynamicKey: 'Name' },
        { type: 'VariableTextbox', text: '{{Course}}', dynamicKey: 'Course' },
        { type: 'textbox', text: 'Plain', dynamicKey: '' },
      ],
    });
    expect(normalized.objects!.map((object) => (object as { type: string }).type)).toEqual(['variableTextbox', 'variableTextbox', 'textbox']);
  });

  test('recurses into groups, fixes the textBaseline typo, and is idempotent', () => {
    const input = { objects: [{ type: 'group', objects: [{ type: 'textbox', text: 'In group', textBaseline: 'alphabetical' }] }] };
    const once = normalizeTemplateJSON(input);
    const twice = normalizeTemplateJSON(once);
    expect(twice).toEqual(once);
    expect((once.objects![0] as { objects: unknown[] }).objects[0]).toMatchObject({ styles: [], textBaseline: 'alphabetic' });
    // The input is not mutated.
    expect((input.objects[0].objects[0] as Record<string, unknown>).styles).toBeUndefined();
  });

  test('every curated gallery template loads with serialisable text and real variables', () => {
    for (const template of curatedPublicTemplates) {
      const normalized = normalizeTemplateJSON(template.canvasJSON);
      const texts = (normalized.objects as Array<Record<string, unknown>>).filter((object) => /text/i.test(String(object.type)));
      expect(texts.every((object) => Array.isArray(object.styles) || typeof object.styles === 'object')).toBe(true);
      const placeholders = texts.filter((object) => object.dynamicKey);
      expect(placeholders.length, template.name).toBeGreaterThan(0);
      expect(placeholders.every((object) => object.type === 'variableTextbox')).toBe(true);
    }
  });
});

describe('substituteInlineTokens', () => {
  test('matches the editor preview: case-insensitive keys, unknown tokens kept', () => {
    expect(substituteInlineTokens('Presented by {{Issuer}} on {{date}}', { issuer: 'Serenity', Date: '2026-09-30' }))
      .toBe('Presented by Serenity on 2026-09-30');
    expect(substituteInlineTokens('Hello {{Unknown}}', { Name: 'Ada' })).toBe('Hello {{Unknown}}');
    expect(substituteInlineTokens('No tokens', { Name: 'Ada' })).toBe('No tokens');
  });

  test('treats keys and values literally', () => {
    expect(substituteInlineTokens('{{a.b}} {{Price}}', { 'a.b': 'dot', Price: '$5 & $$' })).toBe('dot $5 & $$');
    expect(substituteInlineTokens('{{Empty}}|', { Empty: null })).toBe('|');
  });
});
