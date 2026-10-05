import { describe, expect, test } from 'vitest';
import { numericFontWeight, servedWeights } from '../src/lib/fonts/googleFonts';
import { plural } from '../src/lib/utils';

describe('plural', () => {
  test('uses the singular only for exactly one', () => {
    expect(plural(1, 'certificate')).toBe('certificate');
    expect(plural(0, 'certificate')).toBe('certificates');
    expect(plural(2, 'view')).toBe('views');
    expect(plural(1, 'recipient has', 'recipients have')).toBe('recipient has');
    expect(plural(3, 'recipient has', 'recipients have')).toBe('recipients have');
  });
});

describe('template font weights', () => {
  test('reads CSS weights as numbers', () => {
    expect(numericFontWeight(600)).toBe(600);
    expect(numericFontWeight('600')).toBe(600);
    expect(numericFontWeight('bold')).toBe(700);
    expect(numericFontWeight('normal')).toBe(400);
    expect(numericFontWeight(undefined)).toBe(400);
  });

  test('requests only weights the family serves, sorted for the css2 API', () => {
    expect(servedWeights('Playfair Display', [600])).toEqual([600]);
    expect(servedWeights('Lobster', [700, 400])).toEqual([400]);
    expect(servedWeights('Lato', [600, 400])).toEqual([400, 700]);
    expect(servedWeights('Montserrat', [700, 400, 700])).toEqual([400, 700]);
    // Unknown families are passed through as requested.
    expect(servedWeights('Some Custom Font', [300])).toEqual([300]);
  });
});
