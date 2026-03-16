import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * receipts — Accounts Receivable official receipt (ใบเสร็จรับเงิน).
 *
 * Issued when a customer payment is confirmed. Can reference an AR payment
 * and/or an invoice for traceability.
 *
 * Status transitions:
 *   issued → voided  (via /receipts/:id/void)
 */
export const receipts = pgTable('receipts', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  payment_id: text('payment_id'), // nullable FK to ar payments
  invoice_id: text('invoice_id'), // nullable FK to invoices
  customer_id: text('customer_id').notNull(),
  customer_name: text('customer_name').notNull(),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
  receipt_date: text('receipt_date').notNull(), // YYYY-MM-DD
  payment_method: text('payment_method').notNull().default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  status: text('status', {
    enum: ['issued', 'voided'],
  })
    .notNull()
    .default('issued'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  voided_at: timestamp('voided_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
