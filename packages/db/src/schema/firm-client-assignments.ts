/**
 * firm_client_assignments — Mapping table between firm users and client organizations.
 *
 * Enables accounting firms to manage multiple client organizations.
 * A firm user can be assigned to multiple client organizations, and
 * a client organization can have multiple firm users assigned.
 *
 * Architecture reference: Story 12.2 (Firm Admin Dashboard)
 */

import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const firm_client_assignments = pgTable(
  'firm_client_assignments',
  {
    id: text('id').primaryKey(),
    /** The firm's tenant ID (the accounting firm organization). */
    firm_tenant_id: text('firm_tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** The client organization's tenant ID. */
    client_tenant_id: text('client_tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** The firm user who is assigned to this client. */
    assigned_by: text('assigned_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Optional display label for the client within the firm's context. */
    label: text('label'),
    /** Assignment status. */
    status: text('status', {
      enum: ['active', 'inactive'],
    }).notNull().default('active'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_firm_client_unique').on(
      table.firm_tenant_id,
      table.client_tenant_id,
    ),
  ],
);

export type FirmClientAssignment = typeof firm_client_assignments.$inferSelect;
export type NewFirmClientAssignment = typeof firm_client_assignments.$inferInsert;
