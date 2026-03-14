/**
 * hitl_queue — Human-in-the-Loop review queue table.
 *
 * Stores AI results that fall below the auto-threshold and require human
 * review before execution. Supports approve/reject/reassign workflows.
 *
 * Architecture reference: AR11 (HITL model), FR19-FR21
 * Story: 5.4
 */

import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const hitl_queue = pgTable(
  'hitl_queue',
  {
    /** UUIDv7 — time-sortable unique identifier */
    id: text('id').primaryKey(),
    /** FK → tenants(id) for multi-tenancy isolation */
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Reference to the source document (e.g. payment ID, invoice ID) */
    document_ref: text('document_ref').notNull(),
    /** Type of document being reviewed (e.g. 'invoice-match', 'payment-apply') */
    document_type: text('document_type').notNull(),
    /** Amount in satang (serialised as decimal string for bigint safety) */
    amount: text('amount').notNull(),
    /** AI confidence score [0, 1] */
    confidence: text('confidence').notNull(),
    /** AI reasoning trace — human-readable explanation (FR18) */
    ai_reasoning: jsonb('ai_reasoning').notNull(),
    /** AI-suggested action as structured JSON */
    suggested_action: jsonb('suggested_action').notNull(),
    /** Current status of the review item */
    status: text('status').notNull().default('pending'),
    /** User who created / triggered the queue item (usually 'system') */
    created_by: text('created_by').notNull(),
    /** User who reviewed the item (null while pending) */
    reviewed_by: text('reviewed_by'),
    /** Timestamp when the item was reviewed */
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
    /** Reason for rejection or reassignment (null for approvals) */
    reason: text('reason'),
    /** Creation timestamp */
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Last update timestamp */
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_hitl_queue_tenant_status').on(table.tenant_id, table.status),
    index('idx_hitl_queue_document_type').on(table.document_type),
    index('idx_hitl_queue_created_at').on(table.created_at),
  ],
);

export type HitlQueueRow = typeof hitl_queue.$inferSelect;
export type NewHitlQueueRow = typeof hitl_queue.$inferInsert;
