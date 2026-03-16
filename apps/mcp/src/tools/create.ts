import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiCall } from '../api.js';

export function registerCreateTools(server: McpServer): void {
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
}
