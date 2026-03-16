-- ============================================================
-- Migration: 0006_inventory_hr_crm
-- Description: Inventory (MM-IM), CRM Contacts, HR Employee,
--              Payroll, and Leave Management tables.
-- Created:   2026-03-15
-- ============================================================

-- --------------------------------------------------------
-- products
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "products" (
  "id"                    TEXT        NOT NULL PRIMARY KEY,
  "sku"                   TEXT        NOT NULL,
  "name_th"               TEXT        NOT NULL,
  "name_en"               TEXT        NOT NULL,
  "description"           TEXT,
  "category"              TEXT,
  "unit"                  TEXT        NOT NULL DEFAULT 'ชิ้น',
  "cost_price_satang"     INTEGER     NOT NULL DEFAULT 0,
  "selling_price_satang"  INTEGER     NOT NULL DEFAULT 0,
  "min_stock_level"       INTEGER     NOT NULL DEFAULT 0,
  "is_active"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "gl_account_id"         TEXT        REFERENCES "chart_of_accounts"("id"),
  "tenant_id"             TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_tenant_sku"
  ON "products" ("tenant_id", "sku");

CREATE INDEX IF NOT EXISTS "idx_products_tenant_active"
  ON "products" ("tenant_id", "is_active");

-- --------------------------------------------------------
-- warehouses
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "warehouses" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "code"       TEXT        NOT NULL,
  "name"       TEXT        NOT NULL,
  "address"    TEXT,
  "is_default" BOOLEAN     NOT NULL DEFAULT FALSE,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_warehouses_tenant_code"
  ON "warehouses" ("tenant_id", "code");

-- --------------------------------------------------------
-- stock_movements
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "product_id"      TEXT        NOT NULL REFERENCES "products"("id"),
  "warehouse_id"    TEXT        NOT NULL REFERENCES "warehouses"("id"),
  "movement_type"   TEXT        NOT NULL
    CHECK ("movement_type" IN ('receive','issue','transfer','adjust','return')),
  "quantity"        INTEGER     NOT NULL,
  "reference_type"  TEXT
    CHECK ("reference_type" IN ('purchase_order','sales_order','delivery_note','manual')),
  "reference_id"    TEXT,
  "batch_number"    TEXT,
  "notes"           TEXT,
  "balance_after"   INTEGER     NOT NULL DEFAULT 0,
  "unit_cost_satang" INTEGER    NOT NULL DEFAULT 0,
  "tenant_id"       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"      TEXT        NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_stock_movements_product"
  ON "stock_movements" ("tenant_id", "product_id");

CREATE INDEX IF NOT EXISTS "idx_stock_movements_warehouse"
  ON "stock_movements" ("tenant_id", "warehouse_id");

CREATE INDEX IF NOT EXISTS "idx_stock_movements_created"
  ON "stock_movements" ("tenant_id", "created_at" DESC);

-- --------------------------------------------------------
-- stock_levels (materialised view as a table, refreshed by triggers)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "stock_levels" (
  "product_id"          TEXT    NOT NULL REFERENCES "products"("id"),
  "warehouse_id"        TEXT    NOT NULL REFERENCES "warehouses"("id"),
  "quantity_on_hand"    INTEGER NOT NULL DEFAULT 0,
  "quantity_reserved"   INTEGER NOT NULL DEFAULT 0,
  "quantity_available"  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("product_id", "warehouse_id")
);

-- --------------------------------------------------------
-- contacts (CRM)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contacts" (
  "id"                   TEXT        NOT NULL PRIMARY KEY,
  "contact_type"         TEXT        NOT NULL DEFAULT 'customer'
    CHECK ("contact_type" IN ('customer','vendor','both')),
  "code"                 TEXT,
  "company_name"         TEXT        NOT NULL,
  "contact_person"       TEXT,
  "email"                TEXT,
  "phone"                TEXT,
  "tax_id"               TEXT,
  "branch_number"        TEXT,
  "address_line1"        TEXT,
  "address_line2"        TEXT,
  "city"                 TEXT,
  "province"             TEXT,
  "postal_code"          TEXT,
  "country"              TEXT        NOT NULL DEFAULT 'TH',
  "payment_terms_days"   INTEGER     NOT NULL DEFAULT 30,
  "credit_limit_satang"  INTEGER,
  "notes"                TEXT,
  "is_active"            BOOLEAN     NOT NULL DEFAULT TRUE,
  "tenant_id"            TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_contacts_tenant_type"
  ON "contacts" ("tenant_id", "contact_type");

CREATE INDEX IF NOT EXISTS "idx_contacts_tenant_active"
  ON "contacts" ("tenant_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_contacts_tax_id"
  ON "contacts" ("tenant_id", "tax_id");

-- --------------------------------------------------------
-- departments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "departments" (
  "id"              TEXT        NOT NULL PRIMARY KEY,
  "code"            TEXT        NOT NULL,
  "name_th"         TEXT        NOT NULL,
  "name_en"         TEXT        NOT NULL,
  "manager_id"      TEXT,
  "cost_center_id"  TEXT,
  "tenant_id"       TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_departments_tenant_code"
  ON "departments" ("tenant_id", "code");

-- --------------------------------------------------------
-- employees
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "employees" (
  "id"                       TEXT        NOT NULL PRIMARY KEY,
  "employee_code"            TEXT        NOT NULL,
  "title_th"                 TEXT        CHECK ("title_th" IN ('นาย','นาง','นางสาว')),
  "first_name_th"            TEXT        NOT NULL,
  "last_name_th"             TEXT        NOT NULL,
  "first_name_en"            TEXT,
  "last_name_en"             TEXT,
  "nickname"                 TEXT,
  "email"                    TEXT,
  "phone"                    TEXT,
  "national_id"              TEXT,
  "tax_id"                   TEXT,
  "social_security_number"   TEXT,
  "date_of_birth"            TEXT,
  "hire_date"                TEXT        NOT NULL,
  "position"                 TEXT,
  "department_id"            TEXT        REFERENCES "departments"("id"),
  "employment_type"          TEXT        NOT NULL DEFAULT 'full_time'
    CHECK ("employment_type" IN ('full_time','part_time','contract','intern')),
  "status"                   TEXT        NOT NULL DEFAULT 'active'
    CHECK ("status" IN ('active','resigned','terminated')),
  "salary_satang"            INTEGER     NOT NULL DEFAULT 0,
  "bank_account_number"      TEXT,
  "bank_name"                TEXT,
  "provident_fund_percent"   INTEGER     NOT NULL DEFAULT 0,
  "resignation_date"         TEXT,
  "notes"                    TEXT,
  "tenant_id"                TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"               TEXT,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_employees_tenant_code"
  ON "employees" ("tenant_id", "employee_code");

CREATE INDEX IF NOT EXISTS "idx_employees_tenant_status"
  ON "employees" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_employees_dept"
  ON "employees" ("tenant_id", "department_id");

-- Deferred FK: departments.manager_id → employees.id
ALTER TABLE "departments"
  ADD CONSTRAINT "fk_departments_manager"
  FOREIGN KEY ("manager_id") REFERENCES "employees"("id")
  DEFERRABLE INITIALLY DEFERRED;

-- --------------------------------------------------------
-- payroll_runs
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id"                        TEXT        NOT NULL PRIMARY KEY,
  "pay_period_start"          TEXT        NOT NULL,
  "pay_period_end"            TEXT        NOT NULL,
  "run_date"                  TEXT        NOT NULL,
  "status"                    TEXT        NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','calculated','approved','paid')),
  "total_gross_satang"        INTEGER     NOT NULL DEFAULT 0,
  "total_deductions_satang"   INTEGER     NOT NULL DEFAULT 0,
  "total_net_satang"          INTEGER     NOT NULL DEFAULT 0,
  "total_employer_ssc_satang" INTEGER     NOT NULL DEFAULT 0,
  "total_tax_satang"          INTEGER     NOT NULL DEFAULT 0,
  "notes"                     TEXT,
  "tenant_id"                 TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by"                TEXT,
  "approved_by"               TEXT,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_payroll_runs_tenant_status"
  ON "payroll_runs" ("tenant_id", "status");

-- --------------------------------------------------------
-- payroll_items
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payroll_items" (
  "id"                         TEXT        NOT NULL PRIMARY KEY,
  "payroll_run_id"             TEXT        NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
  "employee_id"                TEXT        NOT NULL REFERENCES "employees"("id"),
  "base_salary_satang"         INTEGER     NOT NULL DEFAULT 0,
  "overtime_satang"            INTEGER     NOT NULL DEFAULT 0,
  "bonus_satang"               INTEGER     NOT NULL DEFAULT 0,
  "allowance_satang"           INTEGER     NOT NULL DEFAULT 0,
  "gross_satang"               INTEGER     NOT NULL DEFAULT 0,
  "social_security_satang"     INTEGER     NOT NULL DEFAULT 0,
  "provident_fund_satang"      INTEGER     NOT NULL DEFAULT 0,
  "personal_income_tax_satang" INTEGER     NOT NULL DEFAULT 0,
  "other_deductions_satang"    INTEGER     NOT NULL DEFAULT 0,
  "total_deductions_satang"    INTEGER     NOT NULL DEFAULT 0,
  "net_satang"                 INTEGER     NOT NULL DEFAULT 0,
  "employer_ssc_satang"        INTEGER     NOT NULL DEFAULT 0,
  "payment_method"             TEXT                 DEFAULT 'bank_transfer'
    CHECK ("payment_method" IN ('bank_transfer','cash','cheque')),
  "status"                     TEXT        NOT NULL DEFAULT 'calculated'
    CHECK ("status" IN ('calculated','paid')),
  "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_payroll_items_run_employee"
  ON "payroll_items" ("payroll_run_id", "employee_id");

-- --------------------------------------------------------
-- leave_types
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "leave_types" (
  "id"                 TEXT        NOT NULL PRIMARY KEY,
  "code"               TEXT        NOT NULL,
  "name_th"            TEXT        NOT NULL,
  "name_en"            TEXT        NOT NULL,
  "annual_quota_days"  INTEGER     NOT NULL DEFAULT 0,
  "is_paid"            BOOLEAN     NOT NULL DEFAULT TRUE,
  "tenant_id"          TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_leave_types_tenant_code"
  ON "leave_types" ("tenant_id", "code");

-- --------------------------------------------------------
-- leave_requests
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "employee_id"      TEXT        NOT NULL REFERENCES "employees"("id"),
  "leave_type_id"    TEXT        NOT NULL REFERENCES "leave_types"("id"),
  "start_date"       TEXT        NOT NULL,
  "end_date"         TEXT        NOT NULL,
  "days"             INTEGER     NOT NULL DEFAULT 1,
  "reason"           TEXT,
  "status"           TEXT        NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending','approved','rejected','cancelled')),
  "approved_by"      TEXT,
  "approved_at"      TIMESTAMPTZ,
  "rejection_reason" TEXT,
  "tenant_id"        TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_leave_requests_employee"
  ON "leave_requests" ("tenant_id", "employee_id");

CREATE INDEX IF NOT EXISTS "idx_leave_requests_status"
  ON "leave_requests" ("tenant_id", "status");

-- --------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','warehouses','stock_movements','contacts',
    'departments','employees','payroll_runs','payroll_items',
    'leave_types','leave_requests'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t
    );
  END LOOP;
END $$;

-- --------------------------------------------------------
-- RLS
-- --------------------------------------------------------
ALTER TABLE "products"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_types"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','warehouses','stock_movements','contacts',
    'departments','employees','payroll_runs','leave_types','leave_requests'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "%1$s_tenant_isolation" ON %1$s;
       CREATE POLICY "%1$s_tenant_isolation"
         ON %1$s USING (tenant_id = current_setting(''app.tenant_id'', TRUE));',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "stock_levels_tenant_isolation" ON "stock_levels";
CREATE POLICY "stock_levels_tenant_isolation"
  ON "stock_levels"
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

DROP POLICY IF EXISTS "payroll_items_tenant_isolation" ON "payroll_items";
CREATE POLICY "payroll_items_tenant_isolation"
  ON "payroll_items"
  USING (
    payroll_run_id IN (
      SELECT id FROM payroll_runs
      WHERE tenant_id = current_setting('app.tenant_id', TRUE)
    )
  );

-- --------------------------------------------------------
-- Seed permissions
-- --------------------------------------------------------
INSERT INTO permissions (id, name, description) VALUES
  -- Inventory
  ('inventory:product:create',   'inventory:product:create',   'Create products'),
  ('inventory:product:read',     'inventory:product:read',     'View products'),
  ('inventory:product:update',   'inventory:product:update',   'Update products'),
  ('inventory:warehouse:create', 'inventory:warehouse:create', 'Create warehouses'),
  ('inventory:warehouse:read',   'inventory:warehouse:read',   'View warehouses'),
  ('inventory:warehouse:update', 'inventory:warehouse:update', 'Update warehouses'),
  ('inventory:movement:create',  'inventory:movement:create',  'Record stock movements'),
  ('inventory:movement:read',    'inventory:movement:read',    'View stock movements'),
  ('inventory:level:read',       'inventory:level:read',       'View stock levels'),
  ('inventory:valuation:read',   'inventory:valuation:read',   'View stock valuation'),
  -- CRM
  ('crm:contact:create',  'crm:contact:create',  'Create contacts'),
  ('crm:contact:read',    'crm:contact:read',    'View contacts'),
  ('crm:contact:update',  'crm:contact:update',  'Update contacts'),
  ('crm:contact:delete',  'crm:contact:delete',  'Delete (deactivate) contacts'),
  -- HR
  ('hr:department:create', 'hr:department:create', 'Create departments'),
  ('hr:department:read',   'hr:department:read',   'View departments'),
  ('hr:department:update', 'hr:department:update', 'Update departments'),
  ('hr:employee:create',   'hr:employee:create',   'Create employees'),
  ('hr:employee:read',     'hr:employee:read',     'View employees'),
  ('hr:employee:update',   'hr:employee:update',   'Update employees'),
  ('hr:employee:resign',   'hr:employee:resign',   'Process employee resignation'),
  -- Payroll
  ('hr:payroll:create',    'hr:payroll:create',    'Create payroll runs'),
  ('hr:payroll:read',      'hr:payroll:read',      'View payroll runs'),
  ('hr:payroll:calculate', 'hr:payroll:calculate', 'Calculate payroll'),
  ('hr:payroll:approve',   'hr:payroll:approve',   'Approve payroll runs'),
  ('hr:payroll:pay',       'hr:payroll:pay',       'Mark payroll as paid'),
  -- Leave
  ('hr:leave:type:create',   'hr:leave:type:create',   'Create leave types'),
  ('hr:leave:type:read',     'hr:leave:type:read',     'View leave types'),
  ('hr:leave:request:create','hr:leave:request:create','Submit leave requests'),
  ('hr:leave:request:read',  'hr:leave:request:read',  'View leave requests'),
  ('hr:leave:request:approve','hr:leave:request:approve','Approve leave requests'),
  ('hr:leave:request:reject', 'hr:leave:request:reject', 'Reject leave requests')
ON CONFLICT (id) DO NOTHING;
