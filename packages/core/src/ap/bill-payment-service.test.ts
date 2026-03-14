/**
 * Tests for Bill Payment Service — Story 10.2.
 * Given-When-Then pattern (AR29).
 *
 * Uses in-memory testable class to verify business rules without a real DB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError, ConflictError, NotFoundError } from '@neip/shared';
import type { ExecutionContext } from '../tool-registry/types.js';

// ---------------------------------------------------------------------------
// In-memory testable bill payment logic
// ---------------------------------------------------------------------------

interface FakeBill {
  id: string;
  documentNumber: string;
  totalSatang: bigint;
  paidSatang: bigint;
  status: 'draft' | 'posted' | 'voided' | 'paid' | 'partial';
  tenantId: string;
}

interface FakePayment {
  id: string;
  documentNumber: string;
  billId: string;
  amountSatang: bigint;
  paymentDate: string;
  paymentMethod: string;
  billStatus: string;
  tenantId: string;
}

const CTX: ExecutionContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  requestId: 'req-001',
};

let paymentCounter = 0;

class TestableBillPaymentService {
  private readonly _bills: FakeBill[] = [];
  private readonly _payments: FakePayment[] = [];
  private readonly _events: { type: string; aggregateId: string }[] = [];

  addBill(bill: FakeBill): void {
    this._bills.push(bill);
  }

  async recordBillPayment(params: {
    billId: string;
    amountSatang: string;
    paymentDate: string;
    paymentMethod: string;
    apAccountId: string;
    cashAccountId: string;
  }, ctx: ExecutionContext): Promise<FakePayment> {
    const bill = this._bills.find(
      (b) => b.id === params.billId && b.tenantId === ctx.tenantId,
    );
    if (!bill) {
      throw new NotFoundError({ detail: `Bill "${params.billId}" not found.` });
    }

    if (bill.status !== 'posted' && bill.status !== 'partial') {
      throw new ConflictError({
        detail: `Bill "${params.billId}" cannot accept payments — current status is "${bill.status}".`,
      });
    }

    const paymentAmount = BigInt(params.amountSatang);
    if (paymentAmount <= 0n) {
      throw new ValidationError({ detail: 'Payment amount must be positive.' });
    }

    const remaining = bill.totalSatang - bill.paidSatang;
    if (paymentAmount > remaining) {
      throw new ValidationError({
        detail: `Payment amount (${paymentAmount}) exceeds remaining bill balance (${remaining}).`,
      });
    }

    const { uuidv7 } = await import('uuidv7');
    paymentCounter++;

    // Update bill
    bill.paidSatang = bill.paidSatang + paymentAmount;
    bill.status = bill.paidSatang >= bill.totalSatang ? 'paid' : 'partial';

    const payment: FakePayment = {
      id: uuidv7(),
      documentNumber: `PMT-2026-${paymentCounter.toString().padStart(4, '0')}`,
      billId: params.billId,
      amountSatang: paymentAmount,
      paymentDate: params.paymentDate,
      paymentMethod: params.paymentMethod,
      billStatus: bill.status,
      tenantId: ctx.tenantId,
    };

    this._payments.push(payment);
    this._events.push({ type: 'BillPaymentRecorded', aggregateId: payment.id });
    return payment;
  }

  get events() { return this._events; }
  get payments() { return this._payments; }
  get bills() { return this._bills; }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillPaymentService.recordBillPayment', () => {
  let service: TestableBillPaymentService;

  beforeEach(() => {
    service = new TestableBillPaymentService();
    paymentCounter = 0;
  });

  it('Given a posted bill, When recording full payment, Then bill status becomes paid', async () => {
    service.addBill({
      id: 'bill-1',
      documentNumber: 'BILL-2026-0001',
      totalSatang: 100000n,
      paidSatang: 0n,
      status: 'posted',
      tenantId: CTX.tenantId,
    });

    const result = await service.recordBillPayment({
      billId: 'bill-1',
      amountSatang: '100000',
      paymentDate: '2026-03-15',
      paymentMethod: 'bank_transfer',
      apAccountId: 'ap-acc',
      cashAccountId: 'cash-acc',
    }, CTX);

    expect(result.billStatus).toBe('paid');
    expect(result.amountSatang).toBe(100000n);
  });

  it('Given a posted bill, When recording partial payment, Then bill status becomes partial', async () => {
    service.addBill({
      id: 'bill-1',
      documentNumber: 'BILL-2026-0001',
      totalSatang: 100000n,
      paidSatang: 0n,
      status: 'posted',
      tenantId: CTX.tenantId,
    });

    const result = await service.recordBillPayment({
      billId: 'bill-1',
      amountSatang: '50000',
      paymentDate: '2026-03-15',
      paymentMethod: 'cash',
      apAccountId: 'ap-acc',
      cashAccountId: 'cash-acc',
    }, CTX);

    expect(result.billStatus).toBe('partial');
  });

  it('Given a draft bill, When recording payment, Then ConflictError is thrown', async () => {
    service.addBill({
      id: 'bill-1',
      documentNumber: 'BILL-2026-0001',
      totalSatang: 100000n,
      paidSatang: 0n,
      status: 'draft',
      tenantId: CTX.tenantId,
    });

    await expect(
      service.recordBillPayment({
        billId: 'bill-1',
        amountSatang: '100000',
        paymentDate: '2026-03-15',
        paymentMethod: 'cash',
        apAccountId: 'ap-acc',
        cashAccountId: 'cash-acc',
      }, CTX),
    ).rejects.toThrow(ConflictError);
  });

  it('Given a posted bill, When payment exceeds remaining balance, Then ValidationError is thrown', async () => {
    service.addBill({
      id: 'bill-1',
      documentNumber: 'BILL-2026-0001',
      totalSatang: 100000n,
      paidSatang: 0n,
      status: 'posted',
      tenantId: CTX.tenantId,
    });

    await expect(
      service.recordBillPayment({
        billId: 'bill-1',
        amountSatang: '200000',
        paymentDate: '2026-03-15',
        paymentMethod: 'cash',
        apAccountId: 'ap-acc',
        cashAccountId: 'cash-acc',
      }, CTX),
    ).rejects.toThrow(ValidationError);
  });

  it('Given a non-existent bill, When recording payment, Then NotFoundError is thrown', async () => {
    await expect(
      service.recordBillPayment({
        billId: 'nonexistent',
        amountSatang: '100000',
        paymentDate: '2026-03-15',
        paymentMethod: 'cash',
        apAccountId: 'ap-acc',
        cashAccountId: 'cash-acc',
      }, CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it('Given a payment, When recorded, Then BillPaymentRecorded event is emitted', async () => {
    service.addBill({
      id: 'bill-1',
      documentNumber: 'BILL-2026-0001',
      totalSatang: 100000n,
      paidSatang: 0n,
      status: 'posted',
      tenantId: CTX.tenantId,
    });

    await service.recordBillPayment({
      billId: 'bill-1',
      amountSatang: '50000',
      paymentDate: '2026-03-15',
      paymentMethod: 'bank_transfer',
      apAccountId: 'ap-acc',
      cashAccountId: 'cash-acc',
    }, CTX);

    expect(service.events).toHaveLength(1);
    expect(service.events[0]?.type).toBe('BillPaymentRecorded');
  });

  it('Given a partial bill, When recording remaining payment, Then bill becomes paid', async () => {
    service.addBill({
      id: 'bill-1',
      documentNumber: 'BILL-2026-0001',
      totalSatang: 100000n,
      paidSatang: 50000n,
      status: 'partial',
      tenantId: CTX.tenantId,
    });

    const result = await service.recordBillPayment({
      billId: 'bill-1',
      amountSatang: '50000',
      paymentDate: '2026-03-15',
      paymentMethod: 'cash',
      apAccountId: 'ap-acc',
      cashAccountId: 'cash-acc',
    }, CTX);

    expect(result.billStatus).toBe('paid');
  });
});
