/**
 * Import Engine — Parse CSV/Excel files and validate rows against Zod schemas.
 *
 * Supports partial success: valid rows are imported, invalid rows are collected
 * with detailed error information. This allows users to fix only the failing
 * rows and re-import without duplicating successful ones.
 *
 * Story 8.1 — Import Engine (AR18)
 */

import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { z } from 'zod';
import { IMPORT_TYPES, COLUMN_ALIASES } from './import-schemas.js';
import type { ImportType } from './import-schemas.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row-level error with position and field information */
export interface ImportRowError {
  /** 1-based row number in the original file */
  readonly row: number;
  /** The field that failed validation (empty string if row-level error) */
  readonly field: string;
  /** Human-readable error message */
  readonly message: string;
}

/** Result of an import operation — always returned, never throws */
export interface ImportResult<T = Record<string, unknown>> {
  /** Number of rows successfully validated and imported */
  readonly imported: number;
  /** Number of rows that failed validation */
  readonly failed: number;
  /** Total number of rows parsed from the file */
  readonly total: number;
  /** Successfully validated row data */
  readonly validRows: readonly T[];
  /** Detailed error list for failed rows */
  readonly errors: readonly ImportRowError[];
  /** Detected column mapping used during import */
  readonly columnMapping: Readonly<Record<string, string>>;
}

/** Options for the import engine */
export interface ImportOptions {
  /** The type of data being imported */
  readonly importType: ImportType;
  /** Optional manual column mapping (header → schema field) overrides auto-detect */
  readonly columnMapping?: Readonly<Record<string, string>>;
  /** Maximum number of rows to process (safety limit, default 10000) */
  readonly maxRows?: number;
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/**
 * Auto-map CSV/Excel headers to schema field names using known aliases.
 * Returns a mapping from original header → schema field name.
 */
export function autoMapColumns(
  headers: readonly string[],
  importType: ImportType,
): Record<string, string> {
  const aliases = COLUMN_ALIASES[importType];
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalised = header.toLowerCase().trim();
    const mapped = aliases[normalised];
    if (mapped !== undefined) {
      mapping[header] = mapped;
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Parse a CSV buffer into an array of raw row objects.
 */
function parseCsv(buffer: Buffer): { headers: string[]; rows: Record<string, unknown>[] } {
  const text = buffer.toString('utf-8');
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data };
}

/**
 * Parse an Excel (.xlsx) buffer into an array of raw row objects.
 * Uses the first sheet and treats row 1 as headers.
 */
async function parseExcel(
  buffer: Buffer,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { headers: [], rows: [] };
  }

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rows: Record<string, unknown>[] = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    const record: Record<string, unknown> = {};
    let hasData = false;

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      if (header !== undefined && header !== '') {
        const cell = row.getCell(colIndex + 1);
        const value = cell.value;
        if (value !== null && value !== undefined) {
          record[header] = value instanceof Date ? value.toISOString().split('T')[0] : value;
          hasData = true;
        }
      }
    }

    if (hasData) {
      rows.push(record);
    }
  }

  return { headers: headers.filter((h) => h !== ''), rows };
}

// ---------------------------------------------------------------------------
// Row transformation
// ---------------------------------------------------------------------------

/**
 * Apply column mapping to transform raw row objects from file headers
 * to schema field names.
 */
function applyMapping(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [originalHeader, value] of Object.entries(row)) {
    const fieldName = mapping[originalHeader];
    if (fieldName !== undefined) {
      mapped[fieldName] = value;
    }
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Main import engine
// ---------------------------------------------------------------------------

/**
 * Parse and validate a file buffer (CSV or Excel) against the expected schema.
 *
 * @param buffer    Raw file content
 * @param fileType  'csv' or 'xlsx'
 * @param options   Import configuration
 * @returns         ImportResult with valid rows and error details
 */
export async function processImport<T extends ImportType>(
  buffer: Buffer,
  fileType: 'csv' | 'xlsx',
  options: ImportOptions & { importType: T },
): Promise<ImportResult<z.infer<(typeof IMPORT_TYPES)[T]>>> {
  const maxRows = options.maxRows ?? 10_000;

  // 1. Parse file
  const { headers, rows } =
    fileType === 'csv' ? parseCsv(buffer) : await parseExcel(buffer);

  // 2. Resolve column mapping
  const columnMapping =
    options.columnMapping !== undefined
      ? { ...options.columnMapping }
      : autoMapColumns(headers, options.importType);

  // 3. Validate each row
  const schema = IMPORT_TYPES[options.importType];
  const validRows: z.infer<(typeof IMPORT_TYPES)[T]>[] = [];
  const errors: ImportRowError[] = [];

  const rowsToProcess = rows.slice(0, maxRows);

  for (let i = 0; i < rowsToProcess.length; i++) {
    const rawRow = rowsToProcess[i];
    if (rawRow === undefined) continue;

    const mappedRow = applyMapping(rawRow, columnMapping);
    const result = schema.safeParse(mappedRow);

    if (result.success) {
      validRows.push(result.data as z.infer<(typeof IMPORT_TYPES)[T]>);
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          row: i + 2, // 1-based, +1 for header row
          field: issue.path.length > 0 ? String(issue.path[0]) : '',
          message: issue.message,
        });
      }
    }
  }

  return {
    imported: validRows.length,
    failed: rowsToProcess.length - validRows.length,
    total: rowsToProcess.length,
    validRows,
    errors,
    columnMapping,
  };
}

/**
 * Preview the first N rows of a file without full validation.
 * Useful for showing the column mapping UI before starting import.
 */
export async function previewImport(
  buffer: Buffer,
  fileType: 'csv' | 'xlsx',
  importType: ImportType,
  previewCount = 5,
): Promise<{
  headers: string[];
  columnMapping: Record<string, string>;
  previewRows: Record<string, unknown>[];
  totalRows: number;
}> {
  const { headers, rows } =
    fileType === 'csv' ? parseCsv(buffer) : await parseExcel(buffer);

  const columnMapping = autoMapColumns(headers, importType);
  const previewRows = rows.slice(0, previewCount).map((row) => applyMapping(row, columnMapping));

  return {
    headers,
    columnMapping,
    previewRows,
    totalRows: rows.length,
  };
}
