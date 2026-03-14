/**
 * Export routes:
 *   GET /api/v1/export/:type — download data as CSV or Excel
 *
 * Story 8.3 — Export Engine API
 *
 * Supports export types: journal_entries, invoices, payments, accounts.
 * Returns file download with Content-Disposition header.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX, ValidationError } from '@neip/shared';
import { exportToCsv, exportToExcel } from '@neip/core';
import type { ExportColumn } from '@neip/core';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { DATA_EXPORT } from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// Export type configurations
// ---------------------------------------------------------------------------

type ExportType = 'journal_entries' | 'invoices' | 'payments' | 'accounts';

const VALID_EXPORT_TYPES = new Set<string>([
  'journal_entries',
  'invoices',
  'payments',
  'accounts',
]);

/** Column definitions per export type */
const EXPORT_COLUMNS: Record<ExportType, ExportColumn<Record<string, unknown>>[]> = {
  journal_entries: [
    { header: 'Date', key: 'date', format: 'date' },
    { header: 'Entry Number', key: 'entryNumber', format: 'text' },
    { header: 'Account Code', key: 'accountCode', format: 'text' },
    { header: 'Account Name', key: 'accountName', format: 'text' },
    { header: 'Description', key: 'description', format: 'text' },
    { header: 'Debit', key: 'debitAmount', format: 'money', width: 15 },
    { header: 'Credit', key: 'creditAmount', format: 'money', width: 15 },
    { header: 'Status', key: 'status', format: 'text' },
  ],
  invoices: [
    { header: 'Invoice Number', key: 'invoiceNumber', format: 'text' },
    { header: 'Date', key: 'date', format: 'date' },
    { header: 'Due Date', key: 'dueDate', format: 'date' },
    { header: 'Customer', key: 'customerName', format: 'text' },
    { header: 'Description', key: 'description', format: 'text' },
    { header: 'Amount', key: 'totalAmount', format: 'money', width: 15 },
    { header: 'Status', key: 'status', format: 'text' },
  ],
  payments: [
    { header: 'Payment Number', key: 'paymentNumber', format: 'text' },
    { header: 'Date', key: 'date', format: 'date' },
    { header: 'Customer', key: 'customerName', format: 'text' },
    { header: 'Invoice Number', key: 'invoiceNumber', format: 'text' },
    { header: 'Amount', key: 'amount', format: 'money', width: 15 },
    { header: 'Method', key: 'paymentMethod', format: 'text' },
    { header: 'Status', key: 'status', format: 'text' },
  ],
  accounts: [
    { header: 'Code', key: 'code', format: 'text' },
    { header: 'Name', key: 'name', format: 'text' },
    { header: 'Type', key: 'type', format: 'text' },
    { header: 'Parent Code', key: 'parentCode', format: 'text' },
    { header: 'Balance', key: 'balance', format: 'money', width: 15 },
    { header: 'Active', key: 'isActive', format: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function exportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/export/:type — Download data export
  // -------------------------------------------------------------------------

  fastify.get<{
    Params: { type: string };
    Querystring: {
      format?: string;
      buddhistEra?: string;
      fiscalYear?: string;
      status?: string;
    };
  }>(
    `${API_V1_PREFIX}/export/:type`,
    {
      preHandler: [requireAuth, requirePermission(DATA_EXPORT)],
      schema: {
        tags: ['import-export'],
        summary: 'Export data as CSV or Excel',
        description: 'Download data in CSV or Excel format. Supports Thai Buddhist Era dates.',
        params: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['journal_entries', 'invoices', 'payments', 'accounts'],
              description: 'Type of data to export',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['csv', 'xlsx'],
              default: 'csv',
              description: 'Output file format',
            },
            buddhistEra: {
              type: 'string',
              enum: ['true', 'false'],
              default: 'false',
              description: 'Use Buddhist Era dates (+543 years)',
            },
            fiscalYear: { type: 'string', description: 'Filter by fiscal year' },
            status: { type: 'string', description: 'Filter by status' },
          },
        },
      },
    },
    async (request, reply) => {
      const { type } = request.params;

      if (!VALID_EXPORT_TYPES.has(type)) {
        throw new ValidationError({
          detail: `Invalid export type "${type}". Must be one of: ${[...VALID_EXPORT_TYPES].join(', ')}`,
        });
      }

      const exportType = type as ExportType;
      const format = (request.query.format ?? 'csv') === 'xlsx' ? 'xlsx' : 'csv';
      const buddhistEra = request.query.buddhistEra === 'true';

      // Get tenant from JWT
      const user = request.user as { sub: string; tenantId?: string };
      // TODO: use tenantId to filter data queries
      void (user.tenantId ?? user.sub);

      // TODO: Query actual data from the database using tenantId and filters.
      // For now, return an empty export with the correct structure.
      // This will be wired to real DB queries when the list endpoints are available.
      const data: Record<string, unknown>[] = [];

      const columns = EXPORT_COLUMNS[exportType];

      const exportOptions = {
        type: exportType,
        buddhistEra,
        orgName: 'nEIP', // TODO: fetch org name from tenant settings
      };

      if (format === 'xlsx') {
        const result = await exportToExcel(data, columns, exportOptions);

        void reply
          .header('Content-Type', result.mimeType)
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.buffer);
        return;
      }

      const result = exportToCsv(data, columns, exportOptions);

      void reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    },
  );
}
