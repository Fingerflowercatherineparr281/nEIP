/**
 * Bill Payment Service — AP payment recording and matching.
 *
 * Architecture reference: Story 10.2.
 *
 * Tools:
 *   ap.recordBillPayment  — record a payment against a bill
 *   ap.matchBillPayment   — match an existing payment to a bill
 *
 * Business rules:
 *   - Payment amount must be positive
 *   - Payment cannot exceed remaining bill balance
 *   - Bill status updated to 'paid' (full) or 'partial'
 *   - Auto-creates journal entry: debit AP account, credit Cash/Bank
 *   - Emits BillPaymentRecorded domain event
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ok,
  err,
} from '@neip/shared';
import type { ToolResult } from '@neip/shared';
import type { DbClient } from '@neip/db';
import { bills, bill_payments, journal_entries, journal_entry_lines } from '@neip/db';
import type { ToolDefinition, ExecutionContext } from '../tool-registry/types.js';
import { EventStore } from '../events/event-store.js';
import { DocumentNumberingService } from '../gl/document-numbering.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const recordBillPaymentSchema = z.object({
  billId: z.string().min(1),
  amountSatang: z.string().min(1),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'promptpay']),
  /** The AP account to debit. */
  apAccountId: z.string().min(1),
  /** The Cash/Bank account to credit. */
  cashAccountId: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const matchBillPaymentSchema = z.object({
  paymentId: z.string().min(1),
  billId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface BillPaymentOutput {
  id: string;
  documentNumber: string;
  billId: string;
  amountSatang: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  journalEntryId: string | null;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  billStatus: string;
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createBillPaymentTools(
  db: DbClient,
  eventStore: EventStore,
  docNumbering: DocumentNumberingService,
) {
  // -------------------------------------------------------------------------
  // ap.recordBillPayment
  // -------------------------------------------------------------------------
  const recordBillPayment: ToolDefinition<
    z.infer<typeof recordBillPaymentSchema>,
    BillPaymentOutput
  > = {
    name: 'ap.recordBillPayment',
    description: 'Record a payment against a bill (full or partial). Auto-creates a journal entry.',
    inputSchema: recordBillPaymentSchema,
    handler: async (
      params: z.infer<typeof recordBillPaymentSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<BillPaymentOutput>> => {
      // Fetch bill
      const billRows = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, params.billId),
            eq(bills.tenant_id, ctx.tenantId),
          ),
        );

      const bill = billRows[0];
      if (bill === undefined) {
        return err(
          new NotFoundError({ detail: `Bill "${params.billId}" not found.` }),
        );
      }

      if (bill.status !== 'posted' && bill.status !== 'partial') {
        return err(
          new ConflictError({
            detail: `Bill "${params.billId}" cannot accept payments — current status is "${bill.status}".`,
          }),
        );
      }

      const paymentAmount = BigInt(params.amountSatang);
      if (paymentAmount <= 0n) {
        return err(
          new ValidationError({ detail: 'Payment amount must be positive.' }),
        );
      }

      const remainingBalance = bill.total_satang - bill.paid_satang;
      if (paymentAmount > remainingBalance) {
        return err(
          new ValidationError({
            detail: `Payment amount (${paymentAmount}) exceeds remaining bill balance (${remainingBalance}).`,
          }),
        );
      }

      const fiscalYear = new Date().getFullYear();

      // Auto-create journal entry: debit AP, credit Cash/Bank
      const jeDocNumber = await docNumbering.next(ctx.tenantId, 'journal_entry', fiscalYear);
      const jeId = uuidv7();
      const now = new Date();

      await db.insert(journal_entries).values({
        id: jeId,
        document_number: jeDocNumber,
        description: `Bill payment for ${bill.document_number}`,
        status: 'posted',
        fiscal_year: fiscalYear,
        fiscal_period: now.getMonth() + 1,
        tenant_id: ctx.tenantId,
        created_by: ctx.userId,
        posted_at: now,
        created_at: now,
        updated_at: now,
      });

      // Debit AP account
      await db.insert(journal_entry_lines).values({
        id: uuidv7(),
        entry_id: jeId,
        line_number: 1,
        account_id: params.apAccountId,
        description: `AP payment - ${bill.document_number}`,
        debit_satang: paymentAmount,
        credit_satang: 0n,
        created_at: now,
      });

      // Credit Cash/Bank account
      await db.insert(journal_entry_lines).values({
        id: uuidv7(),
        entry_id: jeId,
        line_number: 2,
        account_id: params.cashAccountId,
        description: `AP payment - ${bill.document_number}`,
        debit_satang: 0n,
        credit_satang: paymentAmount,
        created_at: now,
      });

      // Generate payment document number
      const paymentDocNumber = await docNumbering.next(ctx.tenantId, 'payment', fiscalYear);
      const paymentId = uuidv7();

      // Insert payment record
      await db.insert(bill_payments).values({
        id: paymentId,
        document_number: paymentDocNumber,
        bill_id: params.billId,
        amount_satang: paymentAmount,
        payment_date: params.paymentDate,
        payment_method: params.paymentMethod,
        reference: params.reference ?? null,
        notes: params.notes ?? null,
        journal_entry_id: jeId,
        tenant_id: ctx.tenantId,
        created_by: ctx.userId,
        created_at: now,
      });

      // Update bill paid amount and status
      const newPaidSatang = bill.paid_satang + paymentAmount;
      const newStatus = newPaidSatang >= bill.total_satang ? 'paid' : 'partial';

      await db
        .update(bills)
        .set({
          paid_satang: newPaidSatang,
          status: newStatus,
          updated_at: now,
        })
        .where(eq(bills.id, params.billId));

      // Emit domain event
      await eventStore.append({
        type: 'BillPaymentRecorded',
        aggregateId: paymentId,
        aggregateType: 'BillPayment',
        tenantId: ctx.tenantId,
        payload: {
          billId: params.billId,
          billDocumentNumber: bill.document_number,
          paymentDocumentNumber: paymentDocNumber,
          amountSatang: paymentAmount.toString(),
          journalEntryId: jeId,
          billStatus: newStatus,
        },
        version: 1,
        fiscalYear,
      });

      return ok({
        id: paymentId,
        documentNumber: paymentDocNumber,
        billId: params.billId,
        amountSatang: paymentAmount.toString(),
        paymentDate: params.paymentDate,
        paymentMethod: params.paymentMethod,
        reference: params.reference ?? null,
        notes: params.notes ?? null,
        journalEntryId: jeId,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
        createdAt: now,
        billStatus: newStatus,
      });
    },
  };

  // -------------------------------------------------------------------------
  // ap.matchBillPayment
  // -------------------------------------------------------------------------
  const matchBillPayment: ToolDefinition<
    z.infer<typeof matchBillPaymentSchema>,
    BillPaymentOutput
  > = {
    name: 'ap.matchBillPayment',
    description: 'Match an existing payment to a bill.',
    inputSchema: matchBillPaymentSchema,
    handler: async (
      params: z.infer<typeof matchBillPaymentSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<BillPaymentOutput>> => {
      // Fetch payment
      const paymentRows = await db
        .select()
        .from(bill_payments)
        .where(
          and(
            eq(bill_payments.id, params.paymentId),
            eq(bill_payments.tenant_id, ctx.tenantId),
          ),
        );

      const payment = paymentRows[0];
      if (payment === undefined) {
        return err(
          new NotFoundError({ detail: `Payment "${params.paymentId}" not found.` }),
        );
      }

      // Fetch bill
      const billRows = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, params.billId),
            eq(bills.tenant_id, ctx.tenantId),
          ),
        );

      const bill = billRows[0];
      if (bill === undefined) {
        return err(
          new NotFoundError({ detail: `Bill "${params.billId}" not found.` }),
        );
      }

      if (bill.status !== 'posted' && bill.status !== 'partial') {
        return err(
          new ConflictError({
            detail: `Bill "${params.billId}" cannot accept payments — current status is "${bill.status}".`,
          }),
        );
      }

      const remainingBalance = bill.total_satang - bill.paid_satang;
      if (payment.amount_satang > remainingBalance) {
        return err(
          new ValidationError({
            detail: `Payment amount (${payment.amount_satang}) exceeds remaining bill balance (${remainingBalance}).`,
          }),
        );
      }

      // Update bill
      const newPaidSatang = bill.paid_satang + payment.amount_satang;
      const newStatus = newPaidSatang >= bill.total_satang ? 'paid' : 'partial';

      await db
        .update(bills)
        .set({
          paid_satang: newPaidSatang,
          status: newStatus,
          updated_at: new Date(),
        })
        .where(eq(bills.id, params.billId));

      return ok({
        id: payment.id,
        documentNumber: payment.document_number,
        billId: params.billId,
        amountSatang: payment.amount_satang.toString(),
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method,
        reference: payment.reference,
        notes: payment.notes,
        journalEntryId: payment.journal_entry_id,
        tenantId: payment.tenant_id,
        createdBy: payment.created_by,
        createdAt: payment.created_at,
        billStatus: newStatus,
      });
    },
  };

  return { recordBillPayment, matchBillPayment };
}
