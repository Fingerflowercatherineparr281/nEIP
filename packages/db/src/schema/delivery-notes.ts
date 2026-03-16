import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sales_orders } from './sales-orders.js';

/**
 * delivery_notes — Delivery note headers (ใบส่งของ / DO).
 *
 * Status transitions:
 *   draft     → delivered  (via /delivery-notes/:id/deliver)
 *   draft     → cancelled  (via /delivery-notes/:id/cancel)
 */
export const delivery_notes = pgTable('delivery_notes', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  sales_order_id: text('sales_order_id')
    .notNull()
    .references(() => sales_orders.id, { onDelete: 'restrict' }),
  customer_id: text('customer_id').notNull(),
  customer_name: text('customer_name').notNull(),
  status: text('status', {
    enum: ['draft', 'delivered', 'cancelled'],
  })
    .notNull()
    .default('draft'),
  delivery_date: text('delivery_date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  delivered_at: timestamp('delivered_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DeliveryNote = typeof delivery_notes.$inferSelect;
export type NewDeliveryNote = typeof delivery_notes.$inferInsert;
