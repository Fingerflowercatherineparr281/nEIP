import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * audit_logs — Immutable audit trail for all business operations.
 *
 * Architecture reference: Story 2.8.
 *
 * Records: userId, tenantId, action, resourceType, resourceId,
 * changes (before/after), timestamp, requestId.
 *
 * No UPDATE or DELETE operations are permitted on this table.
 */
export const audit_logs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resource_type: text('resource_type').notNull(),
  resource_id: text('resource_id').notNull(),
  changes: jsonb('changes'),
  request_id: text('request_id').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof audit_logs.$inferSelect;
export type NewAuditLog = typeof audit_logs.$inferInsert;
