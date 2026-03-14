/**
 * webhooks — Webhook registration table for event delivery.
 *
 * Architecture reference: Story 13.1 (Webhook Registration + Delivery)
 *
 * Column notes:
 * - id         : UUIDv7 string, primary key
 * - tenant_id  : FK -> tenants(id), multi-tenant isolation
 * - url        : HTTPS endpoint to deliver events to
 * - events     : JSON array of event type patterns to subscribe to (e.g. ['JournalEntryCreated', '*'])
 * - secret     : HMAC-SHA256 secret for signing payloads
 * - status     : 'active' or 'failing' — marked failing after all retries exhausted
 * - last_delivery_at : timestamp of last successful delivery
 * - created_at : row creation timestamp
 * - updated_at : row update timestamp
 */

import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
  tenant_id: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: jsonb('events').notNull().$type<string[]>(),
  secret: text('secret').notNull(),
  status: text('status', { enum: ['active', 'failing'] }).notNull().default('active'),
  last_delivery_at: timestamp('last_delivery_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
