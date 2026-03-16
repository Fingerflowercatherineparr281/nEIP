import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { payroll_runs } from './payroll-runs.js';
import { employees } from './employees.js';

/**
 * payroll_items — Per-employee line within a payroll run.
 */
export const payroll_items = pgTable('payroll_items', {
  id: text('id').primaryKey(),
  payroll_run_id: text('payroll_run_id')
    .notNull()
    .references(() => payroll_runs.id, { onDelete: 'cascade' }),
  employee_id: text('employee_id')
    .notNull()
    .references(() => employees.id),
  base_salary_satang: integer('base_salary_satang').notNull().default(0),
  overtime_satang: integer('overtime_satang').notNull().default(0),
  bonus_satang: integer('bonus_satang').notNull().default(0),
  allowance_satang: integer('allowance_satang').notNull().default(0),
  gross_satang: integer('gross_satang').notNull().default(0),
  social_security_satang: integer('social_security_satang').notNull().default(0),
  provident_fund_satang: integer('provident_fund_satang').notNull().default(0),
  personal_income_tax_satang: integer('personal_income_tax_satang').notNull().default(0),
  other_deductions_satang: integer('other_deductions_satang').notNull().default(0),
  total_deductions_satang: integer('total_deductions_satang').notNull().default(0),
  net_satang: integer('net_satang').notNull().default(0),
  employer_ssc_satang: integer('employer_ssc_satang').notNull().default(0),
  payment_method: text('payment_method')
    .$type<'bank_transfer' | 'cash' | 'cheque'>()
    .default('bank_transfer'),
  status: text('status')
    .notNull()
    .$type<'calculated' | 'paid'>()
    .default('calculated'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PayrollItem = typeof payroll_items.$inferSelect;
export type NewPayrollItem = typeof payroll_items.$inferInsert;
