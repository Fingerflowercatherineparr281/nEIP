/**
 * Bill Payment routes:
 *   POST /api/v1/bill-payments         — record bill payment
 *   GET  /api/v1/bill-payments         — list bill payments
 *   GET  /api/v1/bill-payments/:id     — get payment detail
 *
 * Story 10.2 — Bill Payment Recording + Matching
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import {
  AP_PAYMENT_CREATE,
  AP_PAYMENT_READ,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const createBillPaymentBodySchema = {
  type: 'object',
  required: ['billId', 'amountSatang', 'paymentDate', 'paymentMethod', 'apAccountId', 'cashAccountId'],
  additionalProperties: false,
  properties: {
    billId: { type: 'string', description: 'Bill ID to pay' },
    amountSatang: { type: 'string', description: 'Payment amount in satang' },
    paymentDate: { type: 'string', format: 'date', description: 'Date of payment (YYYY-MM-DD)' },
    paymentMethod: {
      type: 'string',
      enum: ['cash', 'bank_transfer', 'cheque', 'promptpay'],
      description: 'Payment method',
    },
    apAccountId: { type: 'string', description: 'AP account to debit' },
    cashAccountId: { type: 'string', description: 'Cash/Bank account to credit' },
    reference: { type: 'string', maxLength: 255, description: 'External reference number' },
    notes: { type: 'string', maxLength: 2000 },
  },
} as const;

const billPaymentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    documentNumber: { type: 'string' },
    billId: { type: 'string' },
    amountSatang: { type: 'string' },
    paymentDate: { type: 'string', format: 'date' },
    paymentMethod: { type: 'string' },
    reference: { type: 'string', nullable: true },
    notes: { type: 'string', nullable: true },
    journalEntryId: { type: 'string', nullable: true },
    billStatus: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    billId: { type: 'string' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateBillPaymentBody {
  billId: string;
  amountSatang: string;
  paymentDate: string;
  paymentMethod: string;
  apAccountId: string;
  cashAccountId: string;
  reference?: string;
  notes?: string;
}

interface BillPaymentListQuery {
  limit?: number;
  offset?: number;
  billId?: string;
  sortOrder?: string;
}

interface IdParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function billPaymentRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /api/v1/bill-payments — record bill payment
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateBillPaymentBody }>(
    `${API_V1_PREFIX}/bill-payments`,
    {
      schema: {
        description: 'Record a payment against a bill',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        body: createBillPaymentBodySchema,
        response: { 201: { description: 'Bill payment recorded', ...billPaymentResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_PAYMENT_CREATE)],
    },
    async (request, reply) => {
      const {
        billId, amountSatang, paymentDate, paymentMethod, reference, notes,
      } = request.body;
      const { tenantId, sub: userId } = request.user;

      const paymentId = crypto.randomUUID();
      const documentNumber = `PMT-${Date.now()}`;

      // TODO: Use bill payment service tool when wired up.
      request.log.info(
        { paymentId, documentNumber, billId, tenantId, userId },
        'Bill payment recorded (stub)',
      );

      return reply.status(201).send({
        id: paymentId,
        documentNumber,
        billId,
        amountSatang,
        paymentDate,
        paymentMethod,
        reference: reference ?? null,
        notes: notes ?? null,
        journalEntryId: null,
        billStatus: 'partial',
        createdAt: new Date().toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/bill-payments — list bill payments
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: BillPaymentListQuery }>(
    `${API_V1_PREFIX}/bill-payments`,
    {
      schema: {
        description: 'List bill payments with pagination',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: {
          200: {
            description: 'Paginated list of bill payments',
            type: 'object',
            properties: {
              items: { type: 'array', items: billPaymentResponseSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(AP_PAYMENT_READ)],
    },
    async (request, reply) => {
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      request.log.debug({ tenantId: request.user.tenantId }, 'Listing bill payments (stub)');

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
  // GET /api/v1/bill-payments/:id — get payment detail
  // -------------------------------------------------------------------------
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bill-payments/:id`,
    {
      schema: {
        description: 'Get bill payment details by ID',
        tags: ['ap'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: { 200: { description: 'Bill payment details', ...billPaymentResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(AP_PAYMENT_READ)],
    },
    async (request, _reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      request.log.debug({ paymentId: id, tenantId }, 'Get bill payment detail (stub)');

      throw new NotFoundError({
        detail: `Bill payment ${id} not found. (AP bill_payments table not yet available)`,
      });
    },
  );
}
