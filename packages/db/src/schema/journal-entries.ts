import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * journal_entries — General Ledger journal entry headers.
 *
 * Architecture reference: Story 2.4.
 *
 * Status transitions:
 *   draft → posted (via gl.postJournalEntry)
 *   posted → reversed (via gl.reverseJournalEntry)
 *
 * Posted entries are immutable — they can only be reversed, not modified.
 */
export const journal_entries = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  document_number: text('document_number').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['draft', 'posted', 'reversed'],
  }).notNull().default('draft'),
  fiscal_year: integer('fiscal_year').notNull(),
  fiscal_period: integer('fiscal_period').notNull(),
  /** ID of the entry this reversal was created for (null if not a reversal). */
  reversed_entry_id: text('reversed_entry_id'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by').notNull(),
  posted_at: timestamp('posted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type JournalEntry = typeof journal_entries.$inferSelect;
export type NewJournalEntry = typeof journal_entries.$inferInsert;
