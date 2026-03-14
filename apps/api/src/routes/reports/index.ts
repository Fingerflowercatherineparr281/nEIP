/**
 * Report routes barrel — registers all /api/v1/reports/* routes.
 *
 * Routes:
 *   GET /api/v1/reports/balance-sheet      — Balance Sheet
 *   GET /api/v1/reports/income-statement   — Income Statement
 *   GET /api/v1/reports/trial-balance      — Trial Balance
 *   GET /api/v1/reports/budget-variance    — Budget vs Actual
 *   GET /api/v1/reports/equity-changes     — Equity Changes
 *   GET /api/v1/reports/ar-aging           — AR Aging Report
 *   GET /api/v1/reports/ap-aging           — AP Aging Report
 *
 * Story 4.6 — Report Generation API
 *
 * All monetary values use Money VO format (amount in satang as string,
 * currency code). Report generation target: < 30s.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { reportRoutes as reportHandlers } from './reports.js';

export async function reportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(reportHandlers);
}
