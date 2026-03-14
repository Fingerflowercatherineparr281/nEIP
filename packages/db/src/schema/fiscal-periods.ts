import { pgTable, text, integer, date, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { fiscal_years } from './fiscal-years.js';

/**
 * fiscal_periods — Monthly periods within a fiscal year.
 *
 * Architecture reference: Story 2.7.
 *
 * Period status transitions:
 *   open → closed (via gl.closePeriod)
 *   closed → open (via gl.reopenPeriod)
 *
 * Posting to a closed period is blocked at the domain level.
 */
export const fiscal_periods = pgTable(
  'fiscal_periods',
  {
    id: text('id').primaryKey(),
    fiscal_year_id: text('fiscal_year_id')
      .notNull()
      .references(() => fiscal_years.id, { onDelete: 'cascade' }),
    period_number: integer('period_number').notNull(),
    start_date: date('start_date').notNull(),
    end_date: date('end_date').notNull(),
    status: text('status', {
      enum: ['open', 'closed'],
    }).notNull().default('open'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_fiscal_periods_year_number').on(
      table.fiscal_year_id,
      table.period_number,
    ),
  ],
);

export type FiscalPeriod = typeof fiscal_periods.$inferSelect;
export type NewFiscalPeriod = typeof fiscal_periods.$inferInsert;
