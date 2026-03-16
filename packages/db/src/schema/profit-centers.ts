import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * profit_centers — Controlling Profit Centers (CO-PCA).
 *
 * Profit centers represent product lines or business segments used to
 * produce P&L statements at a sub-company level.
 *
 * Journal entry lines can optionally reference a profit center so that
 * revenues and costs are analysed by business segment.
 */
export const profit_centers = pgTable('profit_centers', {
  id: text('id').primaryKey(),

  /** Short code, e.g. PC-RETAIL, PC-WHOLESALE */
  code: text('code').notNull(),

  name_th: text('name_th').notNull(),
  name_en: text('name_en').notNull(),

  /** Self-referencing parent for hierarchical profit center trees */
  parent_id: text('parent_id'),

  is_active: boolean('is_active').notNull().default(true),

  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProfitCenter = typeof profit_centers.$inferSelect;
export type NewProfitCenter = typeof profit_centers.$inferInsert;
