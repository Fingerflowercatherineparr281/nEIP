import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { uuidv7 } from 'uuidv7';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index.js';

/**
 * Test database configuration.
 * Uses the `neip_test` PostgreSQL schema to isolate test data from production.
 */
const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgres://localhost:5432/neip_test';

let _testSql: ReturnType<typeof postgres> | null = null;
let _testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Set up the test database connection.
 * Call once at the start of a test suite (e.g., in `beforeAll`).
 */
export function setupTestDb() {
  if (_testSql !== null) {
    return { db: _testDb as NonNullable<typeof _testDb>, sql: _testSql };
  }

  _testSql = postgres(TEST_DB_URL, {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
  });

  _testDb = drizzle(_testSql, { schema });

  return { db: _testDb, sql: _testSql };
}

/**
 * Tear down the test database connection.
 * Call once at the end of a test suite (e.g., in `afterAll`).
 */
export async function teardownTestDb() {
  if (_testSql) {
    await _testSql.end();
    _testSql = null;
    _testDb = null;
  }
}

/**
 * Truncate all application tables in dependency order (leaf → root).
 * Resets serial sequences as well.
 * Call in `beforeEach` / `afterEach` to guarantee isolation between tests.
 */
export async function truncateAll() {
  const { db } = setupTestDb();

  // Truncate in dependency order: junction tables first, then child tables, then root
  await db.execute(sql`
    TRUNCATE TABLE
      user_roles,
      role_permissions,
      users,
      roles,
      permissions,
      system_translations,
      tenants
    RESTART IDENTITY CASCADE
  `);
}

// ---------------------------------------------------------------------------
// Seed helpers — deterministic UUIDs based on well-known seeds for tests
// ---------------------------------------------------------------------------

export interface TestTenant {
  id: string;
  name: string;
  slug: string;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
}

export interface TestRole {
  id: string;
  name: string;
  tenant_id: string;
}

export interface TestPermission {
  id: string;
  name: string;
  description: string | null;
}

export interface SeedResult {
  tenant: TestTenant;
  user: TestUser;
  role: TestRole;
  adminPermission: TestPermission;
}

/**
 * Seed a minimal, self-consistent data set useful for most tests.
 *
 * Creates: 1 tenant → 1 user → 1 role → 1 permission → role_permission → user_role
 */
export async function seedTestData(): Promise<SeedResult> {
  const { db } = setupTestDb();

  const tenantId = uuidv7();
  const userId = uuidv7();
  const roleId = uuidv7();
  const permissionId = uuidv7();

  // Tenant
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Test Tenant',
    slug: `test-tenant-${tenantId.slice(0, 8)}`,
  });

  // Permission (global, no tenant_id)
  await db.insert(schema.permissions).values({
    id: permissionId,
    name: 'admin:all',
    description: 'Full system access — test fixture',
  });

  // Role
  await db.insert(schema.roles).values({
    id: roleId,
    name: 'Admin',
    tenant_id: tenantId,
  });

  // User
  await db.insert(schema.users).values({
    id: userId,
    email: `admin-${userId.slice(0, 8)}@test.local`,
    password_hash: '$argon2id$placeholder',
    name: 'Test Admin',
    tenant_id: tenantId,
  });

  // Junction: role ↔ permission
  await db.insert(schema.role_permissions).values({
    role_id: roleId,
    permission_id: permissionId,
    tenant_id: tenantId,
  });

  // Junction: user ↔ role
  await db.insert(schema.user_roles).values({
    user_id: userId,
    role_id: roleId,
    tenant_id: tenantId,
  });

  return {
    tenant: { id: tenantId, name: 'Test Tenant', slug: `test-tenant-${tenantId.slice(0, 8)}` },
    user: {
      id: userId,
      email: `admin-${userId.slice(0, 8)}@test.local`,
      name: 'Test Admin',
      tenant_id: tenantId,
    },
    role: { id: roleId, name: 'Admin', tenant_id: tenantId },
    adminPermission: { id: permissionId, name: 'admin:all', description: 'Full system access — test fixture' },
  };
}
