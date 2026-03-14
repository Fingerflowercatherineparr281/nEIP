import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { roles } from './roles.js';
import { tenants } from './tenants.js';

export const user_roles = pgTable(
  'user_roles',
  {
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role_id: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.role_id] })],
);

export type UserRole = typeof user_roles.$inferSelect;
export type NewUserRole = typeof user_roles.$inferInsert;
