import { pgTable, text, bigint, integer, timestamp } from 'drizzle-orm/pg-core';
import { quotations } from './quotations.js';
import { chart_of_accounts } from './chart-of-accounts.js';

/**
 * quotation_lines — Individual line items on a quotation (ใบเสนอราคา).
 *
 * Amounts are stored in satang (bigint) for consistency with the Money VO.
 */
export const quotation_lines = pgTable('quotation_lines', {
  id: text('id').primaryKey(),
  quotation_id: text('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
  line_number: integer('line_number').notNull(),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unit_price_satang: bigint('unit_price_satang', { mode: 'bigint' }).notNull(),
  amount_satang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
  account_id: text('account_id').references(() => chart_of_accounts.id),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type QuotationLine = typeof quotation_lines.$inferSelect;
export type NewQuotationLine = typeof quotation_lines.$inferInsert;
