-- ============================================================
-- Migration: 0003_quotations
-- Description: Quotation (ใบเสนอราคา) module tables
-- Created:   2026-03-15
-- ============================================================

-- --------------------------------------------------------
-- quotations — AR quotation headers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "quotations" (
  "id"                    TEXT        NOT NULL PRIMARY KEY,
  "document_number"       TEXT        NOT NULL,
  "customer_id"           TEXT        NOT NULL,
  "customer_name"         TEXT        NOT NULL,
  "subject"               TEXT        NOT NULL,
  "notes"                 TEXT,
  "status"                TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','sent','approved','rejected','converted','expired')),
  "valid_until"           TEXT        NOT NULL,
  "total_satang"          BIGINT      NOT NULL DEFAULT 0,
  "converted_invoice_id"  TEXT,
  "tenant_id"             TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"            TEXT        NOT NULL,
  "sent_at"               TIMESTAMPTZ,
  "approved_at"           TIMESTAMPTZ,
  "rejected_at"           TIMESTAMPTZ,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_quotations_tenant_id"
  ON "quotations" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_quotations_status"
  ON "quotations" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_quotations_customer_id"
  ON "quotations" ("tenant_id", "customer_id");

CREATE INDEX IF NOT EXISTS "idx_quotations_valid_until"
  ON "quotations" ("valid_until");

-- --------------------------------------------------------
-- quotation_lines — Individual line items on a quotation
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "quotation_lines" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "quotation_id"      TEXT        NOT NULL REFERENCES "quotations"("id") ON DELETE CASCADE,
  "line_number"       INTEGER     NOT NULL,
  "description"       TEXT        NOT NULL,
  "quantity"          INTEGER     NOT NULL DEFAULT 1,
  "unit_price_satang" BIGINT      NOT NULL,
  "amount_satang"     BIGINT      NOT NULL,
  "account_id"        TEXT        REFERENCES "chart_of_accounts"("id"),
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_quotation_lines_quotation_id"
  ON "quotation_lines" ("quotation_id");

-- --------------------------------------------------------
-- updated_at trigger for quotations
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION update_quotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotations_updated_at ON "quotations";
CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON "quotations"
  FOR EACH ROW EXECUTE FUNCTION update_quotations_updated_at();

-- --------------------------------------------------------
-- RLS policies
-- --------------------------------------------------------
ALTER TABLE "quotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotation_lines" ENABLE ROW LEVEL SECURITY;

-- Quotations: tenant isolation via tenant_id column
DROP POLICY IF EXISTS "quotations_tenant_isolation" ON "quotations";
CREATE POLICY "quotations_tenant_isolation"
  ON "quotations"
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- Quotation lines: isolation via parent quotation join
DROP POLICY IF EXISTS "quotation_lines_tenant_isolation" ON "quotation_lines";
CREATE POLICY "quotation_lines_tenant_isolation"
  ON "quotation_lines"
  USING (
    quotation_id IN (
      SELECT id FROM quotations
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

-- --------------------------------------------------------
-- Seed quotation permissions
-- --------------------------------------------------------
INSERT INTO permissions (id, name, description) VALUES
  ('ar:quotation:create',  'ar:quotation:create',  'Create quotations'),
  ('ar:quotation:read',    'ar:quotation:read',    'View quotations'),
  ('ar:quotation:update',  'ar:quotation:update',  'Update quotations'),
  ('ar:quotation:send',    'ar:quotation:send',    'Send quotations to customers'),
  ('ar:quotation:approve', 'ar:quotation:approve', 'Approve quotations'),
  ('ar:quotation:convert', 'ar:quotation:convert', 'Convert quotation to invoice')
ON CONFLICT (id) DO NOTHING;
