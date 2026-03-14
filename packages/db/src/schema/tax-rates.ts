import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * tax_rates — Tax rate configuration with effective dates.
 *
 * Architecture reference: Story 11.1.
 *
 * Supports both VAT and WHT rates, with per-tenant overrides and
 * effective date ranges. The most recent rate with effective_from <= txn date
 * is used for calculations.
 *
 * rate_basis_points stores the rate as an integer:
 *   700 = 7.00% (standard VAT)
 *   300 = 3.00% (services WHT)
 *   etc.
 */
export const tax_rates = pgTable(
  'tax_rates',
  {
    id: text('id').primaryKey(),
    /** Tax type: 'vat' or 'wht'. */
    tax_type: text('tax_type', {
      enum: ['vat', 'wht'],
    }).notNull(),
    /** Rate in basis points (e.g. 700 = 7.00%). Integer to avoid float. */
    rate_basis_points: integer('rate_basis_points').notNull(),
    /** WHT income type (null for VAT rates). */
    income_type: text('income_type'),
    /** Date from which this rate takes effect. */
    effective_from: timestamp('effective_from', { withTimezone: true }).notNull(),
    /** Tenant that owns this rate. */
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_tax_rates_lookup').on(
      table.tenant_id,
      table.tax_type,
      table.income_type,
      table.effective_from,
    ),
  ],
);

export type TaxRateRow = typeof tax_rates.$inferSelect;
export type NewTaxRateRow = typeof tax_rates.$inferInsert;
