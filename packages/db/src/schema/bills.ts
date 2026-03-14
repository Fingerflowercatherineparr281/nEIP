import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { vendors } from './vendors.js';

/**
 * bills — Accounts Payable bill headers.
 *
 * Architecture reference: Story 10.1.
 *
 * Status transitions:
 *   draft → posted (via ap.postBill)
 *   draft → voided (via ap.voidBill)
 *   posted → paid (when fully paid via ap.recordBillPayment)
 *   posted → partial (when partially paid via ap.recordBillPayment)
 *   posted → voided (via ap.voidBill)
 */
export const bills = pgTable('bills', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  vendor_id: text('vendor_id')
    .notNull()
    .references(() => vendors.id),
  total_satang: bigint('total_satang', { mode: 'bigint' }).notNull().default(0n),
  paid_satang: bigint('paid_satang', { mode: 'bigint' }).notNull().default(0n),
  due_date: text('due_date').notNull(),
  notes: text('notes'),
  status: text('status', {
    enum: ['draft', 'posted', 'voided', 'paid', 'partial'],
  }).notNull().default('draft'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  posted_at: timestamp('posted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
