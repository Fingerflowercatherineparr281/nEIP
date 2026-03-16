import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * products — Inventory product / item master.
 *
 * Architecture reference: Inventory / MM-IM module.
 */
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull(),
  name_th: text('name_th').notNull(),
  name_en: text('name_en').notNull(),
  description: text('description'),
  category: text('category'),
  unit: text('unit').notNull().default('ชิ้น'),
  cost_price_satang: integer('cost_price_satang').notNull().default(0),
  selling_price_satang: integer('selling_price_satang').notNull().default(0),
  min_stock_level: integer('min_stock_level').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  gl_account_id: text('gl_account_id'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
