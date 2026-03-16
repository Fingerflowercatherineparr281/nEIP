import { pgTable, text, bigint, integer, real } from 'drizzle-orm/pg-core';
import { purchase_orders } from './purchase-orders.js';

/**
 * purchase_order_lines — Line items for a purchase order.
 *
 * received_quantity tracks how much of the ordered quantity has been
 * received, which drives PO status transitions.
 */
export const purchase_order_lines = pgTable('purchase_order_lines', {
  id: text('id').primaryKey(),
  purchase_order_id: text('purchase_order_id')
    .notNull()
    .references(() => purchase_orders.id, { onDelete: 'cascade' }),
  line_number: integer('line_number').notNull(),
  description: text('description').notNull(),
  quantity: real('quantity').notNull(),
  received_quantity: real('received_quantity').notNull().default(0),
  unit_price_satang: bigint('unit_price_satang', { mode: 'bigint' }).notNull(),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
  account_id: text('account_id'), // nullable FK to chart_of_accounts
});

export type PurchaseOrderLine = typeof purchase_order_lines.$inferSelect;
export type NewPurchaseOrderLine = typeof purchase_order_lines.$inferInsert;
