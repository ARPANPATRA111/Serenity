import * as XLSX from 'xlsx';
import { describe, expect, test } from 'vitest';
import { decodeCsvBytes, parseSpreadsheetBytes, shortDateFormat } from '../src/lib/excel/parser';

const NAMES = ['José Núñez', 'Zoë Ångström', 'Nguyễn Thị Minh Khai', 'Aleksandra Wiśniewska-Kowalczyk'];

function utf8(text: string, bom = false): Uint8Array {
  const body = new TextEncoder().encode(text);
  if (!bom) return body;
  const bytes = new Uint8Array(body.length + 3);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(body, 3);
  return bytes;
}

function xlsx(rows: unknown[][], formats: Record<string, string> = {}): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  for (const [cell, format] of Object.entries(formats)) sheet[cell].z = format;
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Recipients');
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }));
}

describe('CSV encoding', () => {
  test('UTF-8 without a byte order mark keeps accented names', () => {
    const csv = ['Name,Email', ...NAMES.map((name, index) => `${name},r${index}@example.com`)].join('\n');
    const parsed = parseSpreadsheetBytes(utf8(csv), 'recipients.csv');
    expect(parsed.rows.map((row) => row.Name)).toEqual(NAMES);
  });

  test('UTF-8 with a byte order mark keeps names and a clean first header', () => {
    const parsed = parseSpreadsheetBytes(utf8(`Name,Email\n${NAMES[1]},zoe@example.com`, true), 'recipients.csv');
    expect(parsed.headers).toEqual(['Name', 'Email']);
    expect(parsed.rows[0].Name).toBe('Zoë Ångström');
  });

  test("Excel's legacy Windows-1252 CSV still decodes", () => {
    // "José Núñez" as Windows-1252 bytes, which are not valid UTF-8.
    const bytes = new Uint8Array([0x4e, 0x61, 0x6d, 0x65, 0x0a, 0x4a, 0x6f, 0x73, 0xe9, 0x20, 0x4e, 0xfa, 0xf1, 0x65, 0x7a]);
    expect(decodeCsvBytes(bytes)).toBe('Name\nJosé Núñez');
    expect(parseSpreadsheetBytes(bytes, 'legacy.csv').rows[0].Name).toBe('José Núñez');
  });

  test('UTF-16 with a byte order mark decodes', () => {
    const text = 'Name\nZoë';
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes.set([0xff, 0xfe]);
    for (let index = 0; index < text.length; index += 1) bytes[2 + index * 2] = text.charCodeAt(index);
    expect(decodeCsvBytes(bytes)).toBe(text);
  });
});

describe('values keep their written form', () => {
  test('CSV dates, numbers with leading zeros and decimals are not reformatted', () => {
    const csv = 'Name,Date,Code,Score\nAda,2026-10-05,0042,98.50\nGrace,5 October 2026,007,100\nKatherine,10/05/2026,1e3,\"1,234\"';
    const parsed = parseSpreadsheetBytes(utf8(csv), 'recipients.csv');
    expect(parsed.rows[0]).toMatchObject({ Date: '2026-10-05', Code: '0042', Score: '98.50' });
    expect(parsed.rows[1]).toMatchObject({ Date: '5 October 2026', Code: '007', Score: '100' });
    expect(parsed.rows[2]).toMatchObject({ Date: '10/05/2026', Code: '1e3', Score: '1,234' });
  });

  test("an Excel date cell with the locale short-date format prints unambiguously", () => {
    // 46300 = 2026-10-05 in Excel's 1900 date system.
    const bytes = xlsx([['Name', 'Date'], ['Ada', 46300]], { B2: 'm/d/yy' });
    expect(parseSpreadsheetBytes(bytes, 'r.xlsx', undefined, 'en-US').rows[0].Date).toBe('October 5, 2026');
    expect(parseSpreadsheetBytes(bytes, 'r.xlsx', undefined, 'en-GB').rows[0].Date).toBe('5 October 2026');
  });

  test('an Excel date cell with a custom format keeps that format', () => {
    const bytes = xlsx([['Name', 'Date'], ['Ada', 46300]], { B2: 'dd/mm/yyyy' });
    expect(parseSpreadsheetBytes(bytes, 'r.xlsx', undefined, 'en-US').rows[0].Date).toBe('05/10/2026');
  });

  test('Excel text and numbers are unchanged', () => {
    const bytes = xlsx([['Name', 'Hours'], ['Zoë Ångström', 12], ['José Núñez', 7.5]]);
    const parsed = parseSpreadsheetBytes(bytes, 'r.xlsx');
    expect(parsed.rows).toEqual([{ Name: 'Zoë Ångström', Hours: '12' }, { Name: 'José Núñez', Hours: '7.5' }]);
  });

  test('a workbook saved with a .csv name is still read as a workbook', () => {
    const bytes = xlsx([['Name'], ['Zoë']]);
    expect(parseSpreadsheetBytes(bytes, 'mislabelled.csv').rows[0].Name).toBe('Zoë');
  });
});

describe('limits and errors are unchanged', () => {
  test('rejects more than 1000 data rows', () => {
    const csv = ['Name', ...Array.from({ length: 1001 }, (_, index) => `Person ${index}`)].join('\n');
    expect(() => parseSpreadsheetBytes(utf8(csv), 'big.csv')).toThrow(/up to 1000 rows/);
  });

  test('rejects a header-only file', () => {
    expect(() => parseSpreadsheetBytes(utf8('Name,Email\n'), 'empty.csv')).toThrow(/No data found/);
  });

  test('chooses the long date order by locale', () => {
    expect(shortDateFormat('en-US')).toBe('mmmm d, yyyy');
    expect(shortDateFormat('en-GB')).toBe('d mmmm yyyy');
    expect(shortDateFormat(undefined)).toBe('d mmmm yyyy');
  });
});
