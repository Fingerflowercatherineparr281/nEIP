/**
 * notification_log — Sent notifications log.
 *
 * Records every notification attempt with channel, status, and error details
 * for debugging and audit purposes.
 *
 * Story 14.1 — Notification System
 */

import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const notification_log = pgTable(
  'notification_log',
  {
    /** UUIDv7 primary key */
    id: text('id').primaryKey(),
    /** FK → tenants(id) */
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** FK → users(id) — the recipient */
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Delivery channel: 'email' | 'line' */
    channel: text('channel').notNull(),
    /** Event type that triggered this notification */
    event_type: text('event_type').notNull(),
    /** Template ID used for rendering */
    template_id: text('template_id').notNull(),
    /** Template data used for rendering (for debugging) */
    template_data: jsonb('template_data').notNull().default({}),
    /** Delivery status: 'pending' | 'sent' | 'failed' */
    status: text('status').notNull().default('pending'),
    /** Error message if delivery failed */
    error_message: text('error_message'),
    /** Recipient address (email address or LINE user display) */
    recipient_address: text('recipient_address'),
    /** Creation timestamp */
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Timestamp when delivery was completed or failed */
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_notification_log_user_tenant').on(table.user_id, table.tenant_id),
    index('idx_notification_log_status').on(table.status),
    index('idx_notification_log_created_at').on(table.created_at),
  ],
);

export type NotificationLog = typeof notification_log.$inferSelect;
export type NewNotificationLog = typeof notification_log.$inferInsert;
