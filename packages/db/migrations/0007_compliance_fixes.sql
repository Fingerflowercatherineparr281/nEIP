-- ============================================================
-- Migration: 0007_compliance_fixes
-- Description: Compliance fixes for all 13 test failures.
--   1. GL-008: GL account delete permission seed
--   2. AR-002: Invoice posted_at + journal_entry_id columns + status
--   3. COMP-002: Invoice VAT fields (computed, no column needed)
--   4. COMP-024: Employee nationality column
--   5. COMP-034: Employee anonymized status
--   6. COMP-043: JE immutability DB trigger
-- Created: 2026-03-16
-- ============================================================

-- --------------------------------------------------------
-- 1. Add posted_at and journal_entry_id to invoices
-- --------------------------------------------------------
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "posted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "journal_entry_id" TEXT REFERENCES "journal_entries"("id");

-- Update invoices status check to include 'posted'
ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_status_check";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_status_check"
    CHECK ("status" IN ('draft', 'posted', 'sent', 'paid', 'partial', 'overdue', 'void'));

-- --------------------------------------------------------
-- 2. Add nationality to employees
-- --------------------------------------------------------
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "nationality" TEXT NOT NULL DEFAULT 'TH';

-- Update employees status check to include 'anonymized'
ALTER TABLE "employees"
  DROP CONSTRAINT IF EXISTS "employees_status_check";

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_status_check"
    CHECK ("status" IN ('active', 'resigned', 'terminated', 'anonymized'));

-- --------------------------------------------------------
-- 3. Seed new permissions: GL account delete + HR employee anonymize
-- --------------------------------------------------------
INSERT INTO permissions (id, name, description) VALUES
  ('gl:account:delete',      'gl:account:delete',      'Delete (soft-delete) GL accounts'),
  ('hr:employee:anonymize',  'hr:employee:anonymize',  'Anonymize employee PII (PDPA right to erasure)')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 4. COMP-043: JE immutability trigger
-- Prevents UPDATE of journal_entries where OLD.status = 'posted'
-- unless transitioning to 'reversed' (reversal workflow).
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_je_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'posted' AND NEW.status != 'reversed' THEN
    RAISE EXCEPTION
      'Journal entry % is posted and cannot be modified. Only reversal is permitted.',
      OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_je_immutability ON journal_entries;
CREATE TRIGGER trg_je_immutability
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_je_immutability();

-- --------------------------------------------------------
-- 5. Index for invoices posted_at
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_status"
  ON "invoices" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_invoices_posted_at"
  ON "invoices" ("tenant_id", "posted_at")
  WHERE "posted_at" IS NOT NULL;

-- --------------------------------------------------------
-- 6. Index for employees nationality
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_employees_nationality"
  ON "employees" ("tenant_id", "nationality");
