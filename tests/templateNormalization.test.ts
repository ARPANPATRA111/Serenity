import { describe, expect, test } from 'vitest';
import { isEditorChromeStroke, normalizeTemplateJSON, substituteInlineTokens } from '../src/lib/fabric/templateNormalization';
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

describe('editor chrome strokes saved into templates', () => {
  test('removes the placeholder outline and the old Exit Preview stroke from text', () => {
    const normalized = normalizeTemplateJSON({
      objects: [
        // Saved by earlier editor releases for every {{Name}} field.
        { type: 'variableTextbox', text: '{{Name}}', dynamicKey: 'Name', stroke: '#001eff', strokeWidth: 2, strokeDashArray: [5, 5], styles: [] },
        // Left on inline-token text by the old Exit Preview.
        { type: 'textbox', text: 'Presented by {{Issuer}}', stroke: '#3B82F6', strokeWidth: 1, strokeDashArray: [4, 2], styles: [] },
      ],
    });
    for (const object of normalized.objects as Array<Record<string, unknown>>) {
      expect(object).toMatchObject({ stroke: null, strokeWidth: 0, strokeDashArray: null });
    }
  });

  test('keeps strokes a designer chose', () => {
    const designed = [
      { type: 'textbox', text: 'Outlined', stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: null, styles: [] },
      { type: 'textbox', text: 'Dashed red', stroke: '#dc2626', strokeWidth: 1, strokeDashArray: [4, 2], styles: [] },
      { type: 'textbox', text: 'Other dash', stroke: '#001eff', strokeWidth: 2, strokeDashArray: [6, 3], styles: [] },
      // Shapes are never touched, whatever their stroke.
      { type: 'rect', stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: [4, 2] },
    ];
    const normalized = normalizeTemplateJSON({ objects: designed });
    expect(normalized.objects).toEqual(designed);
  });

  test('is idempotent', () => {
    const once = normalizeTemplateJSON({ objects: [{ type: 'textbox', text: '{{A}}', stroke: '#3b82f6', strokeDashArray: [4, 2] }] });
    expect(normalizeTemplateJSON(once)).toEqual(once);
  });

  test('recognises only the two editor signatures', () => {
    expect(isEditorChromeStroke({ stroke: '#001eff', strokeDashArray: [5, 5] })).toBe(true);
    expect(isEditorChromeStroke({ stroke: '#3b82f6', strokeDashArray: [4, 2] })).toBe(true);
    expect(isEditorChromeStroke({ stroke: '#3b82f6', strokeDashArray: [5, 5] })).toBe(false);
    expect(isEditorChromeStroke({ stroke: null, strokeDashArray: [4, 2] })).toBe(false);
    expect(isEditorChromeStroke({})).toBe(false);
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
