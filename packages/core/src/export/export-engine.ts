/**
 * Export Engine — Generate CSV and Excel files from structured data.
 *
 * Features:
 * - Thai date format (Buddhist Era optional: +543 years)
 * - Money amounts formatted as numbers with 2 decimal places
 * - Configurable column definitions
 * - Proper Content-Disposition filename generation
 *
 * Story 8.3 — Export Engine
 */

import ExcelJS from 'exceljs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Column definition for export */
export interface ExportColumn<T = Record<string, unknown>> {
  /** Column header label */
  readonly header: string;
  /** Key in the data object, or accessor function */
  readonly key: keyof T | ((row: T) => unknown);
  /** Optional format: 'money' formats as 2-decimal number, 'date' applies date formatting */
  readonly format?: 'money' | 'date' | 'text';
  /** Column width for Excel export (in characters) */
  readonly width?: number;
}

/** Options for the export engine */
export interface ExportOptions {
  /** Export type identifier (used in filename) */
  readonly type: string;
  /** Organisation name (used in filename, optional) */
  readonly orgName?: string;
  /** Use Buddhist Era for dates (+543 years) */
  readonly buddhistEra?: boolean;
  /** Sheet name for Excel export (default: 'Data') */
  readonly sheetName?: string;
}

/** Result of an export operation */
export interface ExportResult {
  /** The generated file as a Buffer */
  readonly buffer: Buffer;
  /** Suggested filename */
  readonly filename: string;
  /** MIME type for the Content-Type header */
  readonly mimeType: string;
}

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

/**
 * Generate a standardised filename: {type}_{date}_{orgName}.{ext}
 */
function generateFilename(type: string, ext: 'csv' | 'xlsx', orgName?: string): string {
  const datePart = new Date().toISOString().split('T')[0] ?? 'unknown';
  const sanitisedOrg = orgName
    ? orgName.replace(/[^a-zA-Z0-9\u0E00-\u0E7F_-]/g, '_').slice(0, 50)
    : undefined;

  const parts = [type, datePart];
  if (sanitisedOrg) {
    parts.push(sanitisedOrg);
  }
  return `${parts.join('_')}.${ext}`;
}

// ---------------------------------------------------------------------------
// Value extraction
// ---------------------------------------------------------------------------

function extractValue<T>(row: T, column: ExportColumn<T>): unknown {
  if (typeof column.key === 'function') {
    return column.key(row);
  }
  return (row as Record<string, unknown>)[column.key as string];
}

/**
 * Format a date string. If buddhistEra is true, adds 543 to the year.
 */
function formatDate(value: unknown, buddhistEra: boolean): string {
  if (value === null || value === undefined || value === '') return '';

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(String(value));
  }

  if (isNaN(date.getTime())) return String(value);

  const year = buddhistEra ? date.getFullYear() + 543 : date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a money value as a decimal string with 2 decimal places.
 * Accepts satang (bigint/string) or baht (number).
 */
function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0.00';

  // If it's a satang string (bigint serialised), convert to baht
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const satang = BigInt(value);
    const baht = Number(satang) / 100;
    return baht.toFixed(2);
  }

  if (typeof value === 'bigint') {
    const baht = Number(value) / 100;
    return baht.toFixed(2);
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

function formatCellValue<T>(
  row: T,
  column: ExportColumn<T>,
  buddhistEra: boolean,
): string {
  const raw = extractValue(row, column);

  switch (column.format) {
    case 'money':
      return formatMoney(raw);
    case 'date':
      return formatDate(raw, buddhistEra);
    case 'text':
    default:
      if (raw === null || raw === undefined) return '';
      return String(raw);
  }
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Escape a CSV cell value per RFC 4180.
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export an array of objects to a CSV buffer.
 */
export function exportToCsv<T>(
  data: readonly T[],
  columns: readonly ExportColumn<T>[],
  options: ExportOptions,
): ExportResult {
  const buddhistEra = options.buddhistEra ?? false;

  // Header row
  const headerLine = columns.map((col) => escapeCsv(col.header)).join(',');

  // Data rows
  const dataLines = data.map((row) =>
    columns
      .map((col) => escapeCsv(formatCellValue(row, col, buddhistEra)))
      .join(','),
  );

  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const csvContent = bom + [headerLine, ...dataLines].join('\r\n');

  return {
    buffer: Buffer.from(csvContent, 'utf-8'),
    filename: generateFilename(options.type, 'csv', options.orgName),
    mimeType: 'text/csv; charset=utf-8',
  };
}

// ---------------------------------------------------------------------------
// Excel Export
// ---------------------------------------------------------------------------

/**
 * Export an array of objects to an Excel (.xlsx) buffer.
 */
export async function exportToExcel<T>(
  data: readonly T[],
  columns: readonly ExportColumn<T>[],
  options: ExportOptions,
): Promise<ExportResult> {
  const buddhistEra = options.buddhistEra ?? false;
  const sheetName = options.sheetName ?? 'Data';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'nEIP';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  // Define columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: typeof col.key === 'string' ? col.key : col.header,
    width: col.width ?? 15,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };

  // Add data rows
  for (const row of data) {
    const rowValues: Record<string, string> = {};
    for (const col of columns) {
      const key = typeof col.key === 'string' ? col.key : col.header;
      rowValues[key] = formatCellValue(row, col, buddhistEra);
    }
    worksheet.addRow(rowValues);
  }

  // Auto-filter on header row
  if (columns.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    filename: generateFilename(options.type, 'xlsx', options.orgName),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
