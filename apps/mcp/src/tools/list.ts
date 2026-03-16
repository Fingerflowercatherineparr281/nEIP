import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiCall } from '../api.js';

export function registerListTools(server: McpServer): void {
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
}
