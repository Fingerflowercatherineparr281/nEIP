import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { chart_of_accounts } from './chart-of-accounts.js';

/**
 * bank_accounts — Bank account register (FI-BL).
 *
 * Each row represents a single bank account linked to a GL clearing account.
 * Balances are maintained in satang (1 THB = 100 satang).
 */
export const bank_accounts = pgTable('bank_accounts', {
  id: text('id').primaryKey(),
  account_name: text('account_name').notNull(),
  account_number: text('account_number').notNull(),
  bank_name: text('bank_name').notNull(),

  /** Linked GL clearing account (e.g. 1100 – Cash at Bank) */
  gl_account_id: text('gl_account_id').references(() => chart_of_accounts.id),

  currency: text('currency').notNull().default('THB'),

  /** Running balance in satang — updated on each reconciled transaction */
  balance_satang: bigint('balance_satang', { mode: 'bigint' }).notNull().default(0n),

  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BankAccount = typeof bank_accounts.$inferSelect;
export type NewBankAccount = typeof bank_accounts.$inferInsert;
