import { pgTable, text, bigint, integer, timestamp } from 'drizzle-orm/pg-core';
import { bills } from './bills.js';
import { chart_of_accounts } from './chart-of-accounts.js';

/**
 * bill_line_items — Individual expense lines of a bill.
 *
 * Architecture reference: Story 10.1.
 *
 * Amounts are stored in satang (bigint) for consistency with the Money VO.
 */
export const bill_line_items = pgTable('bill_line_items', {
  id: text('id').primaryKey(),
  bill_id: text('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  line_number: integer('line_number').notNull(),
  description: text('description').notNull(),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull().default(0n),
  account_id: text('account_id')
    .notNull()
    .references(() => chart_of_accounts.id),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BillLineItem = typeof bill_line_items.$inferSelect;
export type NewBillLineItem = typeof bill_line_items.$inferInsert;
