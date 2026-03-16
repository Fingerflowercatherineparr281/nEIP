-- ============================================================
-- Migration: 0004_sales_purchase_documents
-- Description: Sales cycle (SO, DO, Receipt, CN) and Purchase
--              cycle (PO) module tables for the Thai SME ERP.
-- Created:   2026-03-15
-- ============================================================

-- --------------------------------------------------------
-- sales_orders — AR sales order headers (ใบสั่งขาย / SO)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales_orders" (
  "id"                       TEXT        NOT NULL PRIMARY KEY,
  "document_number"          TEXT        NOT NULL,
  "customer_id"              TEXT        NOT NULL,
  "customer_name"            TEXT        NOT NULL,
  "status"                   TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','confirmed','partial_delivered','delivered','cancelled')),
  "order_date"               TEXT        NOT NULL,
  "expected_delivery_date"   TEXT,
  "total_satang"             BIGINT      NOT NULL DEFAULT 0,
  "quotation_id"             TEXT,
  "notes"                    TEXT,
  "tenant_id"                TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"               TEXT        NOT NULL,
  "confirmed_at"             TIMESTAMPTZ,
  "cancelled_at"             TIMESTAMPTZ,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_sales_orders_tenant_id"
  ON "sales_orders" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_sales_orders_status"
  ON "sales_orders" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_sales_orders_customer_id"
  ON "sales_orders" ("tenant_id", "customer_id");

-- --------------------------------------------------------
-- sales_order_lines — Line items for a sales order
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales_order_lines" (
  "id"                 TEXT    NOT NULL PRIMARY KEY,
  "sales_order_id"     TEXT    NOT NULL REFERENCES "sales_orders"("id") ON DELETE CASCADE,
  "line_number"        INTEGER NOT NULL,
  "description"        TEXT    NOT NULL,
  "quantity"           REAL    NOT NULL,
  "delivered_quantity" REAL    NOT NULL DEFAULT 0,
  "unit_price_satang"  BIGINT  NOT NULL,
  "amount_satang"      BIGINT  NOT NULL,
  "account_id"         TEXT    REFERENCES "chart_of_accounts"("id")
);

CREATE INDEX IF NOT EXISTS "idx_sales_order_lines_sales_order_id"
  ON "sales_order_lines" ("sales_order_id");

-- --------------------------------------------------------
-- delivery_notes — Delivery note headers (ใบส่งของ / DO)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "delivery_notes" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "document_number" TEXT        NOT NULL,
  "sales_order_id"  TEXT        NOT NULL REFERENCES "sales_orders"("id") ON DELETE RESTRICT,
  "customer_id"     TEXT        NOT NULL,
  "customer_name"   TEXT        NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','delivered','cancelled')),
  "delivery_date"   TEXT        NOT NULL,
  "notes"           TEXT,
  "tenant_id"       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"      TEXT        NOT NULL,
  "delivered_at"    TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_delivery_notes_tenant_id"
  ON "delivery_notes" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_delivery_notes_status"
  ON "delivery_notes" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_delivery_notes_sales_order_id"
  ON "delivery_notes" ("sales_order_id");

-- --------------------------------------------------------
-- delivery_note_lines — Line items for a delivery note
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "delivery_note_lines" (
  "id"                   TEXT        NOT NULL PRIMARY KEY,
  "delivery_note_id"     TEXT        NOT NULL REFERENCES "delivery_notes"("id") ON DELETE CASCADE,
  "sales_order_line_id"  TEXT        NOT NULL,
  "description"          TEXT        NOT NULL,
  "quantity_delivered"   REAL        NOT NULL,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_delivery_note_lines_delivery_note_id"
  ON "delivery_note_lines" ("delivery_note_id");

CREATE INDEX IF NOT EXISTS "idx_delivery_note_lines_so_line_id"
  ON "delivery_note_lines" ("sales_order_line_id");

-- --------------------------------------------------------
-- receipts — Official receipt (ใบเสร็จรับเงิน)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "receipts" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "document_number" TEXT        NOT NULL,
  "payment_id"      TEXT,
  "invoice_id"      TEXT,
  "customer_id"     TEXT        NOT NULL,
  "customer_name"   TEXT        NOT NULL,
  "amount_satang"   BIGINT      NOT NULL,
  "receipt_date"    TEXT        NOT NULL,
  "payment_method"  TEXT        NOT NULL DEFAULT 'cash',
  "reference"       TEXT,
  "notes"           TEXT,
  "status"          TEXT        NOT NULL DEFAULT 'issued'
    CHECK ("status" IN ('issued','voided')),
  "tenant_id"       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"      TEXT        NOT NULL,
  "voided_at"       TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_receipts_tenant_id"
  ON "receipts" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_receipts_status"
  ON "receipts" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_receipts_customer_id"
  ON "receipts" ("tenant_id", "customer_id");

-- --------------------------------------------------------
-- credit_notes — Credit note headers (ใบลดหนี้ / CN)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "document_number" TEXT        NOT NULL,
  "invoice_id"      TEXT        NOT NULL,
  "customer_id"     TEXT        NOT NULL,
  "customer_name"   TEXT        NOT NULL,
  "reason"          TEXT        NOT NULL,
  "total_satang"    BIGINT      NOT NULL DEFAULT 0,
  "status"          TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','issued','voided')),
  "notes"           TEXT,
  "tenant_id"       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"      TEXT        NOT NULL,
  "issued_at"       TIMESTAMPTZ,
  "voided_at"       TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_credit_notes_tenant_id"
  ON "credit_notes" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_credit_notes_status"
  ON "credit_notes" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_credit_notes_invoice_id"
  ON "credit_notes" ("invoice_id");

CREATE INDEX IF NOT EXISTS "idx_credit_notes_customer_id"
  ON "credit_notes" ("tenant_id", "customer_id");

-- --------------------------------------------------------
-- credit_note_lines — Line items for a credit note
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "credit_note_lines" (
  "id"                 TEXT   NOT NULL PRIMARY KEY,
  "credit_note_id"     TEXT   NOT NULL REFERENCES "credit_notes"("id") ON DELETE CASCADE,
  "description"        TEXT   NOT NULL,
  "quantity"           REAL   NOT NULL,
  "unit_price_satang"  BIGINT NOT NULL,
  "amount_satang"      BIGINT NOT NULL,
  "account_id"         TEXT   REFERENCES "chart_of_accounts"("id")
);

CREATE INDEX IF NOT EXISTS "idx_credit_note_lines_credit_note_id"
  ON "credit_note_lines" ("credit_note_id");

-- --------------------------------------------------------
-- purchase_orders — AP purchase order headers (ใบสั่งซื้อ / PO)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id"                 TEXT        NOT NULL PRIMARY KEY,
  "document_number"    TEXT        NOT NULL,
  "vendor_id"          TEXT        NOT NULL REFERENCES "vendors"("id") ON DELETE RESTRICT,
  "status"             TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','sent','partial_received','received','cancelled')),
  "order_date"         TEXT        NOT NULL,
  "expected_date"      TEXT,
  "total_satang"       BIGINT      NOT NULL DEFAULT 0,
  "notes"              TEXT,
  "tenant_id"          TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"         TEXT        NOT NULL,
  "sent_at"            TIMESTAMPTZ,
  "cancelled_at"       TIMESTAMPTZ,
  "converted_bill_id"  TEXT,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_purchase_orders_tenant_id"
  ON "purchase_orders" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_purchase_orders_status"
  ON "purchase_orders" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_purchase_orders_vendor_id"
  ON "purchase_orders" ("tenant_id", "vendor_id");

-- --------------------------------------------------------
-- purchase_order_lines — Line items for a purchase order
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
  "id"                  TEXT    NOT NULL PRIMARY KEY,
  "purchase_order_id"   TEXT    NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "line_number"         INTEGER NOT NULL,
  "description"         TEXT    NOT NULL,
  "quantity"            REAL    NOT NULL,
  "received_quantity"   REAL    NOT NULL DEFAULT 0,
  "unit_price_satang"   BIGINT  NOT NULL,
  "amount_satang"       BIGINT  NOT NULL,
  "account_id"          TEXT    REFERENCES "chart_of_accounts"("id")
);

CREATE INDEX IF NOT EXISTS "idx_purchase_order_lines_purchase_order_id"
  ON "purchase_order_lines" ("purchase_order_id");

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_orders_updated_at ON "sales_orders";
CREATE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON "sales_orders"
  FOR EACH ROW EXECUTE FUNCTION update_sales_orders_updated_at();

-- ---

CREATE OR REPLACE FUNCTION update_delivery_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_notes_updated_at ON "delivery_notes";
CREATE TRIGGER trg_delivery_notes_updated_at
  BEFORE UPDATE ON "delivery_notes"
  FOR EACH ROW EXECUTE FUNCTION update_delivery_notes_updated_at();

-- ---

CREATE OR REPLACE FUNCTION update_delivery_note_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_note_lines_updated_at ON "delivery_note_lines";
CREATE TRIGGER trg_delivery_note_lines_updated_at
  BEFORE UPDATE ON "delivery_note_lines"
  FOR EACH ROW EXECUTE FUNCTION update_delivery_note_lines_updated_at();

-- ---

CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipts_updated_at ON "receipts";
CREATE TRIGGER trg_receipts_updated_at
  BEFORE UPDATE ON "receipts"
  FOR EACH ROW EXECUTE FUNCTION update_receipts_updated_at();

-- ---

CREATE OR REPLACE FUNCTION update_credit_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_notes_updated_at ON "credit_notes";
CREATE TRIGGER trg_credit_notes_updated_at
  BEFORE UPDATE ON "credit_notes"
  FOR EACH ROW EXECUTE FUNCTION update_credit_notes_updated_at();

-- ---

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON "purchase_orders";
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON "purchase_orders"
  FOR EACH ROW EXECUTE FUNCTION update_purchase_orders_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE "sales_orders"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_order_lines"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_notes"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_note_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipts"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_notes"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_note_lines"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_orders"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_lines" ENABLE ROW LEVEL SECURITY;

-- sales_orders
DROP POLICY IF EXISTS "sales_orders_tenant_isolation" ON "sales_orders";
CREATE POLICY "sales_orders_tenant_isolation"
  ON "sales_orders"
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- sales_order_lines (isolated via parent SO)
DROP POLICY IF EXISTS "sales_order_lines_tenant_isolation" ON "sales_order_lines";
CREATE POLICY "sales_order_lines_tenant_isolation"
  ON "sales_order_lines"
  USING (
    sales_order_id IN (
      SELECT id FROM sales_orders
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

-- delivery_notes
DROP POLICY IF EXISTS "delivery_notes_tenant_isolation" ON "delivery_notes";
CREATE POLICY "delivery_notes_tenant_isolation"
  ON "delivery_notes"
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- delivery_note_lines (isolated via parent DO)
DROP POLICY IF EXISTS "delivery_note_lines_tenant_isolation" ON "delivery_note_lines";
CREATE POLICY "delivery_note_lines_tenant_isolation"
  ON "delivery_note_lines"
  USING (
    delivery_note_id IN (
      SELECT id FROM delivery_notes
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

-- receipts
DROP POLICY IF EXISTS "receipts_tenant_isolation" ON "receipts";
CREATE POLICY "receipts_tenant_isolation"
  ON "receipts"
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- credit_notes
DROP POLICY IF EXISTS "credit_notes_tenant_isolation" ON "credit_notes";
CREATE POLICY "credit_notes_tenant_isolation"
  ON "credit_notes"
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- credit_note_lines (isolated via parent CN)
DROP POLICY IF EXISTS "credit_note_lines_tenant_isolation" ON "credit_note_lines";
CREATE POLICY "credit_note_lines_tenant_isolation"
  ON "credit_note_lines"
  USING (
    credit_note_id IN (
      SELECT id FROM credit_notes
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

-- purchase_orders
DROP POLICY IF EXISTS "purchase_orders_tenant_isolation" ON "purchase_orders";
CREATE POLICY "purchase_orders_tenant_isolation"
  ON "purchase_orders"
  USING (tenant_id = current_setting('app.tenant_id', TRUE));

-- purchase_order_lines (isolated via parent PO)
DROP POLICY IF EXISTS "purchase_order_lines_tenant_isolation" ON "purchase_order_lines";
CREATE POLICY "purchase_order_lines_tenant_isolation"
  ON "purchase_order_lines"
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

-- ============================================================
-- Seed permissions
-- ============================================================
INSERT INTO permissions (id, name, description) VALUES
  -- AR: Sales Orders
  ('ar:so:create',  'ar:so:create',  'Create sales orders'),
  ('ar:so:read',    'ar:so:read',    'View sales orders'),
  ('ar:so:update',  'ar:so:update',  'Update draft sales orders'),
  ('ar:so:confirm', 'ar:so:confirm', 'Confirm sales orders'),
  ('ar:so:cancel',  'ar:so:cancel',  'Cancel sales orders'),
  -- AR: Delivery Notes
  ('ar:do:create',  'ar:do:create',  'Create delivery notes'),
  ('ar:do:read',    'ar:do:read',    'View delivery notes'),
  ('ar:do:deliver', 'ar:do:deliver', 'Mark delivery note as delivered'),
  -- AR: Receipts
  ('ar:receipt:create', 'ar:receipt:create', 'Issue receipts'),
  ('ar:receipt:read',   'ar:receipt:read',   'View receipts'),
  ('ar:receipt:void',   'ar:receipt:void',   'Void receipts'),
  -- AR: Credit Notes
  ('ar:cn:create', 'ar:cn:create', 'Create credit notes'),
  ('ar:cn:read',   'ar:cn:read',   'View credit notes'),
  ('ar:cn:issue',  'ar:cn:issue',  'Issue credit notes'),
  ('ar:cn:void',   'ar:cn:void',   'Void credit notes'),
  -- AP: Purchase Orders
  ('ap:po:create',  'ap:po:create',  'Create purchase orders'),
  ('ap:po:read',    'ap:po:read',    'View purchase orders'),
  ('ap:po:update',  'ap:po:update',  'Update draft purchase orders'),
  ('ap:po:send',    'ap:po:send',    'Send purchase orders to vendors'),
  ('ap:po:receive', 'ap:po:receive', 'Record goods received on purchase orders'),
  ('ap:po:convert', 'ap:po:convert', 'Convert purchase order to bill'),
  ('ap:po:cancel',  'ap:po:cancel',  'Cancel purchase orders')
ON CONFLICT (id) DO NOTHING;
