/**
 * AP routes barrel — registers all /api/v1/ AP-related routes.
 *
 * Routes:
 *   POST /api/v1/bills              — create bill
 *   GET  /api/v1/bills              — list bills
 *   GET  /api/v1/bills/:id          — get bill detail
 *   PUT  /api/v1/bills/:id          — update bill
 *   POST /api/v1/bills/:id/post     — post bill
 *   POST /api/v1/bills/:id/void     — void bill
 *   POST /api/v1/bill-payments      — record bill payment
 *   GET  /api/v1/bill-payments      — list bill payments
 *   GET  /api/v1/bill-payments/:id  — get payment detail
 *
 * Story 10.1, 10.2 — Accounts Payable
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { billRoutes } from './bills.js';
import { billPaymentRoutes } from './bill-payments.js';

export async function apRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(billRoutes);
  await fastify.register(billPaymentRoutes);
}
