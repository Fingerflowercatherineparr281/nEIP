import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { vendors } from './vendors.js';

/**
 * purchase_orders — Accounts Payable purchase order headers (ใบสั่งซื้อ / PO).
 *
 * Status transitions:
 *   draft            → sent             (via /purchase-orders/:id/send)
 *   sent             → partial_received (auto, when some lines received)
 *   sent             → received         (auto, when all lines received)
 *   partial_received → received         (auto, when remaining lines received)
 *   draft|sent       → cancelled        (via /purchase-orders/:id/cancel)
 */
export const purchase_orders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  vendor_id: text('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'restrict' }),
  status: text('status', {
    enum: ['draft', 'sent', 'partial_received', 'received', 'cancelled'],
  })
    .notNull()
    .default('draft'),
  order_date: text('order_date').notNull(), // YYYY-MM-DD
  expected_date: text('expected_date'), // YYYY-MM-DD (nullable)
  total_satang: bigint('total_satang', { mode: 'bigint' }).notNull().default(0n),
  notes: text('notes'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  sent_at: timestamp('sent_at', { withTimezone: true }),
  cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
  converted_bill_id: text('converted_bill_id'), // set when convert-to-bill is called
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PurchaseOrder = typeof purchase_orders.$inferSelect;
export type NewPurchaseOrder = typeof purchase_orders.$inferInsert;
