import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * cost_centers — Controlling Cost Centers (CO-CCA).
 *
 * Cost centers represent organisational units used to collect costs.
 * They can be arranged in a parent-child hierarchy via parent_id.
 *
 * Journal entry lines can optionally reference a cost center so that costs
 * are analysed by organisational unit.
 */
export const cost_centers = pgTable('cost_centers', {
  id: text('id').primaryKey(),

  /** Short code, e.g. CC-SALES, CC-HR */
  code: text('code').notNull(),

  name_th: text('name_th').notNull(),
  name_en: text('name_en').notNull(),

  /** Self-referencing parent for hierarchical cost center trees */
  parent_id: text('parent_id'),

  is_active: boolean('is_active').notNull().default(true),

  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CostCenter = typeof cost_centers.$inferSelect;
export type NewCostCenter = typeof cost_centers.$inferInsert;
