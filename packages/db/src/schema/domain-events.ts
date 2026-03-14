import { pgTable, text, integer, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * domain_events — immutable append-only event store table.
 *
 * Architecture reference: AR16 (Event Sourcing), Story 2.3.
 *
 * Column notes:
 * - id            : UUIDv7 string (time-sortable, generated in domain layer)
 * - type          : fully-qualified event type, e.g. 'JournalEntryCreated'
 * - aggregate_id  : entity identifier that owns this event stream
 * - aggregate_type: entity type name, e.g. 'JournalEntry'
 * - tenant_id     : FK → tenants(id), enables RLS isolation
 * - payload       : domain-specific data (jsonb — schemaless at DB level)
 * - version       : monotonically increasing per aggregate stream
 * - fiscal_year   : nullable — reserved for future range-partition pruning
 * - timestamp     : wall-clock time the event was recorded
 *
 * Unique constraint on (aggregate_id, version) enforces optimistic concurrency
 * at the database level (duplicate insert ⟹ unique-violation → ConflictError).
 */
export const domain_events = pgTable(
  'domain_events',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    aggregate_id: text('aggregate_id').notNull(),
    aggregate_type: text('aggregate_type').notNull(),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull(),
    version: integer('version').notNull(),
    fiscal_year: integer('fiscal_year'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_domain_events_aggregate_version').on(
      table.aggregate_id,
      table.version,
    ),
  ],
);

export type DomainEventRow = typeof domain_events.$inferSelect;
export type NewDomainEventRow = typeof domain_events.$inferInsert;
