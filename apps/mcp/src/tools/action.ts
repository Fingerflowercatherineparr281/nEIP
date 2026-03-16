import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiCall } from '../api.js';

export function registerActionTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // Tool: post_invoice
  // ---------------------------------------------------------------------------

  server.tool(
    'post_invoice',
    'Post ใบแจ้งหนี้ (draft → posted) — Post an invoice, creating journal entries',
    {
      invoiceId: z.string().describe('Invoice ID to post'),
    },
    async ({ invoiceId }) => {
      try {
        const data = await apiCall<Record<string, unknown>>('POST', `/invoices/${invoiceId}/post`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: void_invoice
  // ---------------------------------------------------------------------------

  server.tool(
    'void_invoice',
    'ยกเลิกใบแจ้งหนี้ — Void an invoice, preventing further payment',
    {
      invoiceId: z.string().describe('Invoice ID to void'),
    },
    async ({ invoiceId }) => {
      try {
        const data = await apiCall<Record<string, unknown>>('POST', `/invoices/${invoiceId}/void`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: post_bill
  // ---------------------------------------------------------------------------

  server.tool(
    'post_bill',
    'Post บิล (draft → posted) — Post a bill, creating journal entries',
    {
      billId: z.string().describe('Bill ID to post'),
    },
    async ({ billId }) => {
      try {
        const data = await apiCall<Record<string, unknown>>('POST', `/bills/${billId}/post`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: close_fiscal_period
  // ---------------------------------------------------------------------------

  server.tool(
    'close_fiscal_period',
    'ปิดงวดบัญชี — Close a fiscal period to prevent further postings',
    {
      periodId: z.string().describe('Fiscal period ID to close'),
    },
    async ({ periodId }) => {
      try {
        const data = await apiCall<Record<string, unknown>>('POST', `/fiscal-periods/${periodId}/close`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Tool: month_end_close
  // ---------------------------------------------------------------------------

  server.tool(
    'month_end_close',
    'ปิดงวดสิ้นเดือน (month-end close) — Run month-end closing procedures',
    {
      fiscalYear: z.number().describe('Fiscal year (e.g. 2026)'),
      fiscalPeriod: z.number().describe('Fiscal period number (1-12)'),
    },
    async ({ fiscalYear, fiscalPeriod }) => {
      try {
        const data = await apiCall<Record<string, unknown>>('POST', '/month-end/close', {
          fiscalYear, fiscalPeriod,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    },
  );
}
