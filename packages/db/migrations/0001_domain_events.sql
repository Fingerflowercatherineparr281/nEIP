-- ============================================================
-- Migration: 0001_domain_events
-- Story:     2.3 — Event Store
-- Created:   2026-03-15
-- ============================================================
--
-- Creates the append-only domain_events table.
-- Architecture: AR16 (Event Sourcing)
--
-- The unique index on (aggregate_id, version) acts as the
-- database-level optimistic concurrency guard: a duplicate
-- insert raises a unique-violation which the EventStore service
-- converts to a ConflictError (HTTP 409).
--
-- fiscal_year is nullable and reserved for future range-based
-- partitioning by (tenant_id, fiscal_year). Partitioning is NOT
-- enabled in MVP-α.
-- ============================================================

CREATE TABLE IF NOT EXISTS "domain_events" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "type"           TEXT        NOT NULL,
  "aggregate_id"   TEXT        NOT NULL,
  "aggregate_type" TEXT        NOT NULL,
  "tenant_id"      TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "payload"        JSONB       NOT NULL,
  "version"        INTEGER     NOT NULL,
  "fiscal_year"    INTEGER,
  "timestamp"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_domain_events_aggregate_version"
  ON "domain_events" ("aggregate_id", "version");

-- RLS — isolate events per tenant (AR22)
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "domain_events_tenant_isolation" ON "domain_events";
CREATE POLICY "domain_events_tenant_isolation" ON "domain_events"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));
