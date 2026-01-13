/**
 * Excel Parser - Client-Side Data Ingestion
 * 
 * Parses Excel (.xlsx, .xls) and CSV files using SheetJS.
 * All processing happens in the browser - no server upload required.
 * Supports multiple sheets selection.
 */

import * as XLSX from 'xlsx';
import type { ParsedDataSource, DataRow } from '@/types/fabric.d';

/**
 * Supported file extensions
 */
export const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods'];

/**
 * Sheet info for multi-sheet support
 */
export interface SheetInfo {
  name: string;
  rowCount: number;
}

/**
 * Check if a file is a supported spreadsheet format
 */
export function isSupportedFile(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(extension);
}

/**
 * Get list of sheets in a spreadsheet file
 */
export async function getSheetNames(file: File): Promise<SheetInfo[]> {
  return new Promise((resolve, reject) => {
    if (!isSupportedFile(file)) {
      reject(new Error(`Unsupported file format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`));
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
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          return {
            name,
            rowCount: range.e.r - range.s.r, // Approximate row count
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

/**
 * Parse a specific sheet from a spreadsheet file
 */
export async function parseSpreadsheet(file: File, sheetName?: string): Promise<ParsedDataSource> {
  return new Promise((resolve, reject) => {
    if (!isSupportedFile(file)) {
      reject(new Error(`Unsupported file format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`));
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

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '', // Default value for empty cells
          raw: false, // Convert all values to strings
        });

        if (jsonData.length === 0) {
          reject(new Error('No data found in spreadsheet'));
          return;
        }

        // Extract headers from first row keys
        const headers = Object.keys(jsonData[0]).filter((key) => key !== '__rowNum__');

        // Clean and normalize rows
        const rows: DataRow[] = jsonData.map((row) => {
          const cleanRow: DataRow = {};
          headers.forEach((header) => {
            const value = row[header];
            cleanRow[header] = value !== undefined ? String(value) : '';
          });
          return cleanRow;
        });

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

/**
 * Parse CSV string directly (useful for pasting data)
 */
export function parseCSVString(csvString: string): ParsedDataSource {
  const workbook = XLSX.read(csvString, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (jsonData.length === 0) {
    throw new Error('No data found in CSV');
  }

  const headers = Object.keys(jsonData[0]).filter((key) => key !== '__rowNum__');
  const rows: DataRow[] = jsonData.map((row) => {
    const cleanRow: DataRow = {};
    headers.forEach((header) => {
      cleanRow[header] = row[header] !== undefined ? String(row[header]) : '';
    });
    return cleanRow;
  });

  return {
    headers,
    rows,
    fileName: 'pasted-data.csv',
    totalRows: rows.length,
  };
}

/**
 * Validate data source for required fields
 */
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

/**
 * Get a preview of the data (first N rows)
 */
export function getDataPreview(
  dataSource: ParsedDataSource,
  limit: number = 5
): DataRow[] {
  return dataSource.rows.slice(0, limit);
}

/**
 * Get unique values for a column (useful for filtering)
 */
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

/**
 * Export data source back to Excel (useful for templates)
 */
export function exportToExcel(dataSource: ParsedDataSource, filename: string = 'data.xlsx'): void {
  const worksheet = XLSX.utils.json_to_sheet(dataSource.rows, {
    header: dataSource.headers,
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  XLSX.writeFile(workbook, filename);
}

/**
 * Generate sample data template (empty with headers)
 */
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
