import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * warehouses — Physical or logical storage locations.
 */
export const warehouses = pgTable('warehouses', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  is_default: boolean('is_default').notNull().default(false),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
