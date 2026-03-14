/**
 * Bill routes:
 *   POST /api/v1/bills          — create bill
 *   GET  /api/v1/bills          — list bills
 *   GET  /api/v1/bills/:id      — get bill detail
 *   PUT  /api/v1/bills/:id      — update bill
 *   POST /api/v1/bills/:id/post — post bill
 *   POST /api/v1/bills/:id/void — void bill
 *
 * Story 10.1 — AP Bill/Expense Domain Logic + API
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import {
  AP_BILL_CREATE,
  AP_BILL_READ,
  AP_BILL_UPDATE,
  AP_BILL_APPROVE,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const billLineSchema = {
  type: 'object',
  required: ['description', 'amountSatang', 'accountId'],
  additionalProperties: false,
  properties: {
    description: { type: 'string', minLength: 1, maxLength: 500 },
    amountSatang: { type: 'string', description: 'Amount in satang' },
    accountId: { type: 'string', description: 'Expense/asset account ID' },
  },
} as const;

const createBillBodySchema = {
  type: 'object',
  required: ['vendorId', 'dueDate', 'lines'],
  additionalProperties: false,
  properties: {
    vendorId: { type: 'string', description: 'Vendor ID' },
    dueDate: { type: 'string', format: 'date', description: 'Payment due date (YYYY-MM-DD)' },
    notes: { type: 'string', maxLength: 2000 },
    lines: {
      type: 'array',
      minItems: 1,
      items: billLineSchema,
    },
  },
} as const;

const updateBillBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    vendorId: { type: 'string' },
    dueDate: { type: 'string', format: 'date' },
    notes: { type: 'string', maxLength: 2000 },
    lines: { type: 'array', minItems: 1, items: billLineSchema },
  },
} as const;

const billResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    documentNumber: { type: 'string' },
    vendorId: { type: 'string' },
    status: { type: 'string', enum: ['draft', 'posted', 'voided', 'paid', 'partial'] },
    totalSatang: { type: 'string' },
    paidSatang: { type: 'string' },
    dueDate: { type: 'string', format: 'date' },
    notes: { type: 'string', nullable: true },
    lines: { type: 'array', items: { type: 'object' } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    status: { type: 'string', enum: ['draft', 'posted', 'voided', 'paid', 'partial'] },
    vendorId: { type: 'string' },
    sortBy: { type: 'string', enum: ['createdAt', 'dueDate', 'totalSatang'], default: 'createdAt' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateBillBody {
  vendorId: string;
  dueDate: string;
  notes?: string;
  lines: Array<{
    description: string;
    amountSatang: string;
    accountId: string;
  }>;
}

interface UpdateBillBody {
  vendorId?: string;
  dueDate?: string;
  notes?: string;
  lines?: Array<{
    description: string;
    amountSatang: string;
    accountId: string;
  }>;
}

interface BillListQuery {
  limit?: number;
  offset?: number;
  status?: string;
  vendorId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface IdParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function billRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /api/v1/bills — create bill
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateBillBody }>(
    `${API_V1_PREFIX}/bills`,
    {
      schema: {
        description: 'Create a new bill (accounts payable)',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        body: createBillBodySchema,
        response: { 201: { description: 'Bill created', ...billResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_BILL_CREATE)],
    },
    async (request, reply) => {
      const { vendorId, dueDate, notes, lines } = request.body;
      const { tenantId, sub: userId } = request.user;

      // Calculate total
      let totalSatang = 0n;
      const processedLines = lines.map((line, index) => {
        const lineAmount = BigInt(line.amountSatang);
        totalSatang += lineAmount;
        return {
          id: crypto.randomUUID(),
          lineNumber: index + 1,
          description: line.description,
          amountSatang: line.amountSatang,
          accountId: line.accountId,
        };
      });

      const billId = crypto.randomUUID();
      const documentNumber = `BILL-${Date.now()}`;

      // TODO: Use bill service tool when wired up.
      // For now, return a stub response that matches the expected shape.
      request.log.info(
        { billId, documentNumber, vendorId, tenantId, userId },
        'Bill created (stub)',
      );

      return reply.status(201).send({
        id: billId,
        documentNumber,
        vendorId,
        status: 'draft',
        totalSatang: totalSatang.toString(),
        paidSatang: '0',
        dueDate,
        notes: notes ?? null,
        lines: processedLines,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/bills — list bills
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: BillListQuery }>(
    `${API_V1_PREFIX}/bills`,
    {
      schema: {
        description: 'List bills with pagination and filtering',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of bills',
            type: 'object',
            properties: {
              items: { type: 'array', items: billResponseSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(AP_BILL_READ)],
    },
    async (request, reply) => {
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      // TODO: Query bills table when wired up.
      request.log.debug({ tenantId: request.user.tenantId }, 'Listing bills (stub)');

      return reply.status(200).send({
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/bills/:id — get bill detail
  // -------------------------------------------------------------------------
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bills/:id`,
    {
      schema: {
        description: 'Get bill details by ID',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Bill details', ...billResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_BILL_READ)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      request.log.debug({ billId: id, tenantId }, 'Get bill detail (stub)');

      throw new NotFoundError({
        detail: `Bill ${id} not found. (AP bill table not yet available)`,
      });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /api/v1/bills/:id — update bill
  // -------------------------------------------------------------------------
  fastify.put<{ Params: IdParams; Body: UpdateBillBody }>(
    `${API_V1_PREFIX}/bills/:id`,
    {
      schema: {
        description: 'Update a draft bill',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: updateBillBodySchema,
        response: { 200: { description: 'Bill updated', ...billResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_BILL_UPDATE)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      request.log.debug({ billId: id, tenantId }, 'Update bill (stub)');

      throw new NotFoundError({
        detail: `Bill ${id} not found. (AP bill table not yet available)`,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/bills/:id/post — post bill
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bills/:id/post`,
    {
      schema: {
        description: 'Post a draft bill',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Bill posted', ...billResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_BILL_APPROVE)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      request.log.debug({ billId: id, tenantId }, 'Post bill (stub)');

      throw new NotFoundError({
        detail: `Bill ${id} not found. (AP bill table not yet available)`,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/bills/:id/void — void bill
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bills/:id/void`,
    {
      schema: {
        description: 'Void a bill (cannot be undone)',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Bill voided', ...billResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_BILL_APPROVE)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      request.log.debug({ billId: id, tenantId }, 'Void bill (stub)');

      throw new NotFoundError({
        detail: `Bill ${id} not found. (AP bill table not yet available)`,
      });
    },
  );
}
