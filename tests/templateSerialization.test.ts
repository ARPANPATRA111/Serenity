import { describe, expect, test } from 'vitest';
import {
  TEMPLATE_OBJECT_PROPS,
  cleanSerializedTemplate,
  isProtectedTemplateObject,
  parseTemplateFile,
} from '../src/lib/fabric/templateSerialization';
import { validateTemplateInvariants } from '../src/lib/fabric/templateInvariants';

const verification = {
  type: 'textbox',
  text: '{{VERIFICATION_URL}}',
  left: 421,
  top: 570,
  visible: true,
  editable: false,
  isVerificationUrl: true,
  isLocked: true,
};
const link = { type: 'textbox', text: 'https://example.test/rules', isClickableLink: true };
const qr = { type: 'image', src: 'data:image/png;base64,AAAA', verificationId: 'preview-id' };
const variable = { type: 'variableTextbox', text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true };

describe('template serialisation contract', () => {
  test('keeps every custom property the editor relies on', () => {
    expect(TEMPLATE_OBJECT_PROPS).toEqual(expect.arrayContaining([
      'dynamicKey', 'isPlaceholder', 'verificationId', 'isVerificationUrl', 'isClickableLink', 'isLocked', 'editable',
    ]));
  });

  test('removes the editor boundary and repairs the textBaseline typo', () => {
    const cleaned = cleanSerializedTemplate({
      objects: [{ type: 'rect', isBoundary: true }, { type: 'textbox', textBaseline: 'alphabetical' }],
    });
    expect(cleaned.objects).toEqual([{ type: 'textbox', textBaseline: 'alphabetic' }]);
  });

  test('treats only the verification link and QR code as protected', () => {
    expect(isProtectedTemplateObject(verification)).toBe(true);
    expect(isProtectedTemplateObject(qr)).toBe(true);
    expect(isProtectedTemplateObject(link)).toBe(false);
    expect(isProtectedTemplateObject({ ...link, isLocked: true })).toBe(false);
    expect(isProtectedTemplateObject(null)).toBe(false);
  });
});

describe('parseTemplateFile', () => {
  test('round-trips a current export unchanged and still passes the save invariants', () => {
    const exported = { version: '5.3.0', background: '#ffffff', objects: [verification, link, qr, variable] };
    const result = parseTemplateFile(JSON.stringify(exported));
    expect(result).toEqual({ ok: true, template: exported, repairs: [] });
    if (result.ok) expect(validateTemplateInvariants(result.template)).toEqual({ valid: true, errors: [] });
  });

  test('protects the verification link in an export from an earlier release', () => {
    const legacy = { objects: [{ type: 'textbox', text: '{{VERIFICATION_URL}}', left: 421, top: 570 }, link] };
    const result = parseTemplateFile(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.template.objects[0]).toMatchObject({ isVerificationUrl: true, isLocked: true, editable: false });
    expect(result.repairs).toHaveLength(1);
    expect(validateTemplateInvariants(result.template).valid).toBe(true);
  });

  test('drops exact verification placeholder copies left by an earlier export and re-import', () => {
    const doubled = {
      objects: [
        { type: 'textbox', text: '{{VERIFICATION_URL}}', left: 421, top: 570 },
        link,
        { type: 'textbox', text: '{{VERIFICATION_URL}}', left: 421, top: 570 },
      ],
    };
    const result = parseTemplateFile(JSON.stringify(doubled));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.template.objects).toHaveLength(2);
    expect(result.repairs).toHaveLength(2);
    expect(validateTemplateInvariants(result.template).valid).toBe(true);
  });

  test('never touches a placeholder when a protected link already exists', () => {
    const typed = { type: 'textbox', text: '{{VERIFICATION_URL}}' };
    const result = parseTemplateFile(JSON.stringify({ objects: [verification, typed] }));
    expect(result.ok && result.template.objects[1]).toEqual(typed);
  });

  test('rejects files that would leave the design unsaveable, without changing anything', () => {
    expect(parseTemplateFile('{not json')).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
    expect(parseTemplateFile('{}')).toMatchObject({ ok: false });
    expect(parseTemplateFile('[]')).toMatchObject({ ok: false });
    expect(parseTemplateFile(JSON.stringify({ objects: [{ text: 'no type' }] }))).toMatchObject({ ok: false });
    expect(parseTemplateFile(JSON.stringify({ objects: [verification, verification] })))
      .toMatchObject({ ok: false, error: expect.stringMatching(/more than one verification link/) });
    expect(parseTemplateFile(JSON.stringify({ objects: [verification, qr, qr] })))
      .toMatchObject({ ok: false, error: expect.stringMatching(/QR/) });
  });

  test('rejects object types Fabric cannot build, including inside groups', () => {
    const known = new Set(['textbox', 'group', 'rect']);
    const isKnownType = (type: string) => known.has(type);
    expect(parseTemplateFile(JSON.stringify({ objects: [{ type: 'widget' }] }), { isKnownType }))
      .toMatchObject({ ok: false, error: expect.stringMatching(/"widget"/) });
    expect(parseTemplateFile(JSON.stringify({ objects: [{ type: 'group', objects: [{ type: 'widget' }] }] }), { isKnownType }))
      .toMatchObject({ ok: false });
    expect(parseTemplateFile(JSON.stringify({ objects: [{ type: 'group', objects: [{ type: 'rect' }] }] }), { isKnownType }))
      .toMatchObject({ ok: true });
  });

  test('does not mutate the parsed objects it was given', () => {
    const text = JSON.stringify({ objects: [{ type: 'textbox', text: '{{VERIFICATION_URL}}' }] });
    const first = parseTemplateFile(text);
    const second = parseTemplateFile(text);
    expect(first).toEqual(second);
  });
});
