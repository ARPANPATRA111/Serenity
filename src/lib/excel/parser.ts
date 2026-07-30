import * as XLSX from 'xlsx';
import type { ParsedDataSource, DataRow } from '@/types/fabric.d';

export const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods'];

export const SPREADSHEET_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 100,
  maxCellCharacters: 2000,
} as const;

export interface SheetInfo {
  name: string;
  rowCount: number;
}

export function isSupportedFile(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(extension);
}

export function validateSpreadsheetFile(file: File): void {
  if (!isSupportedFile(file)) {
    throw new Error(`Unsupported file format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  }

  if (file.size > SPREADSHEET_LIMITS.maxFileSizeBytes) {
    throw new Error(
      `Spreadsheet is too large. Maximum size is ${formatLimitBytes(SPREADSHEET_LIMITS.maxFileSizeBytes)}.`
    );
  }
}

function formatLimitBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes % 1 === 0 ? 0 : 1)} MB`;
}

function getWorksheetShape(worksheet: XLSX.WorkSheet): { rowCount: number; columnCount: number } {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  return {
    rowCount: Math.max(0, range.e.r - range.s.r),
    columnCount: Math.max(0, range.e.c - range.s.c + 1),
  };
}

function validateWorksheetShape(rowCount: number, columnCount: number): void {
  if (rowCount > SPREADSHEET_LIMITS.maxRows) {
    throw new Error(
      `Spreadsheet has ${rowCount} data rows. The editor supports up to ${SPREADSHEET_LIMITS.maxRows} rows per import.`
    );
  }

  if (columnCount > SPREADSHEET_LIMITS.maxColumns) {
    throw new Error(
      `Spreadsheet has ${columnCount} columns. The editor supports up to ${SPREADSHEET_LIMITS.maxColumns} columns per import.`
    );
  }
}

function normalizeRows(jsonData: Record<string, unknown>[]): { headers: string[]; rows: DataRow[] } {
  const headers = Object.keys(jsonData[0] || {}).filter((key) => key !== '__rowNum__');
  validateWorksheetShape(jsonData.length, headers.length);

  const rows: DataRow[] = jsonData.map((row, rowIndex) => {
    const cleanRow: DataRow = {};
    headers.forEach((header) => {
      const value = row[header];
      const stringValue = value !== undefined ? String(value) : '';
      if (stringValue.length > SPREADSHEET_LIMITS.maxCellCharacters) {
        throw new Error(
          `Cell value in row ${rowIndex + 1}, column "${header}" is too long. Maximum length is ${SPREADSHEET_LIMITS.maxCellCharacters} characters.`
        );
      }
      cleanRow[header] = stringValue;
    });
    return cleanRow;
  });

  return { headers, rows };
}

export async function getSheetNames(file: File): Promise<SheetInfo[]> {
  return new Promise((resolve, reject) => {
    try {
      validateSpreadsheetFile(file);
    } catch (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheets: SheetInfo[] = workbook.SheetNames.map(name => {
          const worksheet = workbook.Sheets[name];
          const { rowCount, columnCount } = getWorksheetShape(worksheet);
          validateWorksheetShape(rowCount, columnCount);
          return {
            name,
            rowCount,
          };
        });

        resolve(sheets);
      } catch (error) {
        reject(new Error(`Failed to read sheets: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseSpreadsheet(file: File, sheetName?: string): Promise<ParsedDataSource> {
  return new Promise((resolve, reject) => {
    try {
      validateSpreadsheetFile(file);
    } catch (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        // Parse workbook
        const workbook = XLSX.read(data, { type: 'array' });

        // Get specified sheet or first sheet
        const targetSheetName = sheetName || workbook.SheetNames[0];
        if (!targetSheetName || !workbook.SheetNames.includes(targetSheetName)) {
          reject(new Error('Sheet not found in workbook'));
          return;
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const { rowCount, columnCount } = getWorksheetShape(worksheet);
        validateWorksheetShape(rowCount, columnCount);

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '', // Default value for empty cells
          raw: false, // Convert all values to strings
        });

        if (jsonData.length === 0) {
          reject(new Error('No data found in spreadsheet'));
          return;
        }

        const { headers, rows } = normalizeRows(jsonData);

        const result: ParsedDataSource = {
          headers,
          rows,
          fileName: file.name,
          totalRows: rows.length,
          sheetName: targetSheetName,
          availableSheets: workbook.SheetNames,
        };

        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    // Read file as array buffer
    reader.readAsArrayBuffer(file);
  });
}

export function parseCSVString(csvString: string): ParsedDataSource {
  if (new TextEncoder().encode(csvString).length > SPREADSHEET_LIMITS.maxFileSizeBytes) {
    throw new Error(
      `CSV data is too large. Maximum size is ${formatLimitBytes(SPREADSHEET_LIMITS.maxFileSizeBytes)}.`
    );
  }

  const workbook = XLSX.read(csvString, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const { rowCount, columnCount } = getWorksheetShape(worksheet);
  validateWorksheetShape(rowCount, columnCount);

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (jsonData.length === 0) {
    throw new Error('No data found in CSV');
  }

  const { headers, rows } = normalizeRows(jsonData);

  return {
    headers,
    rows,
    fileName: 'pasted-data.csv',
    totalRows: rows.length,
  };
}

export function validateDataSource(
  dataSource: ParsedDataSource,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(
    (field) => !dataSource.headers.includes(field)
  );

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

export function getDataPreview(
  dataSource: ParsedDataSource,
  limit: number = 5
): DataRow[] {
  return dataSource.rows.slice(0, limit);
}

export function getUniqueColumnValues(
  dataSource: ParsedDataSource,
  column: string
): string[] {
  const values = new Set<string>();
  
  dataSource.rows.forEach((row) => {
    const value = row[column];
    if (value !== null && value !== undefined && value !== '') {
      values.add(String(value));
    }
  });

  return Array.from(values).sort();
}

export function exportToExcel(dataSource: ParsedDataSource, filename: string = 'data.xlsx'): void {
  const worksheet = XLSX.utils.json_to_sheet(dataSource.rows, {
    header: dataSource.headers,
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  XLSX.writeFile(workbook, filename);
}

export function generateSampleTemplate(headers: string[], filename: string = 'template.xlsx'): void {
  const sampleRow: Record<string, string> = {};
  headers.forEach((header) => {
    sampleRow[header] = `Sample ${header}`;
  });

  const worksheet = XLSX.utils.json_to_sheet([sampleRow], {
    header: headers,
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

  XLSX.writeFile(workbook, filename);
}
