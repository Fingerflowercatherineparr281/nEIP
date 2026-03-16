/**
 * Cost Center routes (CO-CCA):
 *   POST /api/v1/cost-centers         — create
 *   GET  /api/v1/cost-centers         — list
 *   GET  /api/v1/cost-centers/:id     — detail
 *   PUT  /api/v1/cost-centers/:id     — update
 *   GET  /api/v1/cost-centers/:id/report — costs grouped by center
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ConflictError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { toISO } from '../../lib/to-iso.js';
import {
  CO_COST_CENTER_CREATE,
  CO_COST_CENTER_READ,
  CO_COST_CENTER_UPDATE,
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

interface CcRow {
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

function mapCc(r: CcRow) {
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

export async function costCenterRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // POST — create
  fastify.post<{ Body: CreateBody }>(
    `${API_V1_PREFIX}/cost-centers`,
    {
      schema: {
        description: 'Create a cost center',
        tags: ['cost-centers'],
        security: [{ bearerAuth: [] }],
        body: createSchema,
        response: { 201: { description: 'Cost center created', ...responseSchema } },
      },
      preHandler: [requireAuth, requirePermission(CO_COST_CENTER_CREATE)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { code, nameTh, nameEn, parentId = null } = request.body;

      const existing = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM cost_centers WHERE tenant_id = ${tenantId} AND code = ${code} LIMIT 1
      `;
      if (existing[0]) throw new ConflictError({ detail: `Cost center code "${code}" already exists.` });

      const id = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO cost_centers (id, code, name_th, name_en, parent_id, is_active, tenant_id)
        VALUES (${id}, ${code}, ${nameTh}, ${nameEn}, ${parentId}, true, ${tenantId})
      `;

      const rows = await fastify.sql<[CcRow]>`SELECT * FROM cost_centers WHERE id = ${id} LIMIT 1`;
      return reply.status(201).send(mapCc(rows[0]));
    },
  );

  // GET — list
  fastify.get(
    `${API_V1_PREFIX}/cost-centers`,
    {
      schema: {
        description: 'List cost centers',
        tags: ['cost-centers'],
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
      preHandler: [requireAuth, requirePermission(CO_COST_CENTER_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const includeInactive = (request.query as { includeInactive?: boolean }).includeInactive ?? false;

      const rows = includeInactive
        ? await fastify.sql<CcRow[]>`SELECT * FROM cost_centers WHERE tenant_id = ${tenantId} ORDER BY code`
        : await fastify.sql<CcRow[]>`SELECT * FROM cost_centers WHERE tenant_id = ${tenantId} AND is_active = true ORDER BY code`;

      return reply.status(200).send({ items: rows.map(mapCc), total: rows.length });
    },
  );

  // GET /:id — detail
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/cost-centers/:id`,
    {
      schema: {
        description: 'Get cost center detail',
        tags: ['cost-centers'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: { 200: { description: 'Cost center', ...responseSchema } },
      },
      preHandler: [requireAuth, requirePermission(CO_COST_CENTER_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const rows = await fastify.sql<[CcRow?]>`SELECT * FROM cost_centers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!rows[0]) throw new NotFoundError({ detail: `Cost center ${id} not found.` });
      return reply.status(200).send(mapCc(rows[0]));
    },
  );

  // PUT /:id — update
  fastify.put<{ Params: IdParams; Body: UpdateBody }>(
    `${API_V1_PREFIX}/cost-centers/:id`,
    {
      schema: {
        description: 'Update a cost center',
        tags: ['cost-centers'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: updateSchema,
        response: { 200: { description: 'Updated cost center', ...responseSchema } },
      },
      preHandler: [requireAuth, requirePermission(CO_COST_CENTER_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { nameTh, nameEn, parentId, isActive } = request.body;

      const check = await fastify.sql<[{ id: string }?]>`SELECT id FROM cost_centers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!check[0]) throw new NotFoundError({ detail: `Cost center ${id} not found.` });

      const rows = await fastify.sql<[CcRow]>`
        UPDATE cost_centers SET
          name_th = COALESCE(${nameTh ?? null}, name_th),
          name_en = COALESCE(${nameEn ?? null}, name_en),
          parent_id = COALESCE(${parentId ?? null}, parent_id),
          is_active = COALESCE(${isActive ?? null}, is_active),
          updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      return reply.status(200).send(mapCc(rows[0]));
    },
  );

  // GET /:id/report — cost report by center
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/cost-centers/:id/report`,
    {
      schema: {
        description: 'Cost report for a specific cost center',
        tags: ['cost-centers'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              costCenter: responseSchema,
              totalDebitSatang: { type: 'string' },
              lines: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(CO_COST_CENTER_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const ccRows = await fastify.sql<[CcRow?]>`SELECT * FROM cost_centers WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!ccRows[0]) throw new NotFoundError({ detail: `Cost center ${id} not found.` });

      interface LineRow {
        account_id: string;
        total_debit_satang: bigint;
        total_credit_satang: bigint;
        line_count: string;
      }

      const lines = await fastify.sql<LineRow[]>`
        SELECT jel.account_id,
          SUM(jel.debit_satang) as total_debit_satang,
          SUM(jel.credit_satang) as total_credit_satang,
          COUNT(*)::text as line_count
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.entry_id
        WHERE jel.cost_center_id = ${id}
          AND je.tenant_id = ${tenantId}
          AND je.status = 'posted'
        GROUP BY jel.account_id
        ORDER BY jel.account_id
      `;

      let totalDebit = 0n;
      const mappedLines = lines.map((l) => {
        totalDebit += l.total_debit_satang;
        return {
          accountId: l.account_id,
          totalDebitSatang: l.total_debit_satang.toString(),
          totalCreditSatang: l.total_credit_satang.toString(),
          lineCount: l.line_count,
        };
      });

      return reply.status(200).send({
        costCenter: mapCc(ccRows[0]),
        totalDebitSatang: totalDebit.toString(),
        lines: mappedLines,
      });
    },
  );
}
