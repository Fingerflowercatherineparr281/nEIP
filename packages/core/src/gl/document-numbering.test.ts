/**
 * Tests for Document Numbering Service — Story 2.6.
 * Given-When-Then pattern (AR29).
 */

import { describe, it, expect } from 'vitest';
import { formatDocumentNumber } from './document-numbering.js';

// ---------------------------------------------------------------------------
// formatDocumentNumber — pure function tests
// ---------------------------------------------------------------------------

describe('formatDocumentNumber', () => {
  it('Given prefix JV, year 2026, number 1, When formatted, Then returns JV-2026-0001', () => {
    // Given / When
    const result = formatDocumentNumber('JV', 2026, 1);

    // Then
    expect(result).toBe('JV-2026-0001');
  });

  it('Given prefix INV, year 2026, number 42, When formatted, Then returns INV-2026-0042', () => {
    // Given / When
    const result = formatDocumentNumber('INV', 2026, 42);

    // Then
    expect(result).toBe('INV-2026-0042');
  });

  it('Given number 10000, When formatted, Then number is not truncated', () => {
    // Given / When
    const result = formatDocumentNumber('PMT', 2026, 10000);

    // Then
    expect(result).toBe('PMT-2026-10000');
  });

  it('Given prefix RCT, year 2025, number 999, When formatted, Then returns RCT-2025-0999', () => {
    // Given / When
    const result = formatDocumentNumber('RCT', 2025, 999);

    // Then
    expect(result).toBe('RCT-2025-0999');
  });
});

// ---------------------------------------------------------------------------
// DocumentNumberingService.next — tested via testable approach
// ---------------------------------------------------------------------------

describe('DocumentNumberingService — sequential numbering', () => {
  /** Simulates the numbering logic without DB. */
  class FakeSequence {
    private readonly _sequences = new Map<string, number>();

    next(tenantId: string, docType: string, fiscalYear: number): string {
      const key = `${tenantId}:${docType}:${fiscalYear}`;
      const current = this._sequences.get(key) ?? 0;
      const next = current + 1;
      this._sequences.set(key, next);

      const prefixes: Record<string, string> = {
        journal_entry: 'JV',
        invoice: 'INV',
        payment: 'PMT',
        bill: 'BILL',
        receipt: 'RCT',
      };
      const prefix = prefixes[docType] ?? docType;
      return formatDocumentNumber(prefix, fiscalYear, next);
    }
  }

  it('Given no prior documents, When next is called, Then returns number 0001', () => {
    // Given
    const seq = new FakeSequence();

    // When
    const num = seq.next('t1', 'journal_entry', 2026);

    // Then
    expect(num).toBe('JV-2026-0001');
  });

  it('Given one prior document, When next is called again, Then returns number 0002', () => {
    // Given
    const seq = new FakeSequence();
    seq.next('t1', 'journal_entry', 2026);

    // When
    const num = seq.next('t1', 'journal_entry', 2026);

    // Then
    expect(num).toBe('JV-2026-0002');
  });

  it('Given different doc types, When next is called, Then sequences are independent', () => {
    // Given
    const seq = new FakeSequence();
    seq.next('t1', 'journal_entry', 2026);

    // When
    const invoiceNum = seq.next('t1', 'invoice', 2026);

    // Then
    expect(invoiceNum).toBe('INV-2026-0001');
  });

  it('Given different fiscal years, When next is called, Then sequences are independent', () => {
    // Given
    const seq = new FakeSequence();
    seq.next('t1', 'journal_entry', 2025);

    // When
    const num2026 = seq.next('t1', 'journal_entry', 2026);

    // Then
    expect(num2026).toBe('JV-2026-0001');
  });

  it('Given different tenants, When next is called, Then sequences are independent', () => {
    // Given
    const seq = new FakeSequence();
    seq.next('t1', 'journal_entry', 2026);

    // When
    const numT2 = seq.next('t2', 'journal_entry', 2026);

    // Then
    expect(numT2).toBe('JV-2026-0001');
  });
});
