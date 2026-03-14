import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * vendors — Accounts Payable vendor/supplier records.
 *
 * Architecture reference: Story 10.1.
 */
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tax_id: text('tax_id'),
  address: text('address'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
