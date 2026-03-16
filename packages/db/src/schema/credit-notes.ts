import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * credit_notes — Accounts Receivable credit note (ใบลดหนี้ / CN).
 *
 * Used when: return goods, discount after invoice, correction.
 * Reduces the customer's outstanding balance by referencing the original invoice.
 *
 * Status transitions:
 *   draft  → issued  (via /credit-notes/:id/issue — creates reversing JE)
 *   issued → voided  (via /credit-notes/:id/void)
 */
export const credit_notes = pgTable('credit_notes', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  invoice_id: text('invoice_id').notNull(), // FK to invoices
  customer_id: text('customer_id').notNull(),
  customer_name: text('customer_name').notNull(),
  reason: text('reason').notNull(),
  total_satang: bigint('total_satang', { mode: 'bigint' }).notNull().default(0n),
  status: text('status', {
    enum: ['draft', 'issued', 'voided'],
  })
    .notNull()
    .default('draft'),
  notes: text('notes'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  issued_at: timestamp('issued_at', { withTimezone: true }),
  voided_at: timestamp('voided_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CreditNote = typeof credit_notes.$inferSelect;
export type NewCreditNote = typeof credit_notes.$inferInsert;
