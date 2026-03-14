import { pgTable, text, bigint, integer, timestamp } from 'drizzle-orm/pg-core';
import { journal_entries } from './journal-entries.js';
import { chart_of_accounts } from './chart-of-accounts.js';

/**
 * journal_entry_lines — Individual debit/credit lines of a journal entry.
 *
 * Architecture reference: Story 2.4.
 *
 * Amounts are stored in satang (bigint) for consistency with the Money VO.
 * Each line represents either a debit or a credit (one will be 0).
 */
export const journal_entry_lines = pgTable('journal_entry_lines', {
  id: text('id').primaryKey(),
  entry_id: text('entry_id')
    .notNull()
    .references(() => journal_entries.id, { onDelete: 'cascade' }),
  line_number: integer('line_number').notNull(),
  account_id: text('account_id')
    .notNull()
    .references(() => chart_of_accounts.id),
  description: text('description'),
  debit_satang: bigint('debit_satang', { mode: 'bigint' }).notNull().default(0n),
  credit_satang: bigint('credit_satang', { mode: 'bigint' }).notNull().default(0n),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type JournalEntryLine = typeof journal_entry_lines.$inferSelect;
export type NewJournalEntryLine = typeof journal_entry_lines.$inferInsert;
