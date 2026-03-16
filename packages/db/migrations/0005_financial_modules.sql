-- ============================================================
-- Migration: 0005_financial_modules
-- Description: Fixed Assets, Bank Reconciliation, WHT Certificates,
--              Cost Centers / Profit Centers (CO) modules.
--              Also extends journal_entry_lines with cost/profit center FKs.
-- Created:   2026-03-15
-- ============================================================

-- --------------------------------------------------------
-- MODULE 1: Fixed Assets (สินทรัพย์ถาวร / FI-AA)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fixed_assets" (
  "id"                              TEXT        NOT NULL PRIMARY KEY,
  "asset_code"                      TEXT        NOT NULL,
  "name_th"                         TEXT        NOT NULL,
  "name_en"                         TEXT        NOT NULL,
  "category"                        TEXT        NOT NULL
    CHECK ("category" IN ('land','building','equipment','vehicle','furniture','it_equipment','other')),
  "purchase_date"                   DATE        NOT NULL,
  "purchase_cost_satang"            BIGINT      NOT NULL,
  "salvage_value_satang"            BIGINT      NOT NULL DEFAULT 0,
  "useful_life_months"              INTEGER     NOT NULL,
  "depreciation_method"             TEXT        NOT NULL DEFAULT 'straight_line'
    CHECK ("depreciation_method" IN ('straight_line','declining_balance')),
  "accumulated_depreciation_satang" BIGINT      NOT NULL DEFAULT 0,
  "net_book_value_satang"           BIGINT      NOT NULL,
  "status"                          TEXT        NOT NULL DEFAULT 'active'
    CHECK ("status" IN ('active','disposed','written_off')),
  "disposal_date"                   DATE,
  "disposal_amount_satang"          BIGINT,
  "gl_account_id"                   TEXT        REFERENCES "chart_of_accounts"("id"),
  "depreciation_account_id"         TEXT        REFERENCES "chart_of_accounts"("id"),
  "tenant_id"                       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"                      TEXT        NOT NULL,
  "created_at"                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_fixed_assets_tenant_id"
  ON "fixed_assets" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_fixed_assets_tenant_status"
  ON "fixed_assets" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_fixed_assets_tenant_category"
  ON "fixed_assets" ("tenant_id", "category");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_fixed_assets_tenant_code"
  ON "fixed_assets" ("tenant_id", "asset_code");

-- --------------------------------------------------------
-- MODULE 2: Bank Reconciliation (กระทบยอดธนาคาร / FI-BL)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "account_name"   TEXT        NOT NULL,
  "account_number" TEXT        NOT NULL,
  "bank_name"      TEXT        NOT NULL,
  "gl_account_id"  TEXT        REFERENCES "chart_of_accounts"("id"),
  "currency"       TEXT        NOT NULL DEFAULT 'THB',
  "balance_satang" BIGINT      NOT NULL DEFAULT 0,
  "tenant_id"      TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_bank_accounts_tenant_id"
  ON "bank_accounts" ("tenant_id");

CREATE TABLE IF NOT EXISTS "bank_transactions" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "bank_account_id"   TEXT        NOT NULL REFERENCES "bank_accounts"("id") ON DELETE CASCADE,
  "transaction_date"  DATE        NOT NULL,
  "description"       TEXT        NOT NULL,
  "debit_satang"      BIGINT      NOT NULL DEFAULT 0,
  "credit_satang"     BIGINT      NOT NULL DEFAULT 0,
  "reference"         TEXT,
  "reconciled"        BOOLEAN     NOT NULL DEFAULT FALSE,
  "reconciled_je_id"  TEXT        REFERENCES "journal_entries"("id"),
  "tenant_id"         TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_bank_transactions_account_id"
  ON "bank_transactions" ("bank_account_id");

CREATE INDEX IF NOT EXISTS "idx_bank_transactions_tenant_id"
  ON "bank_transactions" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_bank_transactions_reconciled"
  ON "bank_transactions" ("bank_account_id", "reconciled");

-- --------------------------------------------------------
-- MODULE 3: Withholding Tax Certificates (ภ.ง.ด.3/53)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "wht_certificates" (
  "id"                     TEXT        NOT NULL PRIMARY KEY,
  "document_number"        TEXT        NOT NULL,
  "certificate_type"       TEXT        NOT NULL CHECK ("certificate_type" IN ('pnd3','pnd53')),
  "payer_name"             TEXT        NOT NULL,
  "payer_tax_id"           TEXT        NOT NULL,
  "payee_name"             TEXT        NOT NULL,
  "payee_tax_id"           TEXT        NOT NULL,
  "payee_address"          TEXT        NOT NULL,
  "income_type"            TEXT        NOT NULL,
  "income_description"     TEXT        NOT NULL,
  "payment_date"           TEXT        NOT NULL,
  "income_amount_satang"   BIGINT      NOT NULL,
  "wht_rate_basis_points"  INTEGER     NOT NULL,
  "wht_amount_satang"      BIGINT      NOT NULL,
  "tax_month"              INTEGER     NOT NULL CHECK ("tax_month" BETWEEN 1 AND 12),
  "tax_year"               INTEGER     NOT NULL,
  "bill_payment_id"        TEXT,
  "status"                 TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','issued','filed','voided')),
  "tenant_id"              TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"             TEXT        NOT NULL,
  "issued_at"              TIMESTAMPTZ,
  "filed_at"               TIMESTAMPTZ,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_wht_certificates_tenant_id"
  ON "wht_certificates" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_wht_certificates_tenant_month_year"
  ON "wht_certificates" ("tenant_id", "tax_year", "tax_month");

CREATE INDEX IF NOT EXISTS "idx_wht_certificates_tenant_type_status"
  ON "wht_certificates" ("tenant_id", "certificate_type", "status");

-- --------------------------------------------------------
-- MODULE 4: Cost Centers / Profit Centers (CO)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "cost_centers" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "code"       TEXT        NOT NULL,
  "name_th"    TEXT        NOT NULL,
  "name_en"    TEXT        NOT NULL,
  "parent_id"  TEXT,
  "is_active"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_cost_centers_tenant_code"
  ON "cost_centers" ("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "profit_centers" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "code"       TEXT        NOT NULL,
  "name_th"    TEXT        NOT NULL,
  "name_en"    TEXT        NOT NULL,
  "parent_id"  TEXT,
  "is_active"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_profit_centers_tenant_code"
  ON "profit_centers" ("tenant_id", "code");

-- --------------------------------------------------------
-- Extend journal_entry_lines with CO dimension columns
-- --------------------------------------------------------

ALTER TABLE "journal_entry_lines"
  ADD COLUMN IF NOT EXISTS "cost_center_id"   TEXT REFERENCES "cost_centers"("id"),
  ADD COLUMN IF NOT EXISTS "profit_center_id"  TEXT REFERENCES "profit_centers"("id");

CREATE INDEX IF NOT EXISTS "idx_jel_cost_center"
  ON "journal_entry_lines" ("cost_center_id")
  WHERE "cost_center_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_jel_profit_center"
  ON "journal_entry_lines" ("profit_center_id")
  WHERE "profit_center_id" IS NOT NULL;

-- --------------------------------------------------------
-- Seed permissions for all four modules
-- --------------------------------------------------------

INSERT INTO permissions (id, name, description) VALUES
  -- Fixed Assets
  ('fi:asset:create',      'fi:asset:create',      'Register a new fixed asset'),
  ('fi:asset:read',        'fi:asset:read',        'View fixed assets and reports'),
  ('fi:asset:update',      'fi:asset:update',      'Update fixed asset details'),
  ('fi:asset:depreciate',  'fi:asset:depreciate',  'Run monthly depreciation on an asset'),
  ('fi:asset:dispose',     'fi:asset:dispose',     'Dispose or write-off a fixed asset'),
  -- Bank Reconciliation
  ('fi:bank:create',       'fi:bank:create',       'Create bank accounts'),
  ('fi:bank:read',         'fi:bank:read',         'View bank accounts and transactions'),
  ('fi:bank:import',       'fi:bank:import',       'Import bank statements'),
  ('fi:bank:reconcile',    'fi:bank:reconcile',    'Reconcile bank transactions to JEs'),
  -- WHT Certificates
  ('fi:wht:create',        'fi:wht:create',        'Create WHT certificates'),
  ('fi:wht:read',          'fi:wht:read',          'View WHT certificates'),
  ('fi:wht:issue',         'fi:wht:issue',         'Issue a WHT certificate'),
  ('fi:wht:void',          'fi:wht:void',          'Void a WHT certificate'),
  ('fi:wht:file',          'fi:wht:file',          'Mark WHT certificates as filed'),
  -- Cost Centers
  ('co:cost-center:create', 'co:cost-center:create', 'Create cost centers'),
  ('co:cost-center:read',   'co:cost-center:read',   'View cost centers and cost reports'),
  ('co:cost-center:update', 'co:cost-center:update', 'Update cost centers'),
  -- Profit Centers
  ('co:profit-center:create', 'co:profit-center:create', 'Create profit centers'),
  ('co:profit-center:read',   'co:profit-center:read',   'View profit centers and P&L reports'),
  ('co:profit-center:update', 'co:profit-center:update', 'Update profit centers')
ON CONFLICT (id) DO NOTHING;

-- Grant all new permissions to the Owner role (tenant-scoped role_permissions
-- are seeded at tenant creation time; here we just ensure the permission IDs exist).
