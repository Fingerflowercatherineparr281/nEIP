/**
 * Chart of Accounts routes:
 *   GET  /api/v1/accounts     — list accounts
 *   POST /api/v1/accounts     — create account
 *   PUT  /api/v1/accounts/:id — update account
 *
 * Story 4.5a — GL + CoA + Fiscal API Routes
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ConflictError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';
import { requirePermission } from '../../hooks/require-permission.js';
import {
  GL_ACCOUNT_CREATE,
  GL_ACCOUNT_READ,
  GL_ACCOUNT_UPDATE,
  GL_ACCOUNT_DELETE,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const accountResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    nameTh: { type: 'string' },
    nameEn: { type: 'string' },
    accountType: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
    isActive: { type: 'boolean' },
    parentId: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const createAccountBodySchema = {
  type: 'object',
  required: ['code', 'nameTh', 'nameEn', 'accountType'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 20 },
    nameTh: { type: 'string', minLength: 1, maxLength: 255 },
    nameEn: { type: 'string', minLength: 1, maxLength: 255 },
    accountType: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
    parentId: { type: 'string' },
  },
} as const;

const updateAccountBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nameTh: { type: 'string', minLength: 1, maxLength: 255 },
    nameEn: { type: 'string', minLength: 1, maxLength: 255 },
    isActive: { type: 'boolean' },
    parentId: { type: 'string', nullable: true },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    accountType: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
    isActive: { type: 'boolean' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateAccountBody {
  code: string;
  nameTh: string;
  nameEn: string;
  accountType: string;
  parentId?: string;
}

interface UpdateAccountBody {
  nameTh?: string;
  nameEn?: string;
  isActive?: boolean;
  parentId?: string | null;
}

interface AccountListQuery {
  limit?: number;
  offset?: number;
  accountType?: string;
  isActive?: boolean;
}

interface IdParams {
  id: string;
}

interface AccountRow {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  account_type: string;
  is_active: boolean;
  parent_id: string | null;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CountRow {
  count: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mapAccountRow(row: AccountRow) {
  return {
    id: row.id,
    code: row.code,
    nameTh: row.name_th,
    nameEn: row.name_en,
    accountType: row.account_type,
    isActive: row.is_active,
    parentId: row.parent_id,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function accountRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // GET /api/v1/accounts
  fastify.get<{ Querystring: AccountListQuery }>(
    `${API_V1_PREFIX}/accounts`,
    {
      schema: {
        description: 'List Chart of Accounts for the current tenant',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of accounts',
            type: 'object',
            properties: {
              items: { type: 'array', items: accountResponseSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(GL_ACCOUNT_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const limit = request.query.limit ?? 100;
      const offset = request.query.offset ?? 0;
      const accountType = request.query.accountType;

      let accounts: AccountRow[];
      let countRows: CountRow[];

      if (accountType !== undefined) {
        countRows = await fastify.sql<CountRow[]>`
          SELECT COUNT(*)::text as count FROM chart_of_accounts
          WHERE tenant_id = ${tenantId} AND account_type = ${accountType}
        `;
        accounts = await fastify.sql<AccountRow[]>`
          SELECT * FROM chart_of_accounts
          WHERE tenant_id = ${tenantId} AND account_type = ${accountType}
          ORDER BY code ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        countRows = await fastify.sql<CountRow[]>`
          SELECT COUNT(*)::text as count FROM chart_of_accounts
          WHERE tenant_id = ${tenantId}
        `;
        accounts = await fastify.sql<AccountRow[]>`
          SELECT * FROM chart_of_accounts
          WHERE tenant_id = ${tenantId}
          ORDER BY code ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      const total = parseInt(countRows[0]?.count ?? '0', 10);

      return reply.status(200).send({
        items: accounts.map(mapAccountRow),
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    },
  );

  // POST /api/v1/accounts
  fastify.post<{ Body: CreateAccountBody }>(
    `${API_V1_PREFIX}/accounts`,
    {
      schema: {
        description: 'Create a new account in the Chart of Accounts',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        body: createAccountBodySchema,
        response: { 201: { description: 'Account created', ...accountResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_ACCOUNT_CREATE)],
    },
    async (request, reply) => {
      const { code, nameTh, nameEn, accountType, parentId } = request.body;
      const { tenantId } = request.user;

      // Check for duplicate code within tenant.
      const existing = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM chart_of_accounts WHERE tenant_id = ${tenantId} AND code = ${code} LIMIT 1
      `;
      if (existing.length > 0) {
        throw new ConflictError({
          detail: `Account with code "${code}" already exists in this organization.`,
        });
      }

      const accountId = crypto.randomUUID();
      const rows = await fastify.sql<[AccountRow?]>`
        INSERT INTO chart_of_accounts (id, code, name_th, name_en, account_type, parent_id, tenant_id)
        VALUES (${accountId}, ${code}, ${nameTh}, ${nameEn}, ${accountType}, ${parentId ?? null}, ${tenantId})
        RETURNING *
      `;

      const account = rows[0];
      if (!account) {
        throw new Error('Failed to create account — no row returned.');
      }

      request.log.info({ accountId, code, tenantId }, 'Account created');

      return reply.status(201).send(mapAccountRow(account));
    },
  );

  // DELETE /api/v1/accounts/:id
  fastify.delete<{ Params: IdParams }>(
    `${API_V1_PREFIX}/accounts/:id`,
    {
      schema: {
        description: 'Delete (soft-delete) a GL account — sets is_active=false. Returns 409 if referenced by journal entry lines.',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: { description: 'Account deleted', ...accountResponseSchema },
        },
      },
      preHandler: [requireAuth, requirePermission(GL_ACCOUNT_DELETE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // Check the account belongs to the tenant
      const existing = await fastify.sql<[AccountRow?]>`
        SELECT * FROM chart_of_accounts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) {
        throw new NotFoundError({ detail: `Account ${id} not found.` });
      }

      // Check for references in journal_entry_lines
      const refs = await fastify.sql<[{ count: string }]>`
        SELECT COUNT(*)::text AS count FROM journal_entry_lines WHERE account_id = ${id}
      `;
      if (parseInt(refs[0]?.count ?? '0', 10) > 0) {
        throw new ConflictError({
          detail: `Account ${id} is referenced by ${refs[0]?.count} journal entry line(s) and cannot be deleted.`,
        });
      }

      // Soft-delete: set is_active = false
      const rows = await fastify.sql<[AccountRow?]>`
        UPDATE chart_of_accounts
        SET is_active = false, updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;

      const account = rows[0];
      if (!account) {
        throw new NotFoundError({ detail: `Account ${id} not found.` });
      }

      request.log.info({ accountId: id, tenantId }, 'Account soft-deleted');

      return reply.status(200).send(mapAccountRow(account));
    },
  );

  // PUT /api/v1/accounts/:id
  fastify.put<{ Params: IdParams; Body: UpdateAccountBody }>(
    `${API_V1_PREFIX}/accounts/:id`,
    {
      schema: {
        description: 'Update an account in the Chart of Accounts',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: updateAccountBodySchema,
        response: { 200: { description: 'Account updated', ...accountResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_ACCOUNT_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { nameTh, nameEn, isActive, parentId } = request.body;

      // Build dynamic SET — postgres.js tagged template approach.
      // For simplicity, update all provided fields at once.
      const rows = await fastify.sql<[AccountRow?]>`
        UPDATE chart_of_accounts
        SET
          name_th = COALESCE(${nameTh ?? null}, name_th),
          name_en = COALESCE(${nameEn ?? null}, name_en),
          is_active = COALESCE(${isActive ?? null}, is_active),
          parent_id = CASE WHEN ${parentId !== undefined} THEN ${parentId ?? null} ELSE parent_id END,
          updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;

      const account = rows[0];
      if (!account) {
        throw new NotFoundError({ detail: `Account ${id} not found.` });
      }

      request.log.info({ accountId: id, tenantId }, 'Account updated');

      return reply.status(200).send(mapAccountRow(account));
    },
  );
}
