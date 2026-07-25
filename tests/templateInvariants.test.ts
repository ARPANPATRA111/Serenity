import { describe, expect, test } from 'vitest';
import { validateTemplateInvariants } from '../src/lib/fabric/templateInvariants';

const verificationObject = {
  type: 'textbox',
  text: '{{VERIFICATION_URL}}',
  left: 421,
  top: 570,
  visible: true,
  editable: false,
  isVerificationUrl: true,
  isLocked: true,
};

describe('validateTemplateInvariants', () => {
  test('accepts one protected, printable verification URL and one optional QR', () => {
    expect(validateTemplateInvariants({ objects: [verificationObject, { type: 'image', verificationId: 'sample' }] }))
      .toEqual({ valid: true, errors: [] });
  });

  test('rejects missing, duplicate, edited, hidden, or off-canvas verification URLs', () => {
    expect(validateTemplateInvariants({ objects: [] }).valid).toBe(false);
    expect(validateTemplateInvariants({ objects: [verificationObject, verificationObject] }).valid).toBe(false);
    expect(validateTemplateInvariants({ objects: [{ ...verificationObject, text: 'example.test' }] }).valid).toBe(false);
    expect(validateTemplateInvariants({ objects: [{ ...verificationObject, visible: false }] }).valid).toBe(false);
    expect(validateTemplateInvariants({ objects: [{ ...verificationObject, left: 900 }] }).valid).toBe(false);
  });
});
