/**
 * Tests for Journal Entry — Story 2.4.
 * Given-When-Then pattern (AR29).
 *
 * Uses in-memory testable class to verify business rules without a real DB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError, ConflictError, NotFoundError } from '@neip/shared';
import type { ExecutionContext } from '../tool-registry/types.js';

// ---------------------------------------------------------------------------
// In-memory testable journal entry logic
// ---------------------------------------------------------------------------

interface FakeJournalEntry {
  id: string;
  documentNumber: string;
  description: string;
  status: 'draft' | 'posted' | 'reversed';
  fiscalYear: number;
  fiscalPeriod: number;
  reversedEntryId: string | null;
  tenantId: string;
  createdBy: string;
  postedAt: Date | null;
  createdAt: Date;
  lines: FakeLine[];
}

interface FakeLine {
  id: string;
  lineNumber: number;
  accountId: string;
  description: string | null;
  debitSatang: bigint;
  creditSatang: bigint;
}

const CTX: ExecutionContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  requestId: 'req-001',
};

let docCounter = 0;

class TestableJournalEntryService {
  private readonly _entries: FakeJournalEntry[] = [];
  private readonly _events: { type: string; aggregateId: string }[] = [];

  async createJournalEntry(params: {
    description: string;
    fiscalYear: number;
    fiscalPeriod: number;
    lines: { accountId: string; description?: string; debitSatang: string; creditSatang: string }[];
  }, ctx: ExecutionContext): Promise<FakeJournalEntry> {
    // Validate min 2 lines
    if (params.lines.length < 2) {
      throw new ValidationError({ detail: 'Minimum 2 line items required.' });
    }

    // Double-entry validation
    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const line of params.lines) {
      totalDebit += BigInt(line.debitSatang);
      totalCredit += BigInt(line.creditSatang);
    }

    if (totalDebit !== totalCredit) {
      throw new ValidationError({
        detail: `Double-entry violation: total debits (${totalDebit}) must equal total credits (${totalCredit}).`,
      });
    }

    if (totalDebit === 0n) {
      throw new ValidationError({ detail: 'Journal entry must have non-zero amounts.' });
    }

    const { uuidv7 } = await import('uuidv7');
    docCounter++;
    const documentNumber = `JV-${params.fiscalYear}-${docCounter.toString().padStart(4, '0')}`;

    const entry: FakeJournalEntry = {
      id: uuidv7(),
      documentNumber,
      description: params.description,
      status: 'draft',
      fiscalYear: params.fiscalYear,
      fiscalPeriod: params.fiscalPeriod,
      reversedEntryId: null,
      tenantId: ctx.tenantId,
      createdBy: ctx.userId,
      postedAt: null,
      createdAt: new Date(),
      lines: params.lines.map((l, i) => ({
        id: uuidv7(),
        lineNumber: i + 1,
        accountId: l.accountId,
        description: l.description ?? null,
        debitSatang: BigInt(l.debitSatang),
        creditSatang: BigInt(l.creditSatang),
      })),
    };

    this._entries.push(entry);
    this._events.push({ type: 'JournalEntryCreated', aggregateId: entry.id });
    return entry;
  }

  async postJournalEntry(params: { entryId: string }, ctx: ExecutionContext): Promise<FakeJournalEntry> {
    const entry = this._entries.find(
      (e) => e.id === params.entryId && e.tenantId === ctx.tenantId,
    );
    if (!entry) throw new NotFoundError({ detail: `Journal entry "${params.entryId}" not found.` });

    if (entry.status !== 'draft') {
      throw new ConflictError({
        detail: `Journal entry "${params.entryId}" cannot be posted — current status is "${entry.status}".`,
      });
    }

    entry.status = 'posted';
    entry.postedAt = new Date();
    this._events.push({ type: 'JournalEntryPosted', aggregateId: entry.id });
    return entry;
  }

  async reverseJournalEntry(
    params: { entryId: string; description?: string },
    ctx: ExecutionContext,
  ): Promise<FakeJournalEntry> {
    const original = this._entries.find(
      (e) => e.id === params.entryId && e.tenantId === ctx.tenantId,
    );
    if (!original) throw new NotFoundError({ detail: `Journal entry "${params.entryId}" not found.` });

    if (original.status !== 'posted') {
      throw new ConflictError({
        detail: `Journal entry "${params.entryId}" cannot be reversed — current status is "${original.status}".`,
      });
    }

    original.status = 'reversed';

    const { uuidv7 } = await import('uuidv7');
    docCounter++;

    const reversalEntry: FakeJournalEntry = {
      id: uuidv7(),
      documentNumber: `JV-${original.fiscalYear}-${docCounter.toString().padStart(4, '0')}`,
      description: params.description ?? `Reversal of ${original.documentNumber}`,
      status: 'posted',
      fiscalYear: original.fiscalYear,
      fiscalPeriod: original.fiscalPeriod,
      reversedEntryId: params.entryId,
      tenantId: ctx.tenantId,
      createdBy: ctx.userId,
      postedAt: new Date(),
      createdAt: new Date(),
      lines: original.lines.map((l) => ({
        id: uuidv7(),
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        description: l.description,
        debitSatang: l.creditSatang,
        creditSatang: l.debitSatang,
      })),
    };

    this._entries.push(reversalEntry);
    this._events.push({ type: 'JournalEntryReversed', aggregateId: reversalEntry.id });
    return reversalEntry;
  }

  get events() { return this._events; }
  get entries() { return this._entries; }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JournalEntry.createJournalEntry', () => {
  let service: TestableJournalEntryService;

  beforeEach(() => {
    service = new TestableJournalEntryService();
    docCounter = 0;
  });

  it('Given valid balanced lines, When creating entry, Then draft is created with document number', async () => {
    // Given
    const params = {
      description: 'Test entry',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    };

    // When
    const result = await service.createJournalEntry(params, CTX);

    // Then
    expect(result.status).toBe('draft');
    expect(result.documentNumber).toBe('JV-2026-0001');
    expect(result.lines).toHaveLength(2);
    expect(result.tenantId).toBe(CTX.tenantId);
    expect(result.createdBy).toBe(CTX.userId);
  });

  it('Given unbalanced lines, When creating entry, Then ValidationError is thrown', async () => {
    // Given
    const params = {
      description: 'Unbalanced',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '50000' },
      ],
    };

    // When / Then
    await expect(service.createJournalEntry(params, CTX)).rejects.toThrow(ValidationError);
  });

  it('Given zero amounts, When creating entry, Then ValidationError is thrown', async () => {
    // Given
    const params = {
      description: 'Zero',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '0', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '0' },
      ],
    };

    // When / Then
    await expect(service.createJournalEntry(params, CTX)).rejects.toThrow(ValidationError);
  });

  it('Given valid entry, When created, Then JournalEntryCreated event is emitted', async () => {
    // Given / When
    await service.createJournalEntry({
      description: 'Test',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '50000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '50000' },
      ],
    }, CTX);

    // Then
    expect(service.events).toHaveLength(1);
    expect(service.events[0]?.type).toBe('JournalEntryCreated');
  });
});

describe('JournalEntry.postJournalEntry', () => {
  let service: TestableJournalEntryService;

  beforeEach(() => {
    service = new TestableJournalEntryService();
    docCounter = 0;
  });

  it('Given a draft entry, When posting, Then status becomes posted', async () => {
    // Given
    const entry = await service.createJournalEntry({
      description: 'Test',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    }, CTX);

    // When
    const result = await service.postJournalEntry({ entryId: entry.id }, CTX);

    // Then
    expect(result.status).toBe('posted');
    expect(result.postedAt).toBeInstanceOf(Date);
  });

  it('Given a posted entry, When posting again, Then ConflictError is thrown', async () => {
    // Given
    const entry = await service.createJournalEntry({
      description: 'Test',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    }, CTX);
    await service.postJournalEntry({ entryId: entry.id }, CTX);

    // When / Then
    await expect(
      service.postJournalEntry({ entryId: entry.id }, CTX),
    ).rejects.toThrow(ConflictError);
  });

  it('Given a non-existent entry, When posting, Then NotFoundError is thrown', async () => {
    // When / Then
    await expect(
      service.postJournalEntry({ entryId: 'nonexistent' }, CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it('Given a posted entry, When posted, Then JournalEntryPosted event is emitted', async () => {
    // Given
    const entry = await service.createJournalEntry({
      description: 'Test',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    }, CTX);

    // When
    await service.postJournalEntry({ entryId: entry.id }, CTX);

    // Then
    expect(service.events.some((e) => e.type === 'JournalEntryPosted')).toBe(true);
  });
});

describe('JournalEntry.reverseJournalEntry', () => {
  let service: TestableJournalEntryService;

  beforeEach(() => {
    service = new TestableJournalEntryService();
    docCounter = 0;
  });

  it('Given a posted entry, When reversing, Then original is reversed and reversal is created', async () => {
    // Given
    const entry = await service.createJournalEntry({
      description: 'Original',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    }, CTX);
    await service.postJournalEntry({ entryId: entry.id }, CTX);

    // When
    const reversal = await service.reverseJournalEntry({ entryId: entry.id }, CTX);

    // Then
    expect(reversal.status).toBe('posted');
    expect(reversal.reversedEntryId).toBe(entry.id);
    expect(reversal.description).toContain('Reversal');
    // Debits/credits are swapped
    expect(reversal.lines[0]?.debitSatang).toBe(0n);
    expect(reversal.lines[0]?.creditSatang).toBe(100000n);
    expect(reversal.lines[1]?.debitSatang).toBe(100000n);
    expect(reversal.lines[1]?.creditSatang).toBe(0n);
    // Original is now reversed
    const original = service.entries.find((e) => e.id === entry.id);
    expect(original?.status).toBe('reversed');
  });

  it('Given a draft entry, When reversing, Then ConflictError is thrown', async () => {
    // Given
    const entry = await service.createJournalEntry({
      description: 'Draft',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    }, CTX);

    // When / Then
    await expect(
      service.reverseJournalEntry({ entryId: entry.id }, CTX),
    ).rejects.toThrow(ConflictError);
  });

  it('Given a reversed entry, When reversing again, Then ConflictError is thrown', async () => {
    // Given
    const entry = await service.createJournalEntry({
      description: 'Original',
      fiscalYear: 2026,
      fiscalPeriod: 1,
      lines: [
        { accountId: 'acc-1', debitSatang: '100000', creditSatang: '0' },
        { accountId: 'acc-2', debitSatang: '0', creditSatang: '100000' },
      ],
    }, CTX);
    await service.postJournalEntry({ entryId: entry.id }, CTX);
    await service.reverseJournalEntry({ entryId: entry.id }, CTX);

    // When / Then
    await expect(
      service.reverseJournalEntry({ entryId: entry.id }, CTX),
    ).rejects.toThrow(ConflictError);
  });
});
