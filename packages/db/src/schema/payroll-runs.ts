import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * payroll_runs — A payroll processing run for a specific period.
 */
export const payroll_runs = pgTable('payroll_runs', {
  id: text('id').primaryKey(),
  pay_period_start: text('pay_period_start').notNull(),
  pay_period_end: text('pay_period_end').notNull(),
  run_date: text('run_date').notNull(),
  status: text('status')
    .notNull()
    .$type<'draft' | 'calculated' | 'approved' | 'paid'>()
    .default('draft'),
  total_gross_satang: integer('total_gross_satang').notNull().default(0),
  total_deductions_satang: integer('total_deductions_satang').notNull().default(0),
  total_net_satang: integer('total_net_satang').notNull().default(0),
  total_employer_ssc_satang: integer('total_employer_ssc_satang').notNull().default(0),
  total_tax_satang: integer('total_tax_satang').notNull().default(0),
  notes: text('notes'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by'),
  approved_by: text('approved_by'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PayrollRun = typeof payroll_runs.$inferSelect;
export type NewPayrollRun = typeof payroll_runs.$inferInsert;
