/**
 * Tests for Event Replay framework — Story 13.3.
 *
 * Strategy: unit tests using an in-memory fake DB client that returns
 * pre-configured domain event rows, validating the replay engine applies
 * interpretation rules correctly for both NPAEs and PAEs.
 */

import { describe, it, expect } from 'vitest';
import { replay } from './event-replay.js';
import {
  NPAES_RULES,
  PAES_RULES,
  getDefaultRules,
} from './interpretation-rules.js';
import type { InterpretationRules } from './interpretation-rules.js';
import type { DbClient } from '@neip/db';

// ---------------------------------------------------------------------------
// Fake DB helpers
// ---------------------------------------------------------------------------

interface FakeEventRow {
  id: string;
  type: string;
  aggregate_id: string;
  aggregate_type: string;
  tenant_id: string;
  payload: unknown;
  version: number;
  fiscal_year: number | null;
  timestamp: Date;
}

/**
 * Build a fake DbClient that returns the given rows when domain_events
 * is queried. Only implements the subset of the query builder API that
 * the replay function uses.
 */
function createFakeDb(rows: FakeEventRow[]): DbClient {
  // The replay function calls:
  //   db.select().from(domain_events).where(...).orderBy(...)
  // We simulate this chain.

  const orderByFn = () => Promise.resolve(rows);
  const whereFn = () => ({ orderBy: orderByFn });
  const fromFn = () => ({ where: whereFn });
  const selectFn = () => ({ from: fromFn });

  return { select: selectFn } as unknown as DbClient;
}

function makeEvent(
  id: string,
  type: string,
  payload: unknown,
  version: number,
  fiscalYear: number = 2025,
  tenantId: string = 'tenant-1',
): FakeEventRow {
  return {
    id,
    type,
    aggregate_id: `agg-${id}`,
    aggregate_type: 'JournalEntry',
    tenant_id: tenantId,
    payload,
    version,
    fiscal_year: fiscalYear,
    timestamp: new Date('2025-01-15T10:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('replay', () => {
  it('should return empty result when no events exist', async () => {
    // Given
    const db = createFakeDb([]);

    // When
    const result = await replay(db, 'tenant-1', 2025, NPAES_RULES);

    // Then
    expect(result.eventsProcessed).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.balances).toHaveLength(0);
    expect(result.standard).toBe('NPAEs');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.fiscalYear).toBe(2025);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should process JournalEntryPosted events under NPAEs rules', async () => {
    // Given
    const events = [
      makeEvent('evt-1', 'JournalEntryPosted', {
        lines: [
          { accountCode: '1100', debit: 100_00, credit: 0, description: 'Cash DR' },
          { accountCode: '4100', debit: 0, credit: 100_00, description: 'Revenue CR' },
        ],
        memo: 'Sale #1',
      }, 1),
    ];
    const db = createFakeDb(events);

    // When
    const result = await replay(db, 'tenant-1', 2025, NPAES_RULES);

    // Then
    expect(result.eventsProcessed).toBe(1);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      accountCode: '1100',
      debit: 100_00,
      credit: 0,
      standard: 'NPAEs',
    });
    expect(result.entries[1]).toMatchObject({
      accountCode: '4100',
      debit: 0,
      credit: 100_00,
      standard: 'NPAEs',
    });
    expect(result.balances).toHaveLength(2);
  });

  it('should process InvoiceCreated events under PAEs rules with TFRS 15 metadata', async () => {
    // Given
    const events = [
      makeEvent('evt-1', 'InvoiceCreated', {
        totalAmount: 500_00,
        revenueAccountCode: '4100',
        receivableAccountCode: '1200',
        description: 'Service invoice',
      }, 1),
    ];
    const db = createFakeDb(events);

    // When
    const result = await replay(db, 'tenant-1', 2025, PAES_RULES);

    // Then
    expect(result.eventsProcessed).toBe(1);
    expect(result.entries).toHaveLength(2);

    // Check PAEs-specific metadata
    const revenueEntry = result.entries.find((e) => e.accountCode === '4100');
    expect(revenueEntry).toBeDefined();
    expect(revenueEntry?.metadata).toMatchObject({
      tfrs15Step: 'satisfaction-of-performance-obligation',
      recognitionBasis: 'point-in-time',
    });
    expect(revenueEntry?.standard).toBe('PAEs');
  });

  it('should accumulate balances across multiple events', async () => {
    // Given
    const events = [
      makeEvent('evt-1', 'JournalEntryPosted', {
        lines: [
          { accountCode: '1100', debit: 100_00, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 100_00 },
        ],
      }, 1),
      makeEvent('evt-2', 'JournalEntryPosted', {
        lines: [
          { accountCode: '1100', debit: 200_00, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 200_00 },
        ],
      }, 2),
    ];
    const db = createFakeDb(events);

    // When
    const result = await replay(db, 'tenant-1', 2025, NPAES_RULES);

    // Then
    expect(result.eventsProcessed).toBe(2);
    expect(result.entries).toHaveLength(4);

    const cashBalance = result.balances.find((b) => b.accountCode === '1100');
    expect(cashBalance).toMatchObject({
      totalDebit: 300_00,
      totalCredit: 0,
      netBalance: 300_00,
    });

    const revenueBalance = result.balances.find((b) => b.accountCode === '4100');
    expect(revenueBalance).toMatchObject({
      totalDebit: 0,
      totalCredit: 300_00,
      netBalance: -300_00,
    });
  });

  it('should skip events with no matching rules', async () => {
    // Given
    const events = [
      makeEvent('evt-1', 'UnknownEventType', { foo: 'bar' }, 1),
    ];
    const db = createFakeDb(events);

    // When
    const result = await replay(db, 'tenant-1', 2025, NPAES_RULES);

    // Then
    expect(result.eventsProcessed).toBe(1);
    expect(result.entries).toHaveLength(0);
    expect(result.balances).toHaveLength(0);
  });

  it('should work with custom interpretation rules', async () => {
    // Given
    const customRules: InterpretationRules = {
      standard: 'NPAEs',
      rules: [
        {
          eventType: 'CustomEvent',
          handler: (event, context) => {
            const payload = event.payload as { amount: number };
            const balance = context.balances.get('9999') ?? { debit: 0, credit: 0 };
            balance.debit += payload.amount;
            context.balances.set('9999', balance);
            return [{
              accountCode: '9999',
              debit: payload.amount,
              credit: 0,
              description: 'Custom entry',
              standard: 'NPAEs',
            }];
          },
        },
      ],
    };

    const events = [
      makeEvent('evt-1', 'CustomEvent', { amount: 42_00 }, 1),
    ];
    const db = createFakeDb(events);

    // When
    const result = await replay(db, 'tenant-1', 2025, customRules);

    // Then
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      accountCode: '9999',
      debit: 42_00,
      standard: 'NPAEs',
    });
  });

  it('should sort balances by account code', async () => {
    // Given
    const events = [
      makeEvent('evt-1', 'JournalEntryPosted', {
        lines: [
          { accountCode: '5000', debit: 50_00, credit: 0 },
          { accountCode: '1100', debit: 0, credit: 50_00 },
        ],
      }, 1),
    ];
    const db = createFakeDb(events);

    // When
    const result = await replay(db, 'tenant-1', 2025, NPAES_RULES);

    // Then
    expect(result.balances[0]?.accountCode).toBe('1100');
    expect(result.balances[1]?.accountCode).toBe('5000');
  });
});

describe('getDefaultRules', () => {
  it('should return NPAEs rules for NPAEs standard', () => {
    const rules = getDefaultRules('NPAEs');
    expect(rules.standard).toBe('NPAEs');
    expect(rules.rules.length).toBeGreaterThan(0);
  });

  it('should return PAEs rules for PAEs standard', () => {
    const rules = getDefaultRules('PAEs');
    expect(rules.standard).toBe('PAEs');
    expect(rules.rules.length).toBeGreaterThan(0);
  });
});

describe('Interpretation Rules', () => {
  it('NPAEs should have JournalEntryPosted and InvoiceCreated rules', () => {
    const eventTypes = NPAES_RULES.rules.map((r) => r.eventType);
    expect(eventTypes).toContain('JournalEntryPosted');
    expect(eventTypes).toContain('InvoiceCreated');
  });

  it('PAEs should have JournalEntryPosted and InvoiceCreated rules', () => {
    const eventTypes = PAES_RULES.rules.map((r) => r.eventType);
    expect(eventTypes).toContain('JournalEntryPosted');
    expect(eventTypes).toContain('InvoiceCreated');
  });

  it('NPAEs InvoiceCreated should not have TFRS 15 metadata', () => {
    const rule = NPAES_RULES.rules.find((r) => r.eventType === 'InvoiceCreated');
    expect(rule).toBeDefined();

    const entries = rule!.handler(
      {
        id: 'evt-1',
        type: 'InvoiceCreated',
        tenantId: 'tenant-1',
        payload: { totalAmount: 100_00 },
        version: 1,
        timestamp: new Date(),
      },
      {
        tenantId: 'tenant-1',
        fiscalYear: 2025,
        standard: 'NPAEs',
        balances: new Map(),
      },
    );

    expect(entries).toHaveLength(2);
    // NPAEs entries should not have TFRS metadata
    for (const entry of entries) {
      expect(entry.metadata).toBeUndefined();
    }
  });

  it('PAEs InvoiceCreated should have TFRS 15 metadata', () => {
    const rule = PAES_RULES.rules.find((r) => r.eventType === 'InvoiceCreated');
    expect(rule).toBeDefined();

    const entries = rule!.handler(
      {
        id: 'evt-1',
        type: 'InvoiceCreated',
        tenantId: 'tenant-1',
        payload: { totalAmount: 100_00 },
        version: 1,
        timestamp: new Date(),
      },
      {
        tenantId: 'tenant-1',
        fiscalYear: 2025,
        standard: 'PAEs',
        balances: new Map(),
      },
    );

    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.metadata).toBeDefined();
      expect(entry.metadata?.['tfrs15Step']).toBe('satisfaction-of-performance-obligation');
    }
  });
});
