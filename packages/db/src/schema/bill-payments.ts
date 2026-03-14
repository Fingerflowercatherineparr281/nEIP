import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { bills } from './bills.js';

/**
 * bill_payments — Accounts Payable payment records linked to bills.
 *
 * Architecture reference: Story 10.2.
 *
 * Each record represents a payment (full or partial) applied to a bill.
 * A journal entry is auto-created: debit AP, credit Cash/Bank.
 */
export const bill_payments = pgTable('bill_payments', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  bill_id: text('bill_id')
    .notNull()
    .references(() => bills.id),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
  payment_date: text('payment_date').notNull(),
  payment_method: text('payment_method', {
    enum: ['cash', 'bank_transfer', 'cheque', 'promptpay'],
  }).notNull(),
  reference: text('reference'),
  notes: text('notes'),
  /** Journal entry ID created for this payment (debit AP, credit Cash/Bank). */
  journal_entry_id: text('journal_entry_id'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BillPayment = typeof bill_payments.$inferSelect;
export type NewBillPayment = typeof bill_payments.$inferInsert;
