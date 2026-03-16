import { pgTable, text, bigint, boolean, timestamp, date } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { bank_accounts } from './bank-accounts.js';
import { journal_entries } from './journal-entries.js';

/**
 * bank_transactions — Individual bank statement lines (FI-BL).
 *
 * Each row is a single debit or credit movement on a bank account.
 * A transaction is "reconciled" when it has been matched to a Journal Entry.
 *
 * Amounts are stored in satang (1 THB = 100 satang).
 */
export const bank_transactions = pgTable('bank_transactions', {
  id: text('id').primaryKey(),

  bank_account_id: text('bank_account_id')
    .notNull()
    .references(() => bank_accounts.id, { onDelete: 'cascade' }),

  transaction_date: date('transaction_date').notNull(),
  description: text('description').notNull(),

  debit_satang: bigint('debit_satang', { mode: 'bigint' }).notNull().default(0n),
  credit_satang: bigint('credit_satang', { mode: 'bigint' }).notNull().default(0n),

  /** Bank reference / cheque number / transfer ref */
  reference: text('reference'),

  /** True once matched to a posted Journal Entry */
  reconciled: boolean('reconciled').notNull().default(false),

  /** Journal Entry used to reconcile this transaction (nullable) */
  reconciled_je_id: text('reconciled_je_id').references(() => journal_entries.id),

  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BankTransaction = typeof bank_transactions.$inferSelect;
export type NewBankTransaction = typeof bank_transactions.$inferInsert;
