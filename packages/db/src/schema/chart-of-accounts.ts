import { pgTable, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * chart_of_accounts — Chart of Accounts following TFAC standards.
 *
 * Architecture reference: Story 2.5.
 *
 * Account types map to the five TFAC categories:
 *   1xxx — Asset (สินทรัพย์)
 *   2xxx — Liability (หนี้สิน)
 *   3xxx — Equity (ส่วนของผู้ถือหุ้น)
 *   4xxx — Revenue (รายได้)
 *   5xxx — Expense (ค่าใช้จ่าย)
 *
 * Soft delete via is_active = false (accounts are never physically deleted).
 * Code is unique per tenant (enforced by unique index).
 */
export const chart_of_accounts = pgTable(
  'chart_of_accounts',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name_th: text('name_th').notNull(),
    name_en: text('name_en').notNull(),
    account_type: text('account_type', {
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    parent_id: text('parent_id'),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_coa_tenant_code').on(table.tenant_id, table.code),
  ],
);

export type ChartOfAccount = typeof chart_of_accounts.$inferSelect;
export type NewChartOfAccount = typeof chart_of_accounts.$inferInsert;
