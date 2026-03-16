import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * departments — Organisational departments / cost centres.
 *
 * manager_id is a self-reference to employees (set later via FK in migration
 * to avoid circular import at schema level).
 */
export const departments = pgTable('departments', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name_th: text('name_th').notNull(),
  name_en: text('name_en').notNull(),
  manager_id: text('manager_id'),      // FK to employees.id (deferred)
  cost_center_id: text('cost_center_id'),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
