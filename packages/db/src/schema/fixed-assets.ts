import { pgTable, text, bigint, integer, timestamp, date } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { chart_of_accounts } from './chart-of-accounts.js';

/**
 * fixed_assets — Fixed Asset Register (สินทรัพย์ถาวร / FI-AA).
 *
 * Tracks the lifecycle of a fixed asset from purchase through depreciation
 * to disposal or write-off.
 *
 * Status transitions:
 *   active → disposed (sold or scrapped)
 *   active → written_off (impairment or loss)
 *
 * Amounts are stored in satang (1 THB = 100 satang) as BIGINT.
 */
export const fixed_assets = pgTable('fixed_assets', {
  id: text('id').primaryKey(),

  /** Human-readable code, e.g. FA-2026-001 */
  asset_code: text('asset_code').notNull(),

  name_th: text('name_th').notNull(),
  name_en: text('name_en').notNull(),

  category: text('category', {
    enum: ['land', 'building', 'equipment', 'vehicle', 'furniture', 'it_equipment', 'other'],
  }).notNull(),

  purchase_date: date('purchase_date').notNull(),
  purchase_cost_satang: bigint('purchase_cost_satang', { mode: 'bigint' }).notNull(),
  salvage_value_satang: bigint('salvage_value_satang', { mode: 'bigint' }).notNull().default(0n),

  /** Expected useful life in months */
  useful_life_months: integer('useful_life_months').notNull(),

  depreciation_method: text('depreciation_method', {
    enum: ['straight_line', 'declining_balance'],
  }).notNull().default('straight_line'),

  accumulated_depreciation_satang: bigint('accumulated_depreciation_satang', {
    mode: 'bigint',
  }).notNull().default(0n),

  /** Computed: purchase_cost - accumulated_depreciation - salvage_value_floor */
  net_book_value_satang: bigint('net_book_value_satang', { mode: 'bigint' }).notNull(),

  status: text('status', {
    enum: ['active', 'disposed', 'written_off'],
  }).notNull().default('active'),

  disposal_date: date('disposal_date'),
  disposal_amount_satang: bigint('disposal_amount_satang', { mode: 'bigint' }),

  /** GL asset account (e.g. 1600 – Fixed Assets) */
  gl_account_id: text('gl_account_id').references(() => chart_of_accounts.id),

  /** GL depreciation expense account (e.g. 5610 – Depreciation Expense) */
  depreciation_account_id: text('depreciation_account_id').references(
    () => chart_of_accounts.id,
  ),

  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  created_by: text('created_by').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type FixedAsset = typeof fixed_assets.$inferSelect;
export type NewFixedAsset = typeof fixed_assets.$inferInsert;
