import { describe, expect, test } from 'vitest';
import { certificateFileStem, imageExtension } from '../src/lib/certificates/fileName';

describe('certificateFileStem', () => {
  test('keeps letters in every script', () => {
    expect(certificateFileStem('José Núñez')).toBe('José_Núñez');
    expect(certificateFileStem('Zoë Ångström')).toBe('Zoë_Ångström');
    expect(certificateFileStem('Aleksandra Wiśniewska-Kowalczyk')).toBe('Aleksandra_Wiśniewska-Kowalczyk');
    expect(certificateFileStem('Nguyễn Thị Minh Khai')).toBe('Nguyễn_Thị_Minh_Khai');
    expect(certificateFileStem('李小龍')).toBe('李小龍');
  });

  test('names that were already ASCII are unchanged from earlier releases', () => {
    expect(certificateFileStem('Ada Lovelace')).toBe('Ada_Lovelace');
    expect(certificateFileStem('  Grace   Hopper ')).toBe('Grace_Hopper');
  });

  test('replaces characters file systems reject', () => {
    expect(certificateFileStem('A/B\\C:D*E?F"G<H>I|J')).toBe('A_B_C_D_E_F_G_H_I_J');
    expect(certificateFileStem('Tab\tand\nnewline')).toBe('Tab_and_newline');
  });

  test('caps the length without splitting characters, and never returns empty', () => {
    expect(Array.from(certificateFileStem('ö'.repeat(80)))).toHaveLength(50);
    expect(certificateFileStem('😀'.repeat(60))).toBe('😀'.repeat(50));
    expect(certificateFileStem('   ')).toBe('certificate');
  });

  test('composes decomposed accents so names compare equal', () => {
    expect(certificateFileStem('Zoë')).toBe('Zoë');
  });
});

describe('imageExtension', () => {
  test('matches the attached bytes', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg');
    expect(imageExtension('image/webp')).toBe('webp');
    expect(imageExtension('image/png')).toBe('png');
  });
});
