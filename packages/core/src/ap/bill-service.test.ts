/**
 * Tests for Bill Service — Story 10.1.
 * Given-When-Then pattern (AR29).
 *
 * Uses in-memory testable class to verify business rules without a real DB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError, ConflictError, NotFoundError } from '@neip/shared';
import type { ExecutionContext } from '../tool-registry/types.js';

// ---------------------------------------------------------------------------
// In-memory testable bill logic
// ---------------------------------------------------------------------------

interface FakeBill {
  id: string;
  documentNumber: string;
  vendorId: string;
  totalSatang: bigint;
  paidSatang: bigint;
  dueDate: string;
  notes: string | null;
  status: 'draft' | 'posted' | 'voided' | 'paid' | 'partial';
  tenantId: string;
  createdBy: string;
  postedAt: Date | null;
  createdAt: Date;
  lines: FakeLine[];
}

interface FakeLine {
  id: string;
  lineNumber: number;
  description: string;
  amountSatang: bigint;
  accountId: string;
}

interface FakeVendor {
  id: string;
  name: string;
  tenantId: string;
}

const CTX: ExecutionContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  requestId: 'req-001',
};

let docCounter = 0;

class TestableBillService {
  private readonly _bills: FakeBill[] = [];
  private readonly _vendors: FakeVendor[] = [];
  private readonly _events: { type: string; aggregateId: string }[] = [];

  addVendor(vendor: FakeVendor): void {
    this._vendors.push(vendor);
  }

  async createBill(params: {
    vendorId: string;
    dueDate: string;
    notes?: string;
    lines: { description: string; amountSatang: string; accountId: string }[];
  }, ctx: ExecutionContext): Promise<FakeBill> {
    // Verify vendor exists
    const vendor = this._vendors.find(
      (v) => v.id === params.vendorId && v.tenantId === ctx.tenantId,
    );
    if (!vendor) {
      throw new NotFoundError({ detail: `Vendor "${params.vendorId}" not found.` });
    }

    // Minimum 1 line
    if (params.lines.length < 1) {
      throw new ValidationError({ detail: 'Minimum 1 line item required.' });
    }

    // Calculate total
    let totalSatang = 0n;
    for (const line of params.lines) {
      const amount = BigInt(line.amountSatang);
      if (amount <= 0n) {
        throw new ValidationError({ detail: 'Line item amounts must be positive.' });
      }
      totalSatang += amount;
    }

    if (totalSatang === 0n) {
      throw new ValidationError({ detail: 'Bill must have non-zero total amount.' });
    }

    const { uuidv7 } = await import('uuidv7');
    docCounter++;
    const documentNumber = `BILL-2026-${docCounter.toString().padStart(4, '0')}`;

    const bill: FakeBill = {
      id: uuidv7(),
      documentNumber,
      vendorId: params.vendorId,
      totalSatang,
      paidSatang: 0n,
      dueDate: params.dueDate,
      notes: params.notes ?? null,
      status: 'draft',
      tenantId: ctx.tenantId,
      createdBy: ctx.userId,
      postedAt: null,
      createdAt: new Date(),
      lines: params.lines.map((l, i) => ({
        id: uuidv7(),
        lineNumber: i + 1,
        description: l.description,
        amountSatang: BigInt(l.amountSatang),
        accountId: l.accountId,
      })),
    };

    this._bills.push(bill);
    this._events.push({ type: 'BillCreated', aggregateId: bill.id });
    return bill;
  }

  async postBill(params: { billId: string }, ctx: ExecutionContext): Promise<FakeBill> {
    const bill = this._bills.find(
      (b) => b.id === params.billId && b.tenantId === ctx.tenantId,
    );
    if (!bill) throw new NotFoundError({ detail: `Bill "${params.billId}" not found.` });

    if (bill.status !== 'draft') {
      throw new ConflictError({
        detail: `Bill "${params.billId}" cannot be posted — current status is "${bill.status}".`,
      });
    }

    bill.status = 'posted';
    bill.postedAt = new Date();
    this._events.push({ type: 'BillPosted', aggregateId: bill.id });
    return bill;
  }

  async voidBill(params: { billId: string }, ctx: ExecutionContext): Promise<FakeBill> {
    const bill = this._bills.find(
      (b) => b.id === params.billId && b.tenantId === ctx.tenantId,
    );
    if (!bill) throw new NotFoundError({ detail: `Bill "${params.billId}" not found.` });

    if (bill.status !== 'draft' && bill.status !== 'posted') {
      throw new ConflictError({
        detail: `Bill "${params.billId}" cannot be voided — current status is "${bill.status}".`,
      });
    }

    bill.status = 'voided';
    this._events.push({ type: 'BillVoided', aggregateId: bill.id });
    return bill;
  }

  get events() { return this._events; }
  get bills() { return this._bills; }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillService.createBill', () => {
  let service: TestableBillService;

  beforeEach(() => {
    service = new TestableBillService();
    docCounter = 0;
    service.addVendor({ id: 'vendor-1', name: 'Test Vendor', tenantId: CTX.tenantId });
  });

  it('Given valid lines and vendor, When creating bill, Then draft is created with document number', async () => {
    const result = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [
        { description: 'Office supplies', amountSatang: '500000', accountId: 'acc-1' },
      ],
    }, CTX);

    expect(result.status).toBe('draft');
    expect(result.documentNumber).toBe('BILL-2026-0001');
    expect(result.totalSatang).toBe(500000n);
    expect(result.lines).toHaveLength(1);
    expect(result.tenantId).toBe(CTX.tenantId);
  });

  it('Given non-existent vendor, When creating bill, Then NotFoundError is thrown', async () => {
    await expect(
      service.createBill({
        vendorId: 'nonexistent',
        dueDate: '2026-04-15',
        lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
      }, CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it('Given zero amount line, When creating bill, Then ValidationError is thrown', async () => {
    await expect(
      service.createBill({
        vendorId: 'vendor-1',
        dueDate: '2026-04-15',
        lines: [{ description: 'Zero', amountSatang: '0', accountId: 'acc-1' }],
      }, CTX),
    ).rejects.toThrow(ValidationError);
  });

  it('Given valid bill, When created, Then BillCreated event is emitted', async () => {
    await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);

    expect(service.events).toHaveLength(1);
    expect(service.events[0]?.type).toBe('BillCreated');
  });
});

describe('BillService.postBill', () => {
  let service: TestableBillService;

  beforeEach(() => {
    service = new TestableBillService();
    docCounter = 0;
    service.addVendor({ id: 'vendor-1', name: 'Test Vendor', tenantId: CTX.tenantId });
  });

  it('Given a draft bill, When posting, Then status becomes posted', async () => {
    const bill = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);

    const result = await service.postBill({ billId: bill.id }, CTX);

    expect(result.status).toBe('posted');
    expect(result.postedAt).toBeInstanceOf(Date);
  });

  it('Given a posted bill, When posting again, Then ConflictError is thrown', async () => {
    const bill = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);
    await service.postBill({ billId: bill.id }, CTX);

    await expect(
      service.postBill({ billId: bill.id }, CTX),
    ).rejects.toThrow(ConflictError);
  });

  it('Given a non-existent bill, When posting, Then NotFoundError is thrown', async () => {
    await expect(
      service.postBill({ billId: 'nonexistent' }, CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('BillService.voidBill', () => {
  let service: TestableBillService;

  beforeEach(() => {
    service = new TestableBillService();
    docCounter = 0;
    service.addVendor({ id: 'vendor-1', name: 'Test Vendor', tenantId: CTX.tenantId });
  });

  it('Given a draft bill, When voiding, Then status becomes voided', async () => {
    const bill = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);

    const result = await service.voidBill({ billId: bill.id }, CTX);

    expect(result.status).toBe('voided');
  });

  it('Given a posted bill, When voiding, Then status becomes voided', async () => {
    const bill = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);
    await service.postBill({ billId: bill.id }, CTX);

    const result = await service.voidBill({ billId: bill.id }, CTX);

    expect(result.status).toBe('voided');
  });

  it('Given a voided bill, When voiding again, Then ConflictError is thrown', async () => {
    const bill = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);
    await service.voidBill({ billId: bill.id }, CTX);

    await expect(
      service.voidBill({ billId: bill.id }, CTX),
    ).rejects.toThrow(ConflictError);
  });

  it('Given a bill, When voided, Then BillVoided event is emitted', async () => {
    const bill = await service.createBill({
      vendorId: 'vendor-1',
      dueDate: '2026-04-15',
      lines: [{ description: 'Test', amountSatang: '100000', accountId: 'acc-1' }],
    }, CTX);

    await service.voidBill({ billId: bill.id }, CTX);

    expect(service.events.some((e) => e.type === 'BillVoided')).toBe(true);
  });
});
