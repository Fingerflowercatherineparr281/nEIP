/**
 * Bill Service — AP domain logic and tool definitions.
 *
 * Architecture reference: Story 10.1.
 *
 * Tools:
 *   ap.createBill  — create a draft bill
 *   ap.postBill    — post a draft bill (makes it immutable)
 *   ap.voidBill    — void a draft or posted bill
 *
 * Business rules:
 *   - Minimum 1 line item
 *   - All amounts use Money VO (bigint satang)
 *   - Status flow: draft → posted → paid/partial
 *   - Voiding allowed from draft or posted (not paid/partial)
 *   - Document numbering: BILL-2026-0001
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
import { bills, bill_line_items, vendors } from '@neip/db';
import type { ToolDefinition, ExecutionContext } from '../tool-registry/types.js';
import { EventStore } from '../events/event-store.js';
import { DocumentNumberingService } from '../gl/document-numbering.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const billLineItemSchema = z.object({
  description: z.string().min(1),
  /** Amount in satang (string representation of bigint). */
  amountSatang: z.string().min(1),
  /** Account ID for the expense/asset account. */
  accountId: z.string().min(1),
});

const createBillSchema = z.object({
  vendorId: z.string().min(1),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
  lines: z.array(billLineItemSchema).min(1),
});

const postBillSchema = z.object({
  billId: z.string().min(1),
});

const voidBillSchema = z.object({
  billId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface BillLineItemOutput {
  id: string;
  lineNumber: number;
  description: string;
  amountSatang: string;
  accountId: string;
}

export interface BillOutput {
  id: string;
  documentNumber: string;
  vendorId: string;
  totalSatang: string;
  paidSatang: string;
  dueDate: string;
  notes: string | null;
  status: string;
  tenantId: string;
  createdBy: string;
  postedAt: Date | null;
  createdAt: Date;
  lines: BillLineItemOutput[];
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createBillTools(
  db: DbClient,
  eventStore: EventStore,
  docNumbering: DocumentNumberingService,
) {
  // -------------------------------------------------------------------------
  // ap.createBill
  // -------------------------------------------------------------------------
  const createBill: ToolDefinition<
    z.infer<typeof createBillSchema>,
    BillOutput
  > = {
    name: 'ap.createBill',
    description: 'Create a new draft bill (accounts payable).',
    inputSchema: createBillSchema,
    handler: async (
      params: z.infer<typeof createBillSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<BillOutput>> => {
      // Verify vendor exists and belongs to tenant
      const vendorRows = await db
        .select()
        .from(vendors)
        .where(
          and(
            eq(vendors.id, params.vendorId),
            eq(vendors.tenant_id, ctx.tenantId),
          ),
        );

      if (vendorRows[0] === undefined) {
        return err(
          new NotFoundError({ detail: `Vendor "${params.vendorId}" not found.` }),
        );
      }

      // Calculate total
      let totalSatang = 0n;
      for (const line of params.lines) {
        const amount = BigInt(line.amountSatang);
        if (amount <= 0n) {
          return err(
            new ValidationError({ detail: 'Line item amounts must be positive.' }),
          );
        }
        totalSatang += amount;
      }

      if (totalSatang === 0n) {
        return err(
          new ValidationError({ detail: 'Bill must have non-zero total amount.' }),
        );
      }

      // Generate document number
      const fiscalYear = new Date().getFullYear();
      const documentNumber = await docNumbering.next(
        ctx.tenantId,
        'bill',
        fiscalYear,
      );

      const billId = uuidv7();
      const now = new Date();

      // Insert header
      await db.insert(bills).values({
        id: billId,
        document_number: documentNumber,
        vendor_id: params.vendorId,
        total_satang: totalSatang,
        paid_satang: 0n,
        due_date: params.dueDate,
        notes: params.notes ?? null,
        status: 'draft',
        tenant_id: ctx.tenantId,
        created_by: ctx.userId,
        created_at: now,
        updated_at: now,
      });

      // Insert lines
      const lineOutputs: BillLineItemOutput[] = [];
      for (let i = 0; i < params.lines.length; i++) {
        const line = params.lines[i]!;
        const lineId = uuidv7();

        await db.insert(bill_line_items).values({
          id: lineId,
          bill_id: billId,
          line_number: i + 1,
          description: line.description,
          amount_satang: BigInt(line.amountSatang),
          account_id: line.accountId,
          created_at: now,
        });

        lineOutputs.push({
          id: lineId,
          lineNumber: i + 1,
          description: line.description,
          amountSatang: line.amountSatang,
          accountId: line.accountId,
        });
      }

      // Emit domain event
      await eventStore.append({
        type: 'BillCreated',
        aggregateId: billId,
        aggregateType: 'Bill',
        tenantId: ctx.tenantId,
        payload: {
          documentNumber,
          vendorId: params.vendorId,
          totalSatang: totalSatang.toString(),
          lineCount: params.lines.length,
        },
        version: 1,
        fiscalYear,
      });

      return ok({
        id: billId,
        documentNumber,
        vendorId: params.vendorId,
        totalSatang: totalSatang.toString(),
        paidSatang: '0',
        dueDate: params.dueDate,
        notes: params.notes ?? null,
        status: 'draft',
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
        postedAt: null,
        createdAt: now,
        lines: lineOutputs,
      });
    },
  };

  // -------------------------------------------------------------------------
  // ap.postBill
  // -------------------------------------------------------------------------
  const postBill: ToolDefinition<
    z.infer<typeof postBillSchema>,
    BillOutput
  > = {
    name: 'ap.postBill',
    description: 'Post a draft bill, making it ready for payment.',
    inputSchema: postBillSchema,
    handler: async (
      params: z.infer<typeof postBillSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<BillOutput>> => {
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

      if (bill.status !== 'draft') {
        return err(
          new ConflictError({
            detail: `Bill "${params.billId}" cannot be posted — current status is "${bill.status}".`,
          }),
        );
      }

      const postedAt = new Date();

      await db
        .update(bills)
        .set({
          status: 'posted',
          posted_at: postedAt,
          updated_at: new Date(),
        })
        .where(eq(bills.id, params.billId));

      // Get lines
      const lineRows = await db
        .select()
        .from(bill_line_items)
        .where(eq(bill_line_items.bill_id, params.billId));

      const lines: BillLineItemOutput[] = lineRows.map((l) => ({
        id: l.id,
        lineNumber: l.line_number,
        description: l.description,
        amountSatang: l.amount_satang.toString(),
        accountId: l.account_id,
      }));

      // Emit domain event
      await eventStore.append({
        type: 'BillPosted',
        aggregateId: params.billId,
        aggregateType: 'Bill',
        tenantId: ctx.tenantId,
        payload: {
          documentNumber: bill.document_number,
          postedAt: postedAt.toISOString(),
        },
        version: 2,
        fiscalYear: new Date().getFullYear(),
      });

      return ok({
        id: bill.id,
        documentNumber: bill.document_number,
        vendorId: bill.vendor_id,
        totalSatang: bill.total_satang.toString(),
        paidSatang: bill.paid_satang.toString(),
        dueDate: bill.due_date,
        notes: bill.notes,
        status: 'posted',
        tenantId: bill.tenant_id,
        createdBy: bill.created_by,
        postedAt,
        createdAt: bill.created_at,
        lines,
      });
    },
  };

  // -------------------------------------------------------------------------
  // ap.voidBill
  // -------------------------------------------------------------------------
  const voidBill: ToolDefinition<
    z.infer<typeof voidBillSchema>,
    BillOutput
  > = {
    name: 'ap.voidBill',
    description: 'Void a bill (cannot be undone). Only draft or posted bills can be voided.',
    inputSchema: voidBillSchema,
    handler: async (
      params: z.infer<typeof voidBillSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<BillOutput>> => {
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

      if (bill.status !== 'draft' && bill.status !== 'posted') {
        return err(
          new ConflictError({
            detail: `Bill "${params.billId}" cannot be voided — current status is "${bill.status}".`,
          }),
        );
      }

      await db
        .update(bills)
        .set({
          status: 'voided',
          updated_at: new Date(),
        })
        .where(eq(bills.id, params.billId));

      // Get lines
      const lineRows = await db
        .select()
        .from(bill_line_items)
        .where(eq(bill_line_items.bill_id, params.billId));

      const lines: BillLineItemOutput[] = lineRows.map((l) => ({
        id: l.id,
        lineNumber: l.line_number,
        description: l.description,
        amountSatang: l.amount_satang.toString(),
        accountId: l.account_id,
      }));

      // Emit domain event
      await eventStore.append({
        type: 'BillVoided',
        aggregateId: params.billId,
        aggregateType: 'Bill',
        tenantId: ctx.tenantId,
        payload: {
          documentNumber: bill.document_number,
        },
        version: 3,
        fiscalYear: new Date().getFullYear(),
      });

      return ok({
        id: bill.id,
        documentNumber: bill.document_number,
        vendorId: bill.vendor_id,
        totalSatang: bill.total_satang.toString(),
        paidSatang: bill.paid_satang.toString(),
        dueDate: bill.due_date,
        notes: bill.notes,
        status: 'voided',
        tenantId: bill.tenant_id,
        createdBy: bill.created_by,
        postedAt: bill.posted_at,
        createdAt: bill.created_at,
        lines,
      });
    },
  };

  return { createBill, postBill, voidBill };
}
