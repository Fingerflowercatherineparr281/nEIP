import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * sales_orders — Accounts Receivable sales order headers (ใบสั่งขาย / SO).
 *
 * Status transitions:
 *   draft            → confirmed        (via /sales-orders/:id/confirm)
 *   confirmed        → partial_delivered (auto, when some lines delivered)
 *   confirmed        → delivered        (auto, when all lines delivered)
 *   partial_delivered → delivered       (auto, when remaining lines delivered)
 *   draft|confirmed  → cancelled        (via /sales-orders/:id/cancel)
 */
export const sales_orders = pgTable('sales_orders', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  customer_id: text('customer_id').notNull(),
  customer_name: text('customer_name').notNull(),
  status: text('status', {
    enum: ['draft', 'confirmed', 'partial_delivered', 'delivered', 'cancelled'],
  })
    .notNull()
    .default('draft'),
  order_date: text('order_date').notNull(), // YYYY-MM-DD
  expected_delivery_date: text('expected_delivery_date'), // YYYY-MM-DD (nullable)
  total_satang: bigint('total_satang', { mode: 'bigint' }).notNull().default(0n),
  quotation_id: text('quotation_id'), // nullable FK to quotations
  notes: text('notes'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  confirmed_at: timestamp('confirmed_at', { withTimezone: true }),
  cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SalesOrder = typeof sales_orders.$inferSelect;
export type NewSalesOrder = typeof sales_orders.$inferInsert;
