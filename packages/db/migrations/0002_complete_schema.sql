-- ============================================================
-- Migration: 0002_complete_schema
-- Description: All remaining tables for Epics 2-14
-- Created:   2026-03-15
-- ============================================================

-- --------------------------------------------------------
-- chart_of_accounts (Epic 2 — Story 2.5)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "code"         TEXT        NOT NULL,
  "name_th"      TEXT        NOT NULL,
  "name_en"      TEXT        NOT NULL,
  "account_type" TEXT        NOT NULL CHECK ("account_type" IN ('asset','liability','equity','revenue','expense')),
  "is_active"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "parent_id"    TEXT,
  "tenant_id"    TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_coa_tenant_code"
  ON "chart_of_accounts" ("tenant_id", "code");

-- --------------------------------------------------------
-- fiscal_years (Epic 2 — Story 2.7)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_years" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "year"       INTEGER     NOT NULL,
  "start_date" DATE        NOT NULL,
  "end_date"   DATE        NOT NULL,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_fiscal_years_tenant_year"
  ON "fiscal_years" ("tenant_id", "year");

-- --------------------------------------------------------
-- fiscal_periods (Epic 2 — Story 2.7)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fiscal_periods" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "fiscal_year_id" TEXT        NOT NULL REFERENCES "fiscal_years"("id") ON DELETE CASCADE,
  "period_number"  INTEGER     NOT NULL,
  "start_date"     DATE        NOT NULL,
  "end_date"       DATE        NOT NULL,
  "status"         TEXT        NOT NULL DEFAULT 'open' CHECK ("status" IN ('open','closed')),
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_fiscal_periods_year_number"
  ON "fiscal_periods" ("fiscal_year_id", "period_number");

-- --------------------------------------------------------
-- budgets (Epic 2 — Story 2.5)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "budgets" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "account_id"     TEXT        NOT NULL REFERENCES "chart_of_accounts"("id") ON DELETE CASCADE,
  "fiscal_year"    INTEGER     NOT NULL,
  "amount_satang"  BIGINT      NOT NULL,
  "tenant_id"      TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_budgets_account_year"
  ON "budgets" ("tenant_id", "account_id", "fiscal_year");

-- --------------------------------------------------------
-- journal_entries (Epic 2 — Story 2.4)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "document_number"   TEXT        NOT NULL,
  "description"       TEXT        NOT NULL,
  "status"            TEXT        NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','posted','reversed')),
  "fiscal_year"       INTEGER     NOT NULL,
  "fiscal_period"     INTEGER     NOT NULL,
  "reversed_entry_id" TEXT,
  "tenant_id"         TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"        TEXT        NOT NULL,
  "posted_at"         TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- journal_entry_lines (Epic 2 — Story 2.4)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "entry_id"      TEXT        NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  "line_number"   INTEGER     NOT NULL,
  "account_id"    TEXT        NOT NULL REFERENCES "chart_of_accounts"("id"),
  "description"   TEXT,
  "debit_satang"  BIGINT      NOT NULL DEFAULT 0,
  "credit_satang" BIGINT      NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- document_sequences (Epic 2 — Story 2.6)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "document_sequences" (
  "id"          TEXT        NOT NULL PRIMARY KEY,
  "doc_type"    TEXT        NOT NULL CHECK ("doc_type" IN ('journal_entry','invoice','payment','bill','receipt')),
  "fiscal_year" INTEGER     NOT NULL,
  "prefix"      TEXT        NOT NULL,
  "last_number" INTEGER     NOT NULL DEFAULT 0,
  "tenant_id"   TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_doc_seq_tenant_type_year"
  ON "document_sequences" ("tenant_id", "doc_type", "fiscal_year");

-- --------------------------------------------------------
-- audit_logs (Epic 2 — Story 2.8)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "user_id"       TEXT        NOT NULL,
  "tenant_id"     TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "action"        TEXT        NOT NULL,
  "resource_type" TEXT        NOT NULL,
  "resource_id"   TEXT        NOT NULL,
  "changes"       JSONB,
  "request_id"    TEXT        NOT NULL,
  "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- hitl_queue (Epic 5 — Story 5.4)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "hitl_queue" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "tenant_id"        TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "document_ref"     TEXT        NOT NULL,
  "document_type"    TEXT        NOT NULL,
  "amount"           TEXT        NOT NULL,
  "confidence"       TEXT        NOT NULL,
  "ai_reasoning"     JSONB       NOT NULL,
  "suggested_action" JSONB       NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'pending',
  "created_by"       TEXT        NOT NULL,
  "reviewed_by"      TEXT,
  "reviewed_at"      TIMESTAMPTZ,
  "reason"           TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_hitl_queue_tenant_status"
  ON "hitl_queue" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_hitl_queue_document_type"
  ON "hitl_queue" ("document_type");
CREATE INDEX IF NOT EXISTS "idx_hitl_queue_created_at"
  ON "hitl_queue" ("created_at");

-- --------------------------------------------------------
-- vendors (Epic 10 — Story 10.1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "vendors" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "name"       TEXT        NOT NULL,
  "tax_id"     TEXT,
  "address"    TEXT,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- bills (Epic 10 — Story 10.1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "bills" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "document_number" TEXT        NOT NULL,
  "vendor_id"       TEXT        NOT NULL REFERENCES "vendors"("id"),
  "total_satang"    BIGINT      NOT NULL DEFAULT 0,
  "paid_satang"     BIGINT      NOT NULL DEFAULT 0,
  "due_date"        TEXT        NOT NULL,
  "notes"           TEXT,
  "status"          TEXT        NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','posted','voided','paid','partial')),
  "tenant_id"       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"      TEXT        NOT NULL,
  "posted_at"       TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- bill_line_items (Epic 10 — Story 10.1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "bill_line_items" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "bill_id"       TEXT        NOT NULL REFERENCES "bills"("id") ON DELETE CASCADE,
  "line_number"   INTEGER     NOT NULL,
  "description"   TEXT        NOT NULL,
  "amount_satang" BIGINT      NOT NULL DEFAULT 0,
  "account_id"    TEXT        NOT NULL REFERENCES "chart_of_accounts"("id"),
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- bill_payments (Epic 10 — Story 10.2)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "bill_payments" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "document_number"  TEXT        NOT NULL,
  "bill_id"          TEXT        NOT NULL REFERENCES "bills"("id"),
  "amount_satang"    BIGINT      NOT NULL,
  "payment_date"     TEXT        NOT NULL,
  "payment_method"   TEXT        NOT NULL CHECK ("payment_method" IN ('cash','bank_transfer','cheque','promptpay')),
  "reference"        TEXT,
  "notes"            TEXT,
  "journal_entry_id" TEXT,
  "tenant_id"        TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"       TEXT        NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- webhooks (Epic 13 — Story 13.1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "tenant_id"        TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "url"              TEXT        NOT NULL,
  "events"           JSONB       NOT NULL,
  "secret"           TEXT        NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','failing')),
  "last_delivery_at" TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- notification_preferences (Epic 14 — Story 14.1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"                    TEXT        NOT NULL PRIMARY KEY,
  "tenant_id"             TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"               TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_enabled"         BOOLEAN     NOT NULL DEFAULT TRUE,
  "line_enabled"          BOOLEAN     NOT NULL DEFAULT FALSE,
  "line_notify_token"     TEXT,
  "event_hitl_created"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "event_approval_result" BOOLEAN     NOT NULL DEFAULT TRUE,
  "event_system_alert"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_tenant_unique"
  ON "notification_preferences" ("user_id", "tenant_id");

-- --------------------------------------------------------
-- notification_log (Epic 14 — Story 14.1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notification_log" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "tenant_id"         TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"           TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "channel"           TEXT        NOT NULL,
  "event_type"        TEXT        NOT NULL,
  "template_id"       TEXT        NOT NULL,
  "template_data"     JSONB       NOT NULL DEFAULT '{}',
  "status"            TEXT        NOT NULL DEFAULT 'pending',
  "error_message"     TEXT,
  "recipient_address" TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "delivered_at"      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_notification_log_user_tenant"
  ON "notification_log" ("user_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notification_log_status"
  ON "notification_log" ("status");
CREATE INDEX IF NOT EXISTS "idx_notification_log_created_at"
  ON "notification_log" ("created_at");

-- --------------------------------------------------------
-- tax_rates (Epic 11 — Story 11.2)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tax_rates" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "tax_type"         TEXT        NOT NULL CHECK ("tax_type" IN ('vat','wht')),
  "rate_basis_points" INTEGER    NOT NULL,
  "income_type"      TEXT,
  "effective_from"   TIMESTAMPTZ NOT NULL,
  "tenant_id"        TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tax_rates_lookup"
  ON "tax_rates" ("tenant_id", "tax_type", "income_type", "effective_from");

-- --------------------------------------------------------
-- firm_client_assignments (Epic 12 — Story 12.2)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "firm_client_assignments" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "firm_tenant_id"   TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "client_tenant_id" TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "assigned_by"      TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "label"            TEXT,
  "status"           TEXT        NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_firm_client_unique"
  ON "firm_client_assignments" ("firm_tenant_id", "client_tenant_id");

-- ============================================================
-- Row-Level Security (RLS) — tenant isolation for new tables
-- ============================================================

ALTER TABLE "chart_of_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coa_tenant_isolation" ON "chart_of_accounts";
CREATE POLICY "coa_tenant_isolation" ON "chart_of_accounts"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "fiscal_years" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_years_tenant_isolation" ON "fiscal_years";
CREATE POLICY "fiscal_years_tenant_isolation" ON "fiscal_years"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_periods_tenant_isolation" ON "fiscal_periods";
CREATE POLICY "fiscal_periods_tenant_isolation" ON "fiscal_periods"
  USING ("fiscal_year_id" IN (
    SELECT "id" FROM "fiscal_years"
    WHERE "tenant_id" = current_setting('app.current_tenant', TRUE)
  ));

ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budgets_tenant_isolation" ON "budgets";
CREATE POLICY "budgets_tenant_isolation" ON "budgets"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal_entries_tenant_isolation" ON "journal_entries";
CREATE POLICY "journal_entries_tenant_isolation" ON "journal_entries"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "journal_entry_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journal_entry_lines_tenant_isolation" ON "journal_entry_lines";
CREATE POLICY "journal_entry_lines_tenant_isolation" ON "journal_entry_lines"
  USING ("entry_id" IN (
    SELECT "id" FROM "journal_entries"
    WHERE "tenant_id" = current_setting('app.current_tenant', TRUE)
  ));

ALTER TABLE "document_sequences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_sequences_tenant_isolation" ON "document_sequences";
CREATE POLICY "document_sequences_tenant_isolation" ON "document_sequences"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "hitl_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hitl_queue_tenant_isolation" ON "hitl_queue";
CREATE POLICY "hitl_queue_tenant_isolation" ON "hitl_queue"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_tenant_isolation" ON "vendors";
CREATE POLICY "vendors_tenant_isolation" ON "vendors"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bills_tenant_isolation" ON "bills";
CREATE POLICY "bills_tenant_isolation" ON "bills"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "bill_line_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bill_line_items_tenant_isolation" ON "bill_line_items";
CREATE POLICY "bill_line_items_tenant_isolation" ON "bill_line_items"
  USING ("bill_id" IN (
    SELECT "id" FROM "bills"
    WHERE "tenant_id" = current_setting('app.current_tenant', TRUE)
  ));

ALTER TABLE "bill_payments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bill_payments_tenant_isolation" ON "bill_payments";
CREATE POLICY "bill_payments_tenant_isolation" ON "bill_payments"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks_tenant_isolation" ON "webhooks";
CREATE POLICY "webhooks_tenant_isolation" ON "webhooks"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_preferences_tenant_isolation" ON "notification_preferences";
CREATE POLICY "notification_preferences_tenant_isolation" ON "notification_preferences"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "notification_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_log_tenant_isolation" ON "notification_log";
CREATE POLICY "notification_log_tenant_isolation" ON "notification_log"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "tax_rates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_rates_tenant_isolation" ON "tax_rates";
CREATE POLICY "tax_rates_tenant_isolation" ON "tax_rates"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

ALTER TABLE "firm_client_assignments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firm_client_assignments_tenant_isolation" ON "firm_client_assignments";
CREATE POLICY "firm_client_assignments_tenant_isolation" ON "firm_client_assignments"
  USING ("firm_tenant_id" = current_setting('app.current_tenant', TRUE));

-- ============================================================
-- updated_at triggers for new tables
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'chart_of_accounts', 'fiscal_years', 'fiscal_periods', 'budgets',
    'journal_entries', 'document_sequences', 'hitl_queue',
    'vendors', 'bills', 'webhooks',
    'notification_preferences', 'tax_rates', 'firm_client_assignments'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- Seed: permissions (global — no tenant_id)
-- ============================================================

INSERT INTO permissions (id, name, description) VALUES
('gl:journal:create', 'gl:journal:create', 'Create journal entries'),
('gl:journal:read', 'gl:journal:read', 'View journal entries'),
('gl:journal:update', 'gl:journal:update', 'Update journal entries'),
('gl:journal:delete', 'gl:journal:delete', 'Delete journal entries'),
('gl:journal:post', 'gl:journal:post', 'Post journal entries'),
('gl:journal:reverse', 'gl:journal:reverse', 'Reverse journal entries'),
('gl:account:create', 'gl:account:create', 'Create chart of accounts'),
('gl:account:read', 'gl:account:read', 'View chart of accounts'),
('gl:account:update', 'gl:account:update', 'Update chart of accounts'),
('gl:account:delete', 'gl:account:delete', 'Delete chart of accounts'),
('gl:period:close', 'gl:period:close', 'Close fiscal periods'),
('gl:period:read', 'gl:period:read', 'View fiscal periods'),
('ar:invoice:create', 'ar:invoice:create', 'Create invoices'),
('ar:invoice:read', 'ar:invoice:read', 'View invoices'),
('ar:invoice:update', 'ar:invoice:update', 'Update invoices'),
('ar:invoice:delete', 'ar:invoice:delete', 'Delete invoices'),
('ar:invoice:send', 'ar:invoice:send', 'Send invoices'),
('ar:invoice:void', 'ar:invoice:void', 'Void invoices'),
('ar:payment:create', 'ar:payment:create', 'Create payments'),
('ar:payment:read', 'ar:payment:read', 'View payments'),
('ar:payment:update', 'ar:payment:update', 'Update payments'),
('ar:customer:create', 'ar:customer:create', 'Create customers'),
('ar:customer:read', 'ar:customer:read', 'View customers'),
('ar:customer:update', 'ar:customer:update', 'Update customers'),
('ar:customer:delete', 'ar:customer:delete', 'Delete customers'),
('ap:bill:create', 'ap:bill:create', 'Create bills'),
('ap:bill:read', 'ap:bill:read', 'View bills'),
('ap:bill:update', 'ap:bill:update', 'Update bills'),
('ap:bill:delete', 'ap:bill:delete', 'Delete bills'),
('ap:bill:approve', 'ap:bill:approve', 'Approve bills'),
('ap:payment:create', 'ap:payment:create', 'Create bill payments'),
('ap:payment:read', 'ap:payment:read', 'View bill payments'),
('ap:payment:update', 'ap:payment:update', 'Update bill payments'),
('ap:vendor:create', 'ap:vendor:create', 'Create vendors'),
('ap:vendor:read', 'ap:vendor:read', 'View vendors'),
('ap:vendor:update', 'ap:vendor:update', 'Update vendors'),
('ap:vendor:delete', 'ap:vendor:delete', 'Delete vendors'),
('hitl:queue:read', 'hitl:queue:read', 'View HITL queue'),
('hitl:approve', 'hitl:approve', 'Approve HITL actions'),
('hitl:reject', 'hitl:reject', 'Reject HITL actions'),
('report:gl:read', 'report:gl:read', 'View GL reports'),
('report:ar:read', 'report:ar:read', 'View AR reports'),
('report:ap:read', 'report:ap:read', 'View AP reports'),
('report:trial-balance:read', 'report:trial-balance:read', 'View trial balance'),
('report:balance-sheet:read', 'report:balance-sheet:read', 'View balance sheet'),
('report:income-statement:read', 'report:income-statement:read', 'View income statement'),
('user:invite', 'user:invite', 'Invite users'),
('user:read', 'user:read', 'View users'),
('user:update', 'user:update', 'Update users'),
('user:deactivate', 'user:deactivate', 'Deactivate users'),
('role:assign', 'role:assign', 'Assign roles'),
('role:read', 'role:read', 'View roles'),
('role:create', 'role:create', 'Create roles'),
('role:update', 'role:update', 'Update roles'),
('role:delete', 'role:delete', 'Delete roles'),
('webhook:create', 'webhook:create', 'Create webhooks'),
('webhook:read', 'webhook:read', 'View webhooks'),
('webhook:delete', 'webhook:delete', 'Delete webhooks'),
('data:import', 'data:import', 'Import data'),
('data:export', 'data:export', 'Export data')
ON CONFLICT (name) DO NOTHING;

-- Default tenant for self-registration
INSERT INTO tenants (id, name, slug) VALUES ('default', 'Default', 'default')
ON CONFLICT (id) DO NOTHING;
