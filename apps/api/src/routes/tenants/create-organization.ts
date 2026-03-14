/**
 * POST /api/v1/organizations
 *
 * Creates a new tenant (organization) with the following side-effects:
 *   1. Seeds TFAC Chart of Accounts for the new tenant
 *   2. Auto-creates first fiscal year with 12 monthly periods
 *   3. Creates default roles (Owner, Accountant, Approver) with permissions
 *   4. Assigns the creator the Owner role
 *
 * Acceptance criteria (Story 4.4):
 *   AC#1 — POST /api/v1/organizations creates tenant + CoA + fiscal year
 *   AC#2 — Creator becomes Owner role automatically
 *
 * Architecture references:
 *   AR22 — Custom table-based RBAC
 *   FR35 — Tenant data isolation
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ConflictError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const createOrgBodySchema = {
  type: 'object',
  required: ['name', 'businessType'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Organization display name',
    },
    businessType: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Business type (e.g. "sole_proprietorship", "limited_company")',
    },
    fiscalYearStart: {
      type: 'integer',
      minimum: 1,
      maximum: 12,
      description: 'Fiscal year start month (1-12). Defaults to 1 (January).',
    },
  },
} as const;

const createOrgResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    businessType: { type: 'string' },
    fiscalYearId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

interface CreateOrgBody {
  name: string;
  businessType: string;
  fiscalYearStart?: number;
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  settings: unknown;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// TFAC standard Chart of Accounts seed data
// ---------------------------------------------------------------------------

interface CoaSeed {
  code: string;
  nameTh: string;
  nameEn: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}

const TFAC_COA_SEED: readonly CoaSeed[] = [
  // Assets (1xxx)
  { code: '1100', nameTh: 'เงินสดและรายการเทียบเท่าเงินสด', nameEn: 'Cash and Cash Equivalents', accountType: 'asset' },
  { code: '1200', nameTh: 'ลูกหนี้การค้า', nameEn: 'Accounts Receivable', accountType: 'asset' },
  { code: '1300', nameTh: 'สินค้าคงเหลือ', nameEn: 'Inventory', accountType: 'asset' },
  { code: '1400', nameTh: 'สินทรัพย์หมุนเวียนอื่น', nameEn: 'Other Current Assets', accountType: 'asset' },
  { code: '1500', nameTh: 'ที่ดิน อาคาร และอุปกรณ์', nameEn: 'Property, Plant and Equipment', accountType: 'asset' },
  { code: '1600', nameTh: 'สินทรัพย์ไม่มีตัวตน', nameEn: 'Intangible Assets', accountType: 'asset' },
  // Liabilities (2xxx)
  { code: '2100', nameTh: 'เจ้าหนี้การค้า', nameEn: 'Accounts Payable', accountType: 'liability' },
  { code: '2200', nameTh: 'เงินกู้ยืมระยะสั้น', nameEn: 'Short-term Borrowings', accountType: 'liability' },
  { code: '2300', nameTh: 'หนี้สินหมุนเวียนอื่น', nameEn: 'Other Current Liabilities', accountType: 'liability' },
  { code: '2400', nameTh: 'เงินกู้ยืมระยะยาว', nameEn: 'Long-term Borrowings', accountType: 'liability' },
  { code: '2500', nameTh: 'ภาษีเงินได้ค้างจ่าย', nameEn: 'Income Tax Payable', accountType: 'liability' },
  { code: '2600', nameTh: 'ภาษีมูลค่าเพิ่มขาย', nameEn: 'Output VAT', accountType: 'liability' },
  // Equity (3xxx)
  { code: '3100', nameTh: 'ทุนจดทะเบียน', nameEn: 'Registered Capital', accountType: 'equity' },
  { code: '3200', nameTh: 'กำไรสะสม', nameEn: 'Retained Earnings', accountType: 'equity' },
  { code: '3300', nameTh: 'กำไร(ขาดทุน)สุทธิ', nameEn: 'Net Income (Loss)', accountType: 'equity' },
  // Revenue (4xxx)
  { code: '4100', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue', accountType: 'revenue' },
  { code: '4200', nameTh: 'รายได้จากการให้บริการ', nameEn: 'Service Revenue', accountType: 'revenue' },
  { code: '4300', nameTh: 'รายได้อื่น', nameEn: 'Other Income', accountType: 'revenue' },
  // Expenses (5xxx)
  { code: '5100', nameTh: 'ต้นทุนขาย', nameEn: 'Cost of Goods Sold', accountType: 'expense' },
  { code: '5200', nameTh: 'เงินเดือนและค่าจ้าง', nameEn: 'Salaries and Wages', accountType: 'expense' },
  { code: '5300', nameTh: 'ค่าเช่า', nameEn: 'Rent Expense', accountType: 'expense' },
  { code: '5400', nameTh: 'ค่าสาธารณูปโภค', nameEn: 'Utilities Expense', accountType: 'expense' },
  { code: '5500', nameTh: 'ค่าเสื่อมราคา', nameEn: 'Depreciation Expense', accountType: 'expense' },
  { code: '5600', nameTh: 'ค่าใช้จ่ายในการขายและบริหาร', nameEn: 'Selling and Admin Expenses', accountType: 'expense' },
  { code: '5700', nameTh: 'ภาษีมูลค่าเพิ่มซื้อ', nameEn: 'Input VAT', accountType: 'expense' },
  { code: '5900', nameTh: 'ค่าใช้จ่ายอื่น', nameEn: 'Other Expenses', accountType: 'expense' },
] as const;

// ---------------------------------------------------------------------------
// Default role/permission seed data
// ---------------------------------------------------------------------------

import {
  ALL_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  APPROVER_PERMISSIONS,
  ROLE_OWNER,
  ROLE_ACCOUNTANT,
  ROLE_APPROVER,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function createOrganizationRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.post<{ Body: CreateOrgBody }>(
    `${API_V1_PREFIX}/organizations`,
    {
      schema: {
        description: 'Create a new organization (tenant) with TFAC CoA and fiscal year',
        tags: ['tenants'],
        security: [{ bearerAuth: [] }],
        body: createOrgBodySchema,
        response: {
          201: {
            description: 'Organization created successfully',
            ...createOrgResponseSchema,
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { name, businessType, fiscalYearStart } = request.body;
      const userId = request.user.sub;

      // Generate a URL-safe slug from the org name.
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || `org-${Date.now()}`;

      // Check for existing slug.
      const existingSlug = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1
      `;
      if (existingSlug.length > 0) {
        throw new ConflictError({
          detail: `An organization with slug "${slug}" already exists. Choose a different name.`,
        });
      }

      const tenantId = crypto.randomUUID();
      const settings = { businessType, fiscalYearStart: fiscalYearStart ?? 1 };

      // 1. Create the tenant.
      const tenantRows = await fastify.sql<[TenantRow?]>`
        INSERT INTO tenants (id, name, slug, settings)
        VALUES (${tenantId}, ${name}, ${slug}, ${JSON.stringify(settings)})
        RETURNING id, name, slug, settings, created_at, updated_at
      `;

      const tenant = tenantRows[0];
      if (!tenant) {
        throw new Error('Failed to create tenant — no row returned from insert.');
      }

      // 2. Seed TFAC Chart of Accounts.
      for (const account of TFAC_COA_SEED) {
        const accountId = crypto.randomUUID();
        await fastify.sql`
          INSERT INTO chart_of_accounts (id, code, name_th, name_en, account_type, tenant_id)
          VALUES (${accountId}, ${account.code}, ${account.nameTh}, ${account.nameEn}, ${account.accountType}, ${tenantId})
          ON CONFLICT DO NOTHING
        `;
      }

      // 3. Create first fiscal year (current year) with 12 monthly periods.
      const currentYear = new Date().getFullYear();
      const startMonth = (fiscalYearStart ?? 1) - 1; // 0-indexed
      const fyStartDate = new Date(currentYear, startMonth, 1);
      const fyEndDate = new Date(currentYear + 1, startMonth, 0); // last day of month before start

      const fiscalYearId = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO fiscal_years (id, year, start_date, end_date, tenant_id)
        VALUES (${fiscalYearId}, ${currentYear}, ${fyStartDate.toISOString().slice(0, 10)}, ${fyEndDate.toISOString().slice(0, 10)}, ${tenantId})
      `;

      // Create 12 monthly periods.
      for (let i = 0; i < 12; i++) {
        const periodId = crypto.randomUUID();
        const periodStart = new Date(currentYear, startMonth + i, 1);
        const periodEnd = new Date(currentYear, startMonth + i + 1, 0);
        await fastify.sql`
          INSERT INTO fiscal_periods (id, fiscal_year_id, period_number, start_date, end_date, status)
          VALUES (${periodId}, ${fiscalYearId}, ${i + 1}, ${periodStart.toISOString().slice(0, 10)}, ${periodEnd.toISOString().slice(0, 10)}, 'open')
        `;
      }

      // 4. Seed default roles with permissions for this tenant.
      const roleConfigs = [
        { name: ROLE_OWNER, permissions: ALL_PERMISSIONS },
        { name: ROLE_ACCOUNTANT, permissions: ACCOUNTANT_PERMISSIONS },
        { name: ROLE_APPROVER, permissions: APPROVER_PERMISSIONS },
      ] as const;

      let ownerRoleId: string | undefined;

      for (const roleConfig of roleConfigs) {
        const roleId = crypto.randomUUID();
        if (roleConfig.name === ROLE_OWNER) {
          ownerRoleId = roleId;
        }

        await fastify.sql`
          INSERT INTO roles (id, name, tenant_id)
          VALUES (${roleId}, ${roleConfig.name}, ${tenantId})
          ON CONFLICT DO NOTHING
        `;

        // Seed role_permissions — each permission_id references the permissions table.
        for (const perm of roleConfig.permissions) {
          await fastify.sql`
            INSERT INTO role_permissions (role_id, permission_id, tenant_id)
            VALUES (${roleId}, ${perm}, ${tenantId})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // 5. Assign the creator as Owner.
      if (ownerRoleId) {
        // Update user's tenant_id to the new org.
        await fastify.sql`
          UPDATE users SET tenant_id = ${tenantId} WHERE id = ${userId}
        `;

        await fastify.sql`
          INSERT INTO user_roles (user_id, role_id, tenant_id)
          VALUES (${userId}, ${ownerRoleId}, ${tenantId})
          ON CONFLICT DO NOTHING
        `;
      }

      request.log.info(
        { tenantId: tenant.id, tenantName: tenant.name, createdBy: userId },
        'Organization created with TFAC CoA and fiscal year',
      );

      return reply.status(201).send({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        businessType,
        fiscalYearId,
        createdAt: tenant.created_at.toISOString(),
      });
    },
  );
}
