import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './roles.js';
import { permissions } from './permissions.js';
import { tenants } from './tenants.js';

export const role_permissions = pgTable(
  'role_permissions',
  {
    role_id: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission_id: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.role_id, table.permission_id] })],
);

export type RolePermission = typeof role_permissions.$inferSelect;
export type NewRolePermission = typeof role_permissions.$inferInsert;
