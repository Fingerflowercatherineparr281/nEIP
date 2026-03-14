/**
 * Tests for Import Engine — Story 8.1
 *
 * Covers: CSV parsing, Excel parsing, validation, partial failure,
 * column auto-mapping, and row limits.
 */

import { describe, it, expect } from 'vitest';
import { processImport, previewImport, autoMapColumns } from './import-engine.js';

// ---------------------------------------------------------------------------
// Helpers — build CSV buffers from row data
// ---------------------------------------------------------------------------

function csvBuffer(headers: string[], rows: string[][]): Buffer {
  const lines = [headers.join(','), ...rows.map((r) => r.join(','))];
  return Buffer.from(lines.join('\n'), 'utf-8');
}

// ---------------------------------------------------------------------------
// autoMapColumns
// ---------------------------------------------------------------------------

describe('autoMapColumns', () => {
  it('maps known header aliases to schema field names', () => {
    const headers = ['Account Code', 'Account Name', 'Account Type', 'Active'];
    const mapping = autoMapColumns(headers, 'chart_of_accounts');

    expect(mapping['Account Code']).toBe('code');
    expect(mapping['Account Name']).toBe('name');
    expect(mapping['Account Type']).toBe('type');
    expect(mapping['Active']).toBe('isActive');
  });

  it('ignores unknown headers', () => {
    const headers = ['name', 'unknown_column', 'type'];
    const mapping = autoMapColumns(headers, 'contacts');

    expect(mapping['name']).toBe('name');
    expect(mapping['type']).toBe('type');
    expect(mapping['unknown_column']).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const headers = ['DATE', 'Account Code', 'DESCRIPTION', 'Debit', 'Credit'];
    const mapping = autoMapColumns(headers, 'journal_entries');

    expect(mapping['DATE']).toBe('date');
    expect(mapping['DESCRIPTION']).toBe('description');
    expect(mapping['Debit']).toBe('debit');
  });
});

// ---------------------------------------------------------------------------
// processImport — CSV / chart_of_accounts
// ---------------------------------------------------------------------------

describe('processImport — chart_of_accounts CSV', () => {
  it('imports all valid rows successfully', async () => {
    const buf = csvBuffer(
      ['code', 'name', 'type'],
      [
        ['1100', 'Cash', 'asset'],
        ['2100', 'Accounts Payable', 'liability'],
        ['4100', 'Sales Revenue', 'revenue'],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'chart_of_accounts',
    });

    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(3);
    expect(result.validRows[0]).toEqual({ code: '1100', name: 'Cash', type: 'asset' });
  });

  it('handles partial failure — valid + invalid rows', async () => {
    const buf = csvBuffer(
      ['code', 'name', 'type'],
      [
        ['1100', 'Cash', 'asset'],
        ['', 'Missing Code', 'asset'],       // invalid: empty code
        ['3100', 'Equity', 'invalid_type'],   // invalid: bad type
        ['4100', 'Revenue', 'revenue'],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'chart_of_accounts',
    });

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(2);
    expect(result.total).toBe(4);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);

    // Check that error rows are correctly identified
    const errorRows = result.errors.map((e) => e.row);
    expect(errorRows).toContain(3); // row 3 = missing code
    expect(errorRows).toContain(4); // row 4 = invalid type
  });

  it('respects maxRows limit', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => [
      String(1000 + i),
      `Account ${i}`,
      'asset',
    ]);
    const buf = csvBuffer(['code', 'name', 'type'], rows);

    const result = await processImport(buf, 'csv', {
      importType: 'chart_of_accounts',
      maxRows: 5,
    });

    expect(result.total).toBe(5);
    expect(result.imported).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// processImport — CSV / journal_entries
// ---------------------------------------------------------------------------

describe('processImport — journal_entries CSV', () => {
  it('validates journal entry rows with debit/credit', async () => {
    const buf = csvBuffer(
      ['date', 'account code', 'description', 'debit', 'credit'],
      [
        ['2025-01-15', '1100', 'Cash received', '1000.00', ''],
        ['2025-01-15', '4100', 'Sales revenue', '', '1000.00'],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'journal_entries',
    });

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('rejects rows with neither debit nor credit', async () => {
    const buf = csvBuffer(
      ['date', 'account code', 'description', 'debit', 'credit'],
      [
        ['2025-01-15', '1100', 'Bad row', '', ''],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'journal_entries',
    });

    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    // Row fails validation (either field-level or the refine check)
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects rows with invalid date format', async () => {
    const buf = csvBuffer(
      ['date', 'account code', 'description', 'debit', 'credit'],
      [
        ['15/01/2025', '1100', 'Bad date', '100.00', ''],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'journal_entries',
    });

    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// processImport — CSV / contacts
// ---------------------------------------------------------------------------

describe('processImport — contacts CSV', () => {
  it('imports valid contacts', async () => {
    const buf = csvBuffer(
      ['name', 'type', 'email', 'phone'],
      [
        ['ACME Corp', 'customer', 'acme@example.com', '0812345678'],
        ['Supplier Ltd', 'vendor', 'supplier@example.com', '0898765432'],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'contacts',
    });

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('rejects invalid email addresses', async () => {
    const buf = csvBuffer(
      ['name', 'type', 'email'],
      [
        ['Bad Email Corp', 'customer', 'not-an-email'],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'contacts',
    });

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.field).toBe('email');
  });
});

// ---------------------------------------------------------------------------
// processImport — custom column mapping
// ---------------------------------------------------------------------------

describe('processImport — custom column mapping', () => {
  it('uses provided column mapping instead of auto-detect', async () => {
    const buf = csvBuffer(
      ['acct_no', 'acct_name', 'acct_type'],
      [
        ['1100', 'Cash', 'asset'],
      ],
    );

    const result = await processImport(buf, 'csv', {
      importType: 'chart_of_accounts',
      columnMapping: {
        acct_no: 'code',
        acct_name: 'name',
        acct_type: 'type',
      },
    });

    expect(result.imported).toBe(1);
    expect(result.validRows[0]).toEqual({ code: '1100', name: 'Cash', type: 'asset' });
  });
});

// ---------------------------------------------------------------------------
// previewImport
// ---------------------------------------------------------------------------

describe('previewImport', () => {
  it('returns first N rows with column mapping', async () => {
    const buf = csvBuffer(
      ['code', 'name', 'type'],
      [
        ['1100', 'Cash', 'asset'],
        ['2100', 'AP', 'liability'],
        ['3100', 'Equity', 'equity'],
        ['4100', 'Revenue', 'revenue'],
        ['5100', 'Expense', 'expense'],
        ['6100', 'Other', 'asset'],
      ],
    );

    const preview = await previewImport(buf, 'csv', 'chart_of_accounts', 3);

    expect(preview.headers).toEqual(['code', 'name', 'type']);
    expect(preview.previewRows).toHaveLength(3);
    expect(preview.totalRows).toBe(6);
    expect(preview.columnMapping).toEqual({
      code: 'code',
      name: 'name',
      type: 'type',
    });
  });
});
