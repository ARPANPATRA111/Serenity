import { afterEach, describe, expect, test, vi } from 'vitest';
import { certificateFileNameFor, summarizeRoster, unmatchedTemplateTokens } from '../src/lib/excel/rosterSummary';
import { draftKey, readDraft, removeAllDrafts, shouldOfferDraft, writeDraft } from '../src/lib/editor/drafts';
import { fitScale } from '../src/lib/fabric/replaceImage';

describe('summarizeRoster', () => {
  const rows = [
    { Name: 'Ada', Email: 'ada@example.test' },
    { Name: 'अनन्या कृष्णमूर्ति शर्मा', Email: 'ananya@example.test' },
    { Name: '', Email: 'not-an-email' },
    { Name: 'Ada', Email: '' },
  ];

  test('counts rows and reports blanks, bad emails, duplicates and the longest name', () => {
    const summary = summarizeRoster(rows, { nameField: 'Name', emailField: 'Email' });
    expect(summary.rowCount).toBe(4);
    expect(summary.blankNameRows).toEqual([3]);
    expect(summary.invalidEmailRows).toEqual([3, 4]);
    expect(summary.duplicateNames).toEqual(['Ada']);
    expect(summary.longestName).toMatchObject({ value: 'अनन्या कृष्णमूर्ति शर्मा', row: 2 });
    // Counted as a reader sees it: conjuncts and vowel signs join their letter.
    expect(summary.longestName!.length).toBeLessThan(Array.from('अनन्या कृष्णमूर्ति शर्मा').length);
  });

  test('gives the first file name exactly as the generator writes it', () => {
    expect(summarizeRoster(rows, { nameField: 'Name' }).sampleFileName).toBe('Ada_<certificate-ID>.pdf');
    expect(certificateFileNameFor(rows[1], 'Name', 1, 'Abc123')).toBe('अनन्या_कृष्णमूर्ति_शर्मा_Abc123.pdf');
    expect(certificateFileNameFor(rows[2], 'Name', 2, 'Abc123')).toBe('Certificate_3_Abc123.pdf');
  });

  test('ignores email checks when emails are not being sent', () => {
    expect(summarizeRoster(rows, { nameField: 'Name' }).invalidEmailRows).toEqual([]);
    expect(summarizeRoster([], { nameField: 'Name' })).toMatchObject({ rowCount: 0, sampleFileName: null, longestName: null });
  });
});

describe('unmatchedTemplateTokens', () => {
  test('inserted fields need the exact column; typed tokens ignore capitals', () => {
    const objects = [
      { dynamicKey: 'Name' },
      { dynamicKey: 'email' },
      { text: 'Awarded to {{team}} for {{Project}}, {{Track}}' },
      { text: '{{VERIFICATION_URL}}', isVerificationUrl: true },
      { text: 'Literal {braces} and {{ VERIFICATION_URL }}' },
    ];
    expect(unmatchedTemplateTokens(objects, ['Name', 'Email', 'Team', 'Project'])).toEqual(['email', 'Track']);
  });
});

describe('drafts', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        get length() { return values.size; },
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    return values;
  }

  test('are scoped to one account and one design', () => {
    expect(draftKey('uid-a', 'template-1')).toBe('serenity_draft:uid-a:template-1');
    expect(draftKey('uid-a', null)).toBe('serenity_draft:uid-a:new');
    expect(draftKey('uid-b', 'template-1')).not.toBe(draftKey('uid-a', 'template-1'));
  });

  test('are offered only when different from the canvas and newer than the last save', () => {
    const draft = { canvasJSON: '{"objects":[1]}', savedAt: '2026-11-20T10:00:00.000Z' };
    expect(shouldOfferDraft(null, '{}')).toBe(false);
    expect(shouldOfferDraft(draft, draft.canvasJSON)).toBe(false);
    expect(shouldOfferDraft(draft, '{}')).toBe(true);
    expect(shouldOfferDraft(draft, '{}', '2026-11-20T09:00:00.000Z')).toBe(true);
    expect(shouldOfferDraft(draft, '{}', '2026-11-20T11:00:00.000Z')).toBe(false);
  });

  test('round-trip through storage and are all removed on sign-out', () => {
    const values = stubStorage();
    writeDraft(draftKey('uid-a', 't1'), '{"objects":[]}', new Date('2026-11-20T10:00:00.000Z'));
    writeDraft(draftKey('uid-b', null), '{}');
    values.set('serenity-recent-colors', 'kept');
    expect(readDraft(draftKey('uid-a', 't1'))).toEqual({ canvasJSON: '{"objects":[]}', savedAt: '2026-11-20T10:00:00.000Z' });
    removeAllDrafts();
    expect(readDraft(draftKey('uid-a', 't1'))).toBeNull();
    expect(Array.from(values.keys())).toEqual(['serenity-recent-colors']);
  });
});

describe('fitScale', () => {
  test('fits a new picture inside the old box, keeping its own proportions', () => {
    expect(fitScale({ width: 100, height: 50 }, 200, 100)).toBe(0.5);
    expect(fitScale({ width: 100, height: 50 }, 50, 100)).toBe(0.5);
    expect(fitScale({ width: 100, height: 50 }, 0, 100)).toBe(1);
  });
});
