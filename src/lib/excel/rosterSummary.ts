import { certificateFileStem } from '@/lib/certificates/fileName';
import type { DataRow } from '@/types/fabric.d';

/**
 * What a roster will produce, shown before generating: how many
 * certificates, which rows have no name or an unusable email, the longest
 * name (to check it fits the design), a real example of the PDF file name,
 * and placeholders on the design that no column fills.
 */
export interface RosterSummary {
  rowCount: number;
  /** 1-based spreadsheet rows (after the header) with an empty name. */
  blankNameRows: number[];
  /** 1-based rows whose email is missing or not an address. Empty when emails are not used. */
  invalidEmailRows: number[];
  /** Names that appear more than once (their certificates still get distinct IDs). */
  duplicateNames: string[];
  longestName: { value: string; length: number; row: number } | null;
  /** File name of the first certificate, with the ID shown as a placeholder. */
  sampleFileName: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors BatchGenerator: `<name stem>_<certificate ID>.pdf`, "Certificate_<n>" for a blank name. */
export function certificateFileNameFor(row: DataRow, nameField: string, index: number, id = '<certificate-ID>'): string {
  const name = String(row[nameField] || `Certificate_${index + 1}`);
  return `${certificateFileStem(name)}_${id}.pdf`;
}

/** Characters as a reader counts them (a Devanagari conjunct is one). */
export function visibleLength(text: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => { segment(input: string): Iterable<unknown> } }).Segmenter;
  if (!Segmenter) return Array.from(text).length;
  return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length;
}

export function summarizeRoster(
  rows: DataRow[],
  options: { nameField: string; emailField?: string },
): RosterSummary {
  const { nameField, emailField } = options;
  const blankNameRows: number[] = [];
  const invalidEmailRows: number[] = [];
  const counts = new Map<string, number>();
  let longestName: RosterSummary['longestName'] = null;

  rows.forEach((row, index) => {
    const name = String(row[nameField] ?? '').trim();
    if (!name) blankNameRows.push(index + 1);
    else {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      const length = visibleLength(name);
      if (!longestName || length > longestName.length) longestName = { value: name, length, row: index + 1 };
    }
    if (emailField) {
      const email = String(row[emailField] ?? '').trim();
      if (!EMAIL.test(email)) invalidEmailRows.push(index + 1);
    }
  });

  return {
    rowCount: rows.length,
    blankNameRows,
    invalidEmailRows,
    duplicateNames: Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name),
    longestName,
    sampleFileName: rows.length > 0 ? certificateFileNameFor(rows[0], nameField, 0) : null,
  };
}

/**
 * `{{Column}}` tokens on the design that no column fills. Variable fields
 * need the exact column name (generation reads `row[dynamicKey]`); tokens
 * typed inside ordinary text match regardless of capitals, as in Preview.
 */
export function unmatchedTemplateTokens(
  objects: Array<{ dynamicKey?: unknown; text?: unknown; isVerificationUrl?: unknown }>,
  headers: string[],
): string[] {
  const exact = new Set(headers);
  const folded = new Set(headers.map((header) => header.toLowerCase()));
  const missing = new Set<string>();
  for (const object of objects) {
    if (object.isVerificationUrl) continue;
    if (typeof object.dynamicKey === 'string' && object.dynamicKey) {
      if (!exact.has(object.dynamicKey)) missing.add(object.dynamicKey);
      continue;
    }
    if (typeof object.text === 'string') {
      const pattern = /\{\{([^{}]+)\}\}/g;
      for (let match = pattern.exec(object.text); match; match = pattern.exec(object.text)) {
        const token = match[1];
        if (token.trim().toUpperCase() === 'VERIFICATION_URL') continue;
        if (!folded.has(token.toLowerCase())) missing.add(token);
      }
    }
  }
  return Array.from(missing);
}
