import { pgTable, text, bigint, real } from 'drizzle-orm/pg-core';
import { credit_notes } from './credit-notes.js';

/**
 * credit_note_lines — Line items for a credit note.
 */
export const credit_note_lines = pgTable('credit_note_lines', {
  id: text('id').primaryKey(),
  credit_note_id: text('credit_note_id')
    .notNull()
    .references(() => credit_notes.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull(),
  unit_price_satang: bigint('unit_price_satang', { mode: 'bigint' }).notNull(),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
  account_id: text('account_id'), // nullable FK to chart_of_accounts
});

export type CreditNoteLine = typeof credit_note_lines.$inferSelect;
export type NewCreditNoteLine = typeof credit_note_lines.$inferInsert;
