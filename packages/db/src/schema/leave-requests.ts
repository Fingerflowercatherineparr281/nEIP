import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees.js';
import { leave_types } from './leave-types.js';
import { tenants } from './tenants.js';

/**
 * leave_requests — Employee leave applications.
 */
export const leave_requests = pgTable('leave_requests', {
  id: text('id').primaryKey(),
  employee_id: text('employee_id')
    .notNull()
    .references(() => employees.id),
  leave_type_id: text('leave_type_id')
    .notNull()
    .references(() => leave_types.id),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  days: integer('days').notNull().default(1),
  reason: text('reason'),
  status: text('status')
    .notNull()
    .$type<'pending' | 'approved' | 'rejected' | 'cancelled'>()
    .default('pending'),
  approved_by: text('approved_by'),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  rejection_reason: text('rejection_reason'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LeaveRequest = typeof leave_requests.$inferSelect;
export type NewLeaveRequest = typeof leave_requests.$inferInsert;
