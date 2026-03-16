import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * leave_types — Types of leave with annual quota.
 */
export const leave_types = pgTable('leave_types', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name_th: text('name_th').notNull(),
  name_en: text('name_en').notNull(),
  annual_quota_days: integer('annual_quota_days').notNull().default(0),
  is_paid: boolean('is_paid').notNull().default(true),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LeaveType = typeof leave_types.$inferSelect;
export type NewLeaveType = typeof leave_types.$inferInsert;
