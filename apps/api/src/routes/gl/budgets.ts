/**
 * Budget routes:
 *   GET  /api/v1/budgets     — list budgets
 *   POST /api/v1/budgets     — create budget
 *   PUT  /api/v1/budgets/:id — update budget
 *
 * Story 4.5a — GL + CoA + Fiscal API Routes
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ConflictError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { toISO } from '../../lib/to-iso.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { GL_ACCOUNT_READ, GL_ACCOUNT_CREATE, GL_ACCOUNT_UPDATE } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const budgetResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    accountId: { type: 'string' },
    fiscalYear: { type: 'integer' },
    amountSatang: { type: 'string', description: 'Budget amount in satang (bigint as string)' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const createBudgetBodySchema = {
  type: 'object',
  required: ['accountId', 'fiscalYear', 'amountSatang'],
  additionalProperties: false,
  properties: {
    accountId: { type: 'string', description: 'Chart of Accounts ID' },
    fiscalYear: { type: 'integer', minimum: 2000, maximum: 2100 },
    amountSatang: { type: 'string', description: 'Budget amount in satang' },
  },
} as const;

const updateBudgetBodySchema = {
  type: 'object',
  required: ['amountSatang'],
  additionalProperties: false,
  properties: {
    amountSatang: { type: 'string', description: 'Updated budget amount in satang' },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    fiscalYear: { type: 'integer' },
    accountId: { type: 'string' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateBudgetBody {
  accountId: string;
  fiscalYear: number;
  amountSatang: string;
}

interface UpdateBudgetBody {
  amountSatang: string;
}

interface BudgetListQuery {
  limit?: number;
  offset?: number;
  fiscalYear?: number;
  accountId?: string;
}

interface IdParams {
  id: string;
}

interface BudgetRow {
  id: string;
  account_id: string;
  fiscal_year: number;
  amount_satang: bigint;
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

function mapBudgetRow(row: BudgetRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    fiscalYear: row.fiscal_year,
    amountSatang: row.amount_satang.toString(),
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function budgetRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // GET /api/v1/budgets
  fastify.get<{ Querystring: BudgetListQuery }>(
    `${API_V1_PREFIX}/budgets`,
    {
      schema: {
        description: 'List budgets for the current tenant',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of budgets',
            type: 'object',
            properties: {
              items: { type: 'array', items: budgetResponseSchema },
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
      const fiscalYear = request.query.fiscalYear;

      let budgets: BudgetRow[];
      let countRows: CountRow[];

      if (fiscalYear !== undefined) {
        countRows = await fastify.sql<CountRow[]>`
          SELECT COUNT(*)::text as count FROM budgets
          WHERE tenant_id = ${tenantId} AND fiscal_year = ${fiscalYear}
        `;
        budgets = await fastify.sql<BudgetRow[]>`
          SELECT * FROM budgets
          WHERE tenant_id = ${tenantId} AND fiscal_year = ${fiscalYear}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        countRows = await fastify.sql<CountRow[]>`
          SELECT COUNT(*)::text as count FROM budgets WHERE tenant_id = ${tenantId}
        `;
        budgets = await fastify.sql<BudgetRow[]>`
          SELECT * FROM budgets WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      const total = parseInt(countRows[0]?.count ?? '0', 10);

      return reply.status(200).send({
        items: budgets.map(mapBudgetRow),
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    },
  );

  // POST /api/v1/budgets
  fastify.post<{ Body: CreateBudgetBody }>(
    `${API_V1_PREFIX}/budgets`,
    {
      schema: {
        description: 'Create a budget allocation for an account and fiscal year',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        body: createBudgetBodySchema,
        response: { 201: { description: 'Budget created', ...budgetResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_ACCOUNT_CREATE)],
    },
    async (request, reply) => {
      const { accountId, fiscalYear, amountSatang } = request.body;
      const { tenantId } = request.user;

      // Check for existing budget (unique per account + year + tenant).
      const existing = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM budgets
        WHERE tenant_id = ${tenantId} AND account_id = ${accountId} AND fiscal_year = ${fiscalYear}
        LIMIT 1
      `;
      if (existing.length > 0) {
        throw new ConflictError({
          detail: `Budget for account ${accountId} in fiscal year ${fiscalYear} already exists.`,
        });
      }

      const budgetId = crypto.randomUUID();
      const rows = await fastify.sql<[BudgetRow?]>`
        INSERT INTO budgets (id, account_id, fiscal_year, amount_satang, tenant_id)
        VALUES (${budgetId}, ${accountId}, ${fiscalYear}, ${amountSatang}::bigint, ${tenantId})
        RETURNING *
      `;

      const budget = rows[0];
      if (!budget) {
        throw new Error('Failed to create budget — no row returned.');
      }

      request.log.info({ budgetId, accountId, fiscalYear, tenantId }, 'Budget created');

      return reply.status(201).send(mapBudgetRow(budget));
    },
  );

  // PUT /api/v1/budgets/:id
  fastify.put<{ Params: IdParams; Body: UpdateBudgetBody }>(
    `${API_V1_PREFIX}/budgets/:id`,
    {
      schema: {
        description: 'Update a budget amount',
        tags: ['gl'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: updateBudgetBodySchema,
        response: { 200: { description: 'Budget updated', ...budgetResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(GL_ACCOUNT_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { amountSatang } = request.body;

      const rows = await fastify.sql<[BudgetRow?]>`
        UPDATE budgets
        SET amount_satang = ${amountSatang}::bigint, updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;

      const budget = rows[0];
      if (!budget) {
        throw new NotFoundError({ detail: `Budget ${id} not found.` });
      }

      request.log.info({ budgetId: id, tenantId }, 'Budget updated');

      return reply.status(200).send(mapBudgetRow(budget));
    },
  );
}
