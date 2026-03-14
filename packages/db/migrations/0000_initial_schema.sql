-- ============================================================
-- Migration: 0000_initial_schema
-- Story:     1.3 — Database Schema Foundation
-- Created:   2026-03-14
-- ============================================================

-- --------------------------------------------------------
-- tenants
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenants" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "name"       TEXT        NOT NULL,
  "slug"       TEXT        NOT NULL UNIQUE,
  "settings"   JSONB       DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- permissions  (global — no tenant_id)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "permissions" (
  "id"          TEXT        NOT NULL PRIMARY KEY,
  "name"        TEXT        NOT NULL UNIQUE,
  "description" TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- users
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "email"         TEXT        NOT NULL,
  "password_hash" TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "tenant_id"     TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");

-- --------------------------------------------------------
-- roles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "roles" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "name"       TEXT        NOT NULL,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_tenant_unique" ON "roles" ("name", "tenant_id");

-- --------------------------------------------------------
-- role_permissions  (junction)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id"       TEXT        NOT NULL REFERENCES "roles"("id")       ON DELETE CASCADE,
  "permission_id" TEXT        NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "tenant_id"     TEXT        NOT NULL REFERENCES "tenants"("id")     ON DELETE CASCADE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("role_id", "permission_id")
);

-- --------------------------------------------------------
-- user_roles  (junction)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id"    TEXT        NOT NULL REFERENCES "users"("id")   ON DELETE CASCADE,
  "role_id"    TEXT        NOT NULL REFERENCES "roles"("id")   ON DELETE CASCADE,
  "tenant_id"  TEXT        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("user_id", "role_id")
);

-- --------------------------------------------------------
-- system_translations  (composite PK: key + namespace + locale)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "system_translations" (
  "key"       TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "locale"    TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  PRIMARY KEY ("key", "namespace", "locale")
);

-- ============================================================
-- Row-Level Security (RLS) — AR22
-- Session variable:  SET app.current_tenant = '<tenant_id>'
-- ============================================================

-- tenants: each tenant row is visible only to itself
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_isolation" ON "tenants";
CREATE POLICY "tenants_isolation" ON "tenants"
  USING ("id" = current_setting('app.current_tenant', TRUE));

-- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_tenant_isolation" ON "users";
CREATE POLICY "users_tenant_isolation" ON "users"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

-- roles
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_tenant_isolation" ON "roles";
CREATE POLICY "roles_tenant_isolation" ON "roles"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

-- permissions: global — no RLS filter needed; but still enable for consistency
-- Superuser / service-role bypass is assumed via BYPASSRLS or SET role.
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_allow_all" ON "permissions";
CREATE POLICY "permissions_allow_all" ON "permissions"
  USING (TRUE);

-- role_permissions
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_tenant_isolation" ON "role_permissions";
CREATE POLICY "role_permissions_tenant_isolation" ON "role_permissions"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

-- user_roles
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_tenant_isolation" ON "user_roles";
CREATE POLICY "user_roles_tenant_isolation" ON "user_roles"
  USING ("tenant_id" = current_setting('app.current_tenant', TRUE));

-- system_translations: global — no RLS filter
ALTER TABLE "system_translations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_translations_allow_all" ON "system_translations";
CREATE POLICY "system_translations_allow_all" ON "system_translations"
  USING (TRUE);

-- ============================================================
-- updated_at auto-update trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach trigger to every table that has updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenants','users','roles','role_permissions','user_roles']
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
