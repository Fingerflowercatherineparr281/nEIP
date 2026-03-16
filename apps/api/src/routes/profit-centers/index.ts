/**
 * Profit Center routes (CO-PCA):
 *   POST /api/v1/profit-centers         — create
 *   GET  /api/v1/profit-centers         — list
 *   GET  /api/v1/profit-centers/:id     — detail
 *   PUT  /api/v1/profit-centers/:id     — update
 *   GET  /api/v1/profit-centers/:id/report — P&L by profit center
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ValidationError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { toISO } from '../../lib/to-iso.js';
import {
  CO_PROFIT_CENTER_CREATE,
  CO_PROFIT_CENTER_READ,
  CO_PROFIT_CENTER_UPDATE,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const createSchema = {
  type: 'object',
  required: ['code', 'nameTh', 'nameEn'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 20 },
    nameTh: { type: 'string', minLength: 1, maxLength: 255 },
    nameEn: { type: 'string', minLength: 1, maxLength: 255 },
    parentId: { type: 'string', nullable: true },
  },
} as const;

const updateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nameTh: { type: 'string', minLength: 1, maxLength: 255 },
    nameEn: { type: 'string', minLength: 1, maxLength: 255 },
    parentId: { type: 'string', nullable: true },
    isActive: { type: 'boolean' },
  },
} as const;

const responseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    nameTh: { type: 'string' },
    nameEn: { type: 'string' },
    parentId: { type: 'string', nullable: true },
    isActive: { type: 'boolean' },
    tenantId: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateBody { code: string; nameTh: string; nameEn: string; parentId?: string; }
interface UpdateBody { nameTh?: string; nameEn?: string; parentId?: string; isActive?: boolean; }
interface IdParams { id: string; }

interface PcRow {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  parent_id: string | null;
  is_active: boolean;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

function mapPc(r: PcRow) {
  return {
    id: r.id,
    code: r.code,
    nameTh: r.name_th,
    nameEn: r.name_en,
    parentId: r.parent_id,
    isActive: r.is_active,
    tenantId: r.tenant_id,
    createdAt: toISO(r.created_at),
    updatedAt: toISO(r.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function profitCenterRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // POST — create
  fastify.post<{ Body: CreateBody }>(
    `${API_V1_PREFIX}/profit-centers`,
    {
      schema: {
        description: 'Create a profit center',
        tags: ['profit-centers'],
        security: [{ bearerAuth: [] }],
        body: createSchema,
        response: { 201: { description: 'Profit center created', ...responseSchema } },
      },
      preHandler: [requireAuth, requirePermission(CO_PROFIT_CENTER_CREATE)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { code, nameTh, nameEn, parentId = null } = request.body;

      const existing = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM profit_centers WHERE tenant_id = ${tenantId} AND code = ${code} LIMIT 1
      `;
      if (existing[0]) throw new ValidationError({ detail: `Profit center code "${code}" already exists.` });

      const id = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO profit_centers (id, code, name_th, name_en, parent_id, is_active, tenant_id)
        VALUES (${id}, ${code}, ${nameTh}, ${nameEn}, ${parentId}, true, ${tenantId})
      `;

      const rows = await fastify.sql<[PcRow]>`SELECT * FROM profit_centers WHERE id = ${id} LIMIT 1`;
      return reply.status(201).send(mapPc(rows[0]));
    },
  );

  // GET — list
  fastify.get(
    `${API_V1_PREFIX}/profit-centers`,
    {
      schema: {
        description: 'List profit centers',
        tags: ['profit-centers'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { includeInactive: { type: 'boolean', default: false } },
        },
        response: {
          200: {
            type: 'object',
            properties: { items: { type: 'array', items: responseSchema }, total: { type: 'integer' } },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(CO_PROFIT_CENTER_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const includeInactive = (request.query as { includeInactive?: boolean }).includeInactive ?? false;

      const rows = includeInactive
        ? await fastify.sql<PcRow[]>`SELECT * FROM profit_centers WHERE tenant_id = ${tenantId} ORDER BY code`
        : await fastify.sql<PcRow[]>`SELECT * FROM profit_centers WHERE tenant_id = ${tenantId} AND is_active = true ORDER BY code`;

      return reply.status(200).send({ items: rows.map(mapPc), total: rows.length });
    },
  );

  // GET /:id — detail
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/profit-centers/:id`,
    {
      schema: {
        description: 'Get profit center detail',
        tags: ['profit-centers'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { description: 'Profit center', ...responseSchema } },
      },
      preHandler: [requireAuth, requirePermission(CO_PROFIT_CENTER_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const rows = await fastify.sql<[PcRow?]>`SELECT * FROM profit_centers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!rows[0]) throw new NotFoundError({ detail: `Profit center ${id} not found.` });
      return reply.status(200).send(mapPc(rows[0]));
    },
  );

  // PUT /:id — update
  fastify.put<{ Params: IdParams; Body: UpdateBody }>(
    `${API_V1_PREFIX}/profit-centers/:id`,
    {
      schema: {
        description: 'Update a profit center',
        tags: ['profit-centers'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: updateSchema,
        response: { 200: { description: 'Updated profit center', ...responseSchema } },
      },
      preHandler: [requireAuth, requirePermission(CO_PROFIT_CENTER_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { nameTh, nameEn, parentId, isActive } = request.body;

      const check = await fastify.sql<[{ id: string }?]>`SELECT id FROM profit_centers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!check[0]) throw new NotFoundError({ detail: `Profit center ${id} not found.` });

      const rows = await fastify.sql<[PcRow]>`
        UPDATE profit_centers SET
          name_th = COALESCE(${nameTh ?? null}, name_th),
          name_en = COALESCE(${nameEn ?? null}, name_en),
          parent_id = COALESCE(${parentId ?? null}, parent_id),
          is_active = COALESCE(${isActive ?? null}, is_active),
          updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      return reply.status(200).send(mapPc(rows[0]));
    },
  );

  // GET /:id/report — P&L by profit center
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/profit-centers/:id/report`,
    {
      schema: {
        description: 'P&L report for a specific profit center',
        tags: ['profit-centers'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              profitCenter: responseSchema,
              totalRevenueSatang: { type: 'string' },
              totalExpenseSatang: { type: 'string' },
              netIncomeSatang: { type: 'string' },
              lines: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(CO_PROFIT_CENTER_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const pcRows = await fastify.sql<[PcRow?]>`SELECT * FROM profit_centers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!pcRows[0]) throw new NotFoundError({ detail: `Profit center ${id} not found.` });

      interface LineRow {
        account_id: string;
        account_type: string;
        total_debit_satang: bigint;
        total_credit_satang: bigint;
        line_count: string;
      }

      const lines = await fastify.sql<LineRow[]>`
        SELECT jel.account_id,
          coa.account_type,
          SUM(jel.debit_satang) as total_debit_satang,
          SUM(jel.credit_satang) as total_credit_satang,
          COUNT(*)::text as line_count
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.entry_id
        JOIN chart_of_accounts coa ON coa.id = jel.account_id
        WHERE jel.profit_center_id = ${id}
          AND je.tenant_id = ${tenantId}
          AND je.status = 'posted'
        GROUP BY jel.account_id, coa.account_type
        ORDER BY coa.account_type, jel.account_id
      `;

      let totalRevenue = 0n;
      let totalExpense = 0n;

      const mappedLines = lines.map((l) => {
        // Revenue: credit side drives income
        if (l.account_type === 'revenue') {
          totalRevenue += l.total_credit_satang - l.total_debit_satang;
        }
        // Expense: debit side drives cost
        if (l.account_type === 'expense') {
          totalExpense += l.total_debit_satang - l.total_credit_satang;
        }
        return {
          accountId: l.account_id,
          accountType: l.account_type,
          totalDebitSatang: l.total_debit_satang.toString(),
          totalCreditSatang: l.total_credit_satang.toString(),
          lineCount: l.line_count,
        };
      });

      const netIncome = totalRevenue - totalExpense;

      return reply.status(200).send({
        profitCenter: mapPc(pcRows[0]),
        totalRevenueSatang: totalRevenue.toString(),
        totalExpenseSatang: totalExpense.toString(),
        netIncomeSatang: netIncome.toString(),
        lines: mappedLines,
      });
    },
  );
}
