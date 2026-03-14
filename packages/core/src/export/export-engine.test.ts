/**
 * Tests for Export Engine — Story 8.3
 *
 * Covers: CSV generation, Excel generation, Buddhist Era dates,
 * money formatting, filename generation, and BOM handling.
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { exportToCsv, exportToExcel } from './export-engine.js';
import type { ExportColumn } from './export-engine.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

interface TestRow {
  date: string;
  description: string;
  amount: number;
  amountSatang: string;
}

const testData: TestRow[] = [
  { date: '2025-01-15', description: 'Cash payment', amount: 1000.5, amountSatang: '100050' },
  { date: '2025-02-28', description: 'Invoice #001', amount: 2500.0, amountSatang: '250000' },
];

const testColumns: ExportColumn<TestRow>[] = [
  { header: 'Date', key: 'date', format: 'date' },
  { header: 'Description', key: 'description', format: 'text' },
  { header: 'Amount (Baht)', key: 'amount', format: 'money' },
  { header: 'Amount (Satang)', key: 'amountSatang', format: 'money' },
];

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

describe('exportToCsv', () => {
  it('generates a valid CSV with headers and data', () => {
    const result = exportToCsv(testData, testColumns, { type: 'journal_entries' });

    const content = result.buffer.toString('utf-8');
    // Remove BOM
    const lines = content.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toBe('Date,Description,Amount (Baht),Amount (Satang)');
    expect(lines[1]).toBe('2025-01-15,Cash payment,1000.50,1000.50');
    expect(lines[2]).toBe('2025-02-28,Invoice #001,2500.00,2500.00');
  });

  it('includes UTF-8 BOM for Excel compatibility', () => {
    const result = exportToCsv(testData, testColumns, { type: 'test' });
    const content = result.buffer.toString('utf-8');
    expect(content.startsWith('\uFEFF')).toBe(true);
  });

  it('escapes CSV values containing commas and quotes', () => {
    const data = [
      { date: '2025-01-15', description: 'Item with, comma', amount: 100, amountSatang: '10000' },
      { date: '2025-01-16', description: 'Item with "quotes"', amount: 200, amountSatang: '20000' },
    ];

    const result = exportToCsv(data, testColumns, { type: 'test' });
    const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split('\r\n');

    expect(lines[1]).toContain('"Item with, comma"');
    expect(lines[2]).toContain('"Item with ""quotes"""');
  });

  it('generates correct filename with date and org name', () => {
    const result = exportToCsv(testData, testColumns, {
      type: 'journal_entries',
      orgName: 'ACME Corp',
    });

    expect(result.filename).toMatch(/^journal_entries_\d{4}-\d{2}-\d{2}_ACME_Corp\.csv$/);
  });

  it('formats dates in Buddhist Era when enabled', () => {
    const result = exportToCsv(testData, testColumns, {
      type: 'test',
      buddhistEra: true,
    });

    const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split('\r\n');

    // 2025 + 543 = 2568
    expect(lines[1]).toContain('2568-01-15');
    expect(lines[2]).toContain('2568-02-28');
  });

  it('returns correct MIME type', () => {
    const result = exportToCsv(testData, testColumns, { type: 'test' });
    expect(result.mimeType).toBe('text/csv; charset=utf-8');
  });

  it('supports accessor function columns', () => {
    const columns: ExportColumn<TestRow>[] = [
      { header: 'Full Line', key: (row) => `${row.date}: ${row.description}` },
    ];

    const result = exportToCsv(testData, columns, { type: 'test' });
    const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split('\r\n');

    expect(lines[1]).toBe('2025-01-15: Cash payment');
  });
});

// ---------------------------------------------------------------------------
// Excel Export
// ---------------------------------------------------------------------------

describe('exportToExcel', () => {
  it('generates a valid Excel file with headers and data', async () => {
    const result = await exportToExcel(testData, testColumns, {
      type: 'journal_entries',
    });

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    // Parse the generated Excel to verify content
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.worksheets[0]!;
    expect(worksheet.name).toBe('Data');

    // Check header row
    const headerRow = worksheet.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Date');
    expect(headerRow.getCell(2).value).toBe('Description');
  });

  it('generates correct filename with xlsx extension', async () => {
    const result = await exportToExcel(testData, testColumns, {
      type: 'invoices',
      orgName: 'TestOrg',
    });

    expect(result.filename).toMatch(/^invoices_\d{4}-\d{2}-\d{2}_TestOrg\.xlsx$/);
  });

  it('uses custom sheet name', async () => {
    const result = await exportToExcel(testData, testColumns, {
      type: 'test',
      sheetName: 'Journal Entries',
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer);

    expect(workbook.worksheets[0]!.name).toBe('Journal Entries');
  });

  it('handles empty data arrays', async () => {
    const result = await exportToExcel([], testColumns, { type: 'empty' });
    expect(result.buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0]!;

    // Should have header row only
    expect(worksheet.rowCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Money formatting
// ---------------------------------------------------------------------------

describe('money formatting', () => {
  it('converts satang string to baht with 2 decimals', () => {
    const data = [{ date: '', description: '', amount: 0, amountSatang: '150075' }];
    const columns: ExportColumn<TestRow>[] = [
      { header: 'Amount', key: 'amountSatang', format: 'money' },
    ];

    const result = exportToCsv(data, columns, { type: 'test' });
    const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split('\r\n');

    expect(lines[1]).toBe('1500.75');
  });

  it('formats number amounts with 2 decimal places', () => {
    const data = [{ date: '', description: '', amount: 1000, amountSatang: '0' }];
    const columns: ExportColumn<TestRow>[] = [
      { header: 'Amount', key: 'amount', format: 'money' },
    ];

    const result = exportToCsv(data, columns, { type: 'test' });
    const content = result.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = content.split('\r\n');

    expect(lines[1]).toBe('1000.00');
  });
});
