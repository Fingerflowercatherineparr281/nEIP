#!/usr/bin/env node
/**
 * nEIP MCP Server — Model Context Protocol for AI integration.
 *
 * Exposes nEIP ERP data and operations as MCP tools that AI agents
 * (Claude Desktop, Cursor, etc.) can call directly.
 *
 * Transport: stdio (standard MCP transport)
 * Auth: Uses the same REST API with JWT token
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = process.env['NEIP_API_URL'] ?? 'http://localhost:5400';
let authToken: string | null = process.env['NEIP_TOKEN'] ?? null;

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------

async function apiCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const init: RequestInit = { method, headers };
  if (body) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}/api/v1${path}`, init);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText })) as Record<string, unknown>;
    throw new Error(`API ${res.status}: ${(err['detail'] as string) ?? res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'neip-erp',
  version: '1.0.0',
});

// ---------------------------------------------------------------------------
// Tool: auth_login
// ---------------------------------------------------------------------------

server.tool(
  'auth_login',
  'เข้าสู่ระบบ nEIP — Login and get JWT token',
  {
    email: z.string().describe('Email address'),
    password: z.string().describe('Password'),
  },
  async ({ email, password }) => {
    try {
      const data = await apiCall<{ accessToken: string }>('POST', '/auth/login', { email, password });
      authToken = data.accessToken;
      return { content: [{ type: 'text' as const, text: `Login successful. Token set.` }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Login failed: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: dashboard
// ---------------------------------------------------------------------------

server.tool(
  'dashboard',
  'ดูภาพรวมธุรกิจ — Executive dashboard with KPIs',
  {},
  async () => {
    const data = await apiCall<Record<string, unknown>>('GET', '/dashboard/executive');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_accounts
// ---------------------------------------------------------------------------

server.tool(
  'list_accounts',
  'ดูผังบัญชี — List chart of accounts',
  {
    limit: z.number().optional().default(50).describe('Max items'),
  },
  async ({ limit }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/accounts?limit=${limit}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_invoices
// ---------------------------------------------------------------------------

server.tool(
  'list_invoices',
  'ดูรายการใบแจ้งหนี้ — List invoices',
  {
    status: z.string().optional().describe('Filter by status: draft, posted, paid, voided'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, limit }) => {
    let path = `/invoices?limit=${limit}`;
    if (status) path += `&status=${status}`;
    const data = await apiCall<Record<string, unknown>>('GET', path);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_bills
// ---------------------------------------------------------------------------

server.tool(
  'list_bills',
  'ดูรายการบิล — List bills (AP)',
  {
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ limit }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/bills?limit=${limit}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_contacts
// ---------------------------------------------------------------------------

server.tool(
  'list_contacts',
  'ดูทะเบียนลูกค้า/ผู้ขาย — List contacts (CRM)',
  {
    type: z.enum(['customer', 'vendor', 'both']).optional().describe('Contact type filter'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ type, limit }) => {
    let path = `/contacts?limit=${limit}`;
    if (type) path += `&type=${type}`;
    const data = await apiCall<Record<string, unknown>>('GET', path);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_products
// ---------------------------------------------------------------------------

server.tool(
  'list_products',
  'ดูสินค้า — List products',
  {
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ limit }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/products?limit=${limit}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_employees
// ---------------------------------------------------------------------------

server.tool(
  'list_employees',
  'ดูพนักงาน — List employees',
  {
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ limit }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/employees?limit=${limit}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: report_trial_balance
// ---------------------------------------------------------------------------

server.tool(
  'report_trial_balance',
  'งบทดลอง — Trial balance report',
  {
    fiscalYear: z.number().describe('Fiscal year e.g. 2026'),
  },
  async ({ fiscalYear }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/reports/trial-balance?fiscalYear=${fiscalYear}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: report_pnl
// ---------------------------------------------------------------------------

server.tool(
  'report_pnl',
  'งบกำไรขาดทุน — P&L comparison (monthly/ytd/yoy/mom)',
  {
    mode: z.enum(['monthly', 'ytd', 'yoy', 'mom']).describe('Report mode'),
    fiscalYear: z.number().describe('Fiscal year'),
  },
  async ({ mode, fiscalYear }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/reports/pnl-comparison?mode=${mode}&fiscalYear=${fiscalYear}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: audit_logs
// ---------------------------------------------------------------------------

server.tool(
  'audit_logs',
  'ดูบันทึกการเปลี่ยนแปลง — View audit trail',
  {
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ limit }) => {
    const data = await apiCall<Record<string, unknown>>('GET', `/audit-logs?limit=${limit}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: create_invoice
// ---------------------------------------------------------------------------

server.tool(
  'create_invoice',
  'สร้างใบแจ้งหนี้ — Create a new invoice',
  {
    customerId: z.string().describe('Customer ID'),
    dueDate: z.string().describe('Due date (YYYY-MM-DD)'),
    lines: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceSatang: z.string().describe('Unit price in satang'),
      accountId: z.string(),
    })).describe('Invoice line items'),
  },
  async ({ customerId, dueDate, lines }) => {
    const data = await apiCall<Record<string, unknown>>('POST', '/invoices', { customerId, dueDate, lines });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool: create_journal_entry
// ---------------------------------------------------------------------------

server.tool(
  'create_journal_entry',
  'สร้างรายการบัญชี — Create a journal entry',
  {
    description: z.string().describe('Journal entry description'),
    fiscalYear: z.number().describe('Fiscal year'),
    fiscalPeriod: z.number().describe('Fiscal period (1-12)'),
    lines: z.array(z.object({
      accountId: z.string(),
      description: z.string(),
      debitSatang: z.string().describe('Debit amount in satang (0 if credit)'),
      creditSatang: z.string().describe('Credit amount in satang (0 if debit)'),
    })).describe('Journal entry lines (must balance)'),
  },
  async ({ description, fiscalYear, fiscalPeriod, lines }) => {
    const data = await apiCall<Record<string, unknown>>('POST', '/journal-entries', { description, fiscalYear, fiscalPeriod, lines });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('nEIP MCP Server running on stdio');
}

main().catch((err) => {
  console.error('MCP Server error:', err);
  process.exit(1);
});
