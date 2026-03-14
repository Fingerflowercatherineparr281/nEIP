import { pgTable, text, bigint, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { chart_of_accounts } from './chart-of-accounts.js';

/**
 * budgets — Budget allocation per account per fiscal year.
 *
 * Architecture reference: Story 2.5.
 *
 * Amounts are stored in satang (bigint) for consistency with the Money VO.
 * Unique constraint ensures one budget per account per fiscal year per tenant.
 */
export const budgets = pgTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    account_id: text('account_id')
      .notNull()
      .references(() => chart_of_accounts.id, { onDelete: 'cascade' }),
    fiscal_year: integer('fiscal_year').notNull(),
    amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_budgets_account_year').on(
      table.tenant_id,
      table.account_id,
      table.fiscal_year,
    ),
  ],
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
