import { pgTable, text, bigint, integer, real } from 'drizzle-orm/pg-core';
import { sales_orders } from './sales-orders.js';

/**
 * sales_order_lines — Line items for a sales order.
 *
 * delivered_quantity tracks how much of the ordered quantity has been
 * fulfilled via delivery notes. Used to compute SO status transitions.
 */
export const sales_order_lines = pgTable('sales_order_lines', {
  id: text('id').primaryKey(),
  sales_order_id: text('sales_order_id')
    .notNull()
    .references(() => sales_orders.id, { onDelete: 'cascade' }),
  line_number: integer('line_number').notNull(),
  description: text('description').notNull(),
  quantity: real('quantity').notNull(),
  delivered_quantity: real('delivered_quantity').notNull().default(0),
  unit_price_satang: bigint('unit_price_satang', { mode: 'bigint' }).notNull(),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
  account_id: text('account_id'), // nullable FK to chart_of_accounts
});

export type SalesOrderLine = typeof sales_order_lines.$inferSelect;
export type NewSalesOrderLine = typeof sales_order_lines.$inferInsert;
