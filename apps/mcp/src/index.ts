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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', '/dashboard/executive');
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/accounts?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      let path = `/invoices?limit=${limit}`;
      if (status) path += `&status=${status}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/bills?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      let path = `/contacts?limit=${limit}`;
      if (type) path += `&type=${type}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/products?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/employees?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: report_trial_balance
// ---------------------------------------------------------------------------

server.tool(
  'report_trial_balance',
  'งบทดลอง — Trial balance report',
  {
    fiscalYear: z.number().optional().describe('Fiscal year e.g. 2026'),
  },
  async ({ fiscalYear }) => {
    try {
      const qs = fiscalYear ? `?fiscalYear=${fiscalYear}` : '';
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/trial-balance${qs}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/pnl-comparison?mode=${mode}&fiscalYear=${fiscalYear}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/audit-logs?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/invoices', { customerId, dueDate, lines });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/journal-entries', { description, fiscalYear, fiscalPeriod, lines });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_journal_entries
// ---------------------------------------------------------------------------

server.tool(
  'list_journal_entries',
  'ดูรายการบัญชี — List journal entries',
  {
    status: z.string().optional().describe('Filter by status: draft, posted, voided'),
    limit: z.number().optional().default(20).describe('Max items'),
    offset: z.number().optional().default(0).describe('Offset for pagination'),
  },
  async ({ status, limit, offset }) => {
    try {
      let path = `/journal-entries?limit=${limit}&offset=${offset}`;
      if (status) path += `&status=${status}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_payments
// ---------------------------------------------------------------------------

server.tool(
  'list_payments',
  'ดูรายการรับชำระเงิน (AR) — List AR payments',
  {
    customerId: z.string().optional().describe('Filter by customer ID'),
    status: z.string().optional().describe('Filter by status'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ customerId, status, limit }) => {
    try {
      let path = `/payments?limit=${limit}`;
      if (customerId) path += `&customerId=${customerId}`;
      if (status) path += `&status=${status}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_quotations
// ---------------------------------------------------------------------------

server.tool(
  'list_quotations',
  'ดูรายการใบเสนอราคา — List quotations',
  {
    status: z.string().optional().describe('Filter by status: draft, sent, approved, rejected, converted, expired'),
    customerId: z.string().optional().describe('Filter by customer ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, customerId, limit }) => {
    try {
      let path = `/quotations?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (customerId) path += `&customerId=${customerId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_sales_orders
// ---------------------------------------------------------------------------

server.tool(
  'list_sales_orders',
  'ดูรายการใบสั่งขาย — List sales orders (ใบสั่งขาย)',
  {
    status: z.string().optional().describe('Filter by status: draft, confirmed, delivered, cancelled'),
    customerId: z.string().optional().describe('Filter by customer ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, customerId, limit }) => {
    try {
      let path = `/sales-orders?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (customerId) path += `&customerId=${customerId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_delivery_notes
// ---------------------------------------------------------------------------

server.tool(
  'list_delivery_notes',
  'ดูรายการใบส่งของ — List delivery notes (ใบส่งของ)',
  {
    status: z.string().optional().describe('Filter by status'),
    salesOrderId: z.string().optional().describe('Filter by sales order ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, salesOrderId, limit }) => {
    try {
      let path = `/delivery-notes?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (salesOrderId) path += `&salesOrderId=${salesOrderId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_receipts
// ---------------------------------------------------------------------------

server.tool(
  'list_receipts',
  'ดูรายการใบเสร็จรับเงิน — List receipts (ใบเสร็จรับเงิน)',
  {
    status: z.string().optional().describe('Filter by status: issued, voided'),
    customerId: z.string().optional().describe('Filter by customer ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, customerId, limit }) => {
    try {
      let path = `/receipts?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (customerId) path += `&customerId=${customerId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_credit_notes
// ---------------------------------------------------------------------------

server.tool(
  'list_credit_notes',
  'ดูรายการใบลดหนี้ — List credit notes (ใบลดหนี้)',
  {
    status: z.string().optional().describe('Filter by status: draft, issued, voided'),
    customerId: z.string().optional().describe('Filter by customer ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, customerId, limit }) => {
    try {
      let path = `/credit-notes?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (customerId) path += `&customerId=${customerId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_purchase_orders
// ---------------------------------------------------------------------------

server.tool(
  'list_purchase_orders',
  'ดูรายการใบสั่งซื้อ — List purchase orders (ใบสั่งซื้อ)',
  {
    status: z.string().optional().describe('Filter by status: draft, sent, received, cancelled'),
    vendorId: z.string().optional().describe('Filter by vendor ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, vendorId, limit }) => {
    try {
      let path = `/purchase-orders?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (vendorId) path += `&vendorId=${vendorId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_vendors
// ---------------------------------------------------------------------------

server.tool(
  'list_vendors',
  'ดูรายการผู้ขาย — List vendors',
  {
    search: z.string().optional().describe('Search by name or tax ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ search, limit }) => {
    try {
      let path = `/vendors?limit=${limit}`;
      if (search) path += `&search=${encodeURIComponent(search)}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_departments
// ---------------------------------------------------------------------------

server.tool(
  'list_departments',
  'ดูรายการแผนก — List departments (HR)',
  {},
  async () => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', '/departments');
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_payroll
// ---------------------------------------------------------------------------

server.tool(
  'list_payroll',
  'ดูรายการเงินเดือน — List payroll runs',
  {
    status: z.string().optional().describe('Filter by status: draft, calculated, approved, paid'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, limit }) => {
    try {
      let path = `/payroll?limit=${limit}`;
      if (status) path += `&status=${status}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_leave_requests
// ---------------------------------------------------------------------------

server.tool(
  'list_leave_requests',
  'ดูรายการคำขอลา — List leave requests',
  {
    status: z.string().optional().describe('Filter by status: pending, approved, rejected'),
    employeeId: z.string().optional().describe('Filter by employee ID'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, employeeId, limit }) => {
    try {
      let path = `/leave-requests?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (employeeId) path += `&employeeId=${employeeId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_fixed_assets
// ---------------------------------------------------------------------------

server.tool(
  'list_fixed_assets',
  'ดูรายการสินทรัพย์ถาวร — List fixed assets (FI-AA)',
  {
    category: z.string().optional().describe('Filter by category: equipment, vehicle, building, land, furniture, it_equipment, other'),
    status: z.string().optional().describe('Filter by status: active, disposed, written_off'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ category, status, limit }) => {
    try {
      let path = `/fixed-assets?limit=${limit}`;
      if (category) path += `&category=${category}`;
      if (status) path += `&status=${status}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_bank_accounts
// ---------------------------------------------------------------------------

server.tool(
  'list_bank_accounts',
  'ดูรายการบัญชีธนาคาร — List bank accounts (FI-BL)',
  {},
  async () => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', '/bank-accounts');
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_wht_certificates
// ---------------------------------------------------------------------------

server.tool(
  'list_wht_certificates',
  'ดูรายการใบหัก ณ ที่จ่าย — List WHT certificates (ภ.ง.ด.3/53)',
  {
    status: z.string().optional().describe('Filter by status: draft, issued, filed, voided'),
    taxYear: z.number().optional().describe('Filter by tax year'),
    taxMonth: z.number().optional().describe('Filter by tax month (1-12)'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ status, taxYear, taxMonth, limit }) => {
    try {
      let path = `/wht-certificates?limit=${limit}`;
      if (status) path += `&status=${status}`;
      if (taxYear) path += `&taxYear=${taxYear}`;
      if (taxMonth) path += `&taxMonth=${taxMonth}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_tax_rates
// ---------------------------------------------------------------------------

server.tool(
  'list_tax_rates',
  'ดูรายการอัตราภาษี — List tax rates (VAT, WHT)',
  {
    limit: z.number().optional().default(50).describe('Max items'),
  },
  async ({ limit }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/tax-rates?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_cost_centers
// ---------------------------------------------------------------------------

server.tool(
  'list_cost_centers',
  'ดูรายการศูนย์ต้นทุน — List cost centers (CO-CCA)',
  {},
  async () => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', '/cost-centers');
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_profit_centers
// ---------------------------------------------------------------------------

server.tool(
  'list_profit_centers',
  'ดูรายการศูนย์กำไร — List profit centers (CO-PCA)',
  {},
  async () => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', '/profit-centers');
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_budgets
// ---------------------------------------------------------------------------

server.tool(
  'list_budgets',
  'ดูรายการงบประมาณ — List budgets',
  {
    year: z.number().optional().describe('Filter by fiscal year'),
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ year, limit }) => {
    try {
      let path = `/budgets?limit=${limit}`;
      if (year) path += `&year=${year}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_roles
// ---------------------------------------------------------------------------

server.tool(
  'list_roles',
  'ดูรายการ roles — List roles and permissions',
  {
    limit: z.number().optional().default(50).describe('Max items'),
  },
  async ({ limit }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/roles?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_webhooks
// ---------------------------------------------------------------------------

server.tool(
  'list_webhooks',
  'ดูรายการ webhooks — List webhook subscriptions',
  {
    limit: z.number().optional().default(50).describe('Max items'),
  },
  async ({ limit }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/webhooks?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_fiscal_years
// ---------------------------------------------------------------------------

server.tool(
  'list_fiscal_years',
  'ดูรายการปีบัญชี — List fiscal years',
  {
    limit: z.number().optional().default(20).describe('Max items'),
  },
  async ({ limit }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/fiscal-years?limit=${limit}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: list_stock_levels
// ---------------------------------------------------------------------------

server.tool(
  'list_stock_levels',
  'ดูระดับสต็อกสินค้า — List current stock levels',
  {
    productId: z.string().optional().describe('Filter by product ID'),
  },
  async ({ productId }) => {
    try {
      let path = '/stock-levels';
      if (productId) path += `?productId=${productId}`;
      const data = await apiCall<Record<string, unknown>>('GET', path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: get_organization
// ---------------------------------------------------------------------------

server.tool(
  'get_organization',
  'ดูข้อมูลองค์กร — Get organization settings and details',
  {
    organizationId: z.string().describe('Organization ID (tenantId from JWT)'),
  },
  async ({ organizationId }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('GET', `/organizations/${organizationId}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_quotation
// ---------------------------------------------------------------------------

server.tool(
  'create_quotation',
  'สร้างใบเสนอราคา — Create a new quotation (ใบเสนอราคา)',
  {
    customerId: z.string().describe('Customer ID'),
    customerName: z.string().describe('Customer name'),
    subject: z.string().describe('Quotation subject/title'),
    validUntil: z.string().describe('Validity date (YYYY-MM-DD)'),
    notes: z.string().optional().describe('Optional notes'),
    lines: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceSatang: z.string().describe('Unit price in satang (1 THB = 100 satang)'),
    })).describe('Line items'),
  },
  async ({ customerId, customerName, subject, validUntil, notes, lines }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/quotations', {
        customerId, customerName, subject, validUntil, notes, lines,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_sales_order
// ---------------------------------------------------------------------------

server.tool(
  'create_sales_order',
  'สร้างใบสั่งขาย — Create a new sales order (ใบสั่งขาย)',
  {
    customerId: z.string().describe('Customer ID'),
    customerName: z.string().describe('Customer name'),
    orderDate: z.string().describe('Order date (YYYY-MM-DD)'),
    expectedDeliveryDate: z.string().optional().describe('Expected delivery date (YYYY-MM-DD)'),
    quotationId: z.string().optional().describe('Source quotation ID'),
    notes: z.string().optional().describe('Optional notes'),
    lines: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceSatang: z.string().describe('Unit price in satang'),
    })).describe('Line items'),
  },
  async ({ customerId, customerName, orderDate, expectedDeliveryDate, quotationId, notes, lines }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/sales-orders', {
        customerId, customerName, orderDate, expectedDeliveryDate, quotationId, notes, lines,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_bill
// ---------------------------------------------------------------------------

server.tool(
  'create_bill',
  'สร้างบิลค่าใช้จ่าย (AP) — Create a new bill (Accounts Payable)',
  {
    vendorId: z.string().describe('Vendor ID'),
    billDate: z.string().describe('Bill date (YYYY-MM-DD)'),
    dueDate: z.string().describe('Due date (YYYY-MM-DD)'),
    reference: z.string().optional().describe('Vendor reference or PO number'),
    notes: z.string().optional().describe('Optional notes'),
    lines: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number().describe('Unit price in THB'),
      accountId: z.string().describe('Expense account ID'),
    })).describe('Bill line items'),
  },
  async ({ vendorId, billDate, dueDate, reference, notes, lines }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/bills', {
        vendorId, billDate, dueDate, reference, notes, lines,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_purchase_order
// ---------------------------------------------------------------------------

server.tool(
  'create_purchase_order',
  'สร้างใบสั่งซื้อ — Create a new purchase order (ใบสั่งซื้อ)',
  {
    vendorId: z.string().describe('Vendor ID'),
    orderDate: z.string().describe('Order date (YYYY-MM-DD)'),
    expectedDate: z.string().optional().describe('Expected delivery date (YYYY-MM-DD)'),
    notes: z.string().optional().describe('Optional notes'),
    lines: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPriceSatang: z.string().describe('Unit price in satang'),
    })).describe('Line items'),
  },
  async ({ vendorId, orderDate, expectedDate, notes, lines }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/purchase-orders', {
        vendorId, orderDate, expectedDate, notes, lines,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_contact
// ---------------------------------------------------------------------------

server.tool(
  'create_contact',
  'สร้าง contact ลูกค้า/ผู้ขาย — Create a new contact (customer or vendor)',
  {
    contactType: z.enum(['customer', 'vendor', 'both']).describe('Contact type'),
    companyName: z.string().describe('Company name'),
    email: z.string().optional().describe('Email address'),
    phone: z.string().optional().describe('Phone number'),
    taxId: z.string().optional().describe('Tax ID (13 digits)'),
    province: z.string().optional().describe('Province'),
  },
  async ({ contactType, companyName, email, phone, taxId, province }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/contacts', {
        contactType, companyName, email, phone, taxId, province,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_product
// ---------------------------------------------------------------------------

server.tool(
  'create_product',
  'สร้างสินค้าใหม่ — Create a new product',
  {
    sku: z.string().describe('Product SKU code'),
    nameTh: z.string().describe('Product name in Thai'),
    nameEn: z.string().describe('Product name in English'),
    unit: z.string().optional().default('ชิ้น').describe('Unit of measure'),
    costPriceSatang: z.number().optional().default(0).describe('Cost price in satang'),
    sellingPriceSatang: z.number().optional().default(0).describe('Selling price in satang'),
    minStockLevel: z.number().optional().default(0).describe('Minimum stock level'),
  },
  async ({ sku, nameTh, nameEn, unit, costPriceSatang, sellingPriceSatang, minStockLevel }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/products', {
        sku, nameTh, nameEn, unit, costPriceSatang, sellingPriceSatang, minStockLevel,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: create_employee
// ---------------------------------------------------------------------------

server.tool(
  'create_employee',
  'เพิ่มพนักงานใหม่ — Create a new employee record',
  {
    employeeCode: z.string().describe('Employee code (e.g. EMP-001)'),
    firstNameTh: z.string().describe('First name in Thai'),
    lastNameTh: z.string().describe('Last name in Thai'),
    hireDate: z.string().describe('Hire date (YYYY-MM-DD)'),
    position: z.string().optional().describe('Job position/title'),
    salarySatang: z.number().optional().default(0).describe('Monthly salary in satang'),
    departmentId: z.string().optional().describe('Department ID'),
  },
  async ({ employeeCode, firstNameTh, lastNameTh, hireDate, position, salarySatang, departmentId }) => {
    try {
      const data = await apiCall<Record<string, unknown>>('POST', '/employees', {
        employeeCode, firstNameTh, lastNameTh, hireDate, position, salarySatang, departmentId,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

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

// ---------------------------------------------------------------------------
// Tool: report_income_statement
// ---------------------------------------------------------------------------

server.tool(
  'report_income_statement',
  'งบกำไรขาดทุน — Income statement report',
  {
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  },
  async ({ startDate, endDate }) => {
    try {
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/income-statement${qs}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: report_balance_sheet
// ---------------------------------------------------------------------------

server.tool(
  'report_balance_sheet',
  'งบดุล — Balance sheet report',
  {
    asOf: z.string().optional().describe('As-of date (YYYY-MM-DD), defaults to today'),
  },
  async ({ asOf }) => {
    try {
      const qs = asOf ? `?asOf=${asOf}` : '';
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/balance-sheet${qs}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: report_budget_variance
// ---------------------------------------------------------------------------

server.tool(
  'report_budget_variance',
  'รายงานงบประมาณเทียบจริง — Budget vs actual variance report',
  {
    year: z.number().optional().describe('Fiscal year (e.g. 2026)'),
    period: z.number().optional().describe('Fiscal period (1-12)'),
  },
  async ({ year, period }) => {
    try {
      const params: string[] = [];
      if (year) params.push(`year=${year}`);
      if (period) params.push(`period=${period}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/budget-variance${qs}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: report_ar_aging
// ---------------------------------------------------------------------------

server.tool(
  'report_ar_aging',
  'รายงานอายุลูกหนี้ — Accounts receivable aging report',
  {
    asOf: z.string().optional().describe('As-of date (YYYY-MM-DD), defaults to today'),
  },
  async ({ asOf }) => {
    try {
      const qs = asOf ? `?asOf=${asOf}` : '';
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/ar-aging${qs}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: report_ap_aging
// ---------------------------------------------------------------------------

server.tool(
  'report_ap_aging',
  'รายงานอายุเจ้าหนี้ — Accounts payable aging report',
  {
    asOf: z.string().optional().describe('As-of date (YYYY-MM-DD), defaults to today'),
  },
  async ({ asOf }) => {
    try {
      const qs = asOf ? `?asOf=${asOf}` : '';
      const data = await apiCall<Record<string, unknown>>('GET', `/reports/ap-aging${qs}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true };
    }
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
