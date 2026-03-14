/**
 * notification_preferences — User notification settings per channel and event type.
 *
 * Each user can opt-in/opt-out of notifications by channel (email, LINE)
 * and by event type (hitl_created, approval_result, system_alert).
 *
 * Story 14.1 — Notification System
 */

import { pgTable, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const notification_preferences = pgTable(
  'notification_preferences',
  {
    /** UUIDv7 primary key */
    id: text('id').primaryKey(),
    /** FK → tenants(id) */
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** FK → users(id) */
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Whether email notifications are enabled */
    email_enabled: boolean('email_enabled').notNull().default(true),
    /** Whether LINE notifications are enabled */
    line_enabled: boolean('line_enabled').notNull().default(false),
    /** LINE Notify access token (encrypted at rest) */
    line_notify_token: text('line_notify_token'),
    /** Opt-in for HITL item created events */
    event_hitl_created: boolean('event_hitl_created').notNull().default(true),
    /** Opt-in for approval result events */
    event_approval_result: boolean('event_approval_result').notNull().default(true),
    /** Opt-in for system alert events */
    event_system_alert: boolean('event_system_alert').notNull().default(true),
    /** Creation timestamp */
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Last update timestamp */
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_preferences_user_tenant_unique').on(
      table.user_id,
      table.tenant_id,
    ),
  ],
);

export type NotificationPreference = typeof notification_preferences.$inferSelect;
export type NewNotificationPreference = typeof notification_preferences.$inferInsert;
