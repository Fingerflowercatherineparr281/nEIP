import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { departments } from './departments.js';

/**
 * employees — HR employee master record.
 */
export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  employee_code: text('employee_code').notNull(),
  title_th: text('title_th').$type<'นาย' | 'นาง' | 'นางสาว'>(),
  first_name_th: text('first_name_th').notNull(),
  last_name_th: text('last_name_th').notNull(),
  first_name_en: text('first_name_en'),
  last_name_en: text('last_name_en'),
  nickname: text('nickname'),
  email: text('email'),
  phone: text('phone'),
  national_id: text('national_id'),
  tax_id: text('tax_id'),
  social_security_number: text('social_security_number'),
  date_of_birth: text('date_of_birth'),
  hire_date: text('hire_date').notNull(),
  position: text('position'),
  department_id: text('department_id').references(() => departments.id),
  employment_type: text('employment_type')
    .notNull()
    .$type<'full_time' | 'part_time' | 'contract' | 'intern'>()
    .default('full_time'),
  status: text('status')
    .notNull()
    .$type<'active' | 'resigned' | 'terminated' | 'anonymized'>()
    .default('active'),
  salary_satang: integer('salary_satang').notNull().default(0),
  bank_account_number: text('bank_account_number'),
  bank_name: text('bank_name'),
  provident_fund_percent: integer('provident_fund_percent').notNull().default(0),
  resignation_date: text('resignation_date'),
  notes: text('notes'),
  nationality: text('nationality').notNull().default('TH'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_by: text('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
