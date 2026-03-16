/**
 * CRM Contact routes.
 *
 * Routes:
 *   POST   /api/v1/contacts                    — create contact
 *   GET    /api/v1/contacts                    — list (filter by type, search)
 *   GET    /api/v1/contacts/:id                — detail with transaction summary
 *   PUT    /api/v1/contacts/:id                — update
 *   DELETE /api/v1/contacts/:id                — soft delete
 *   GET    /api/v1/contacts/:id/transactions   — related invoices/bills
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ValidationError, ConflictError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { toISO } from '../../lib/to-iso.js';

/**
 * Sanitize a string to prevent XSS by stripping HTML/script tags.
 * This is a server-side defense-in-depth measure — output encoding on the
 * frontend is the primary XSS defence, but we also sanitize stored data.
 */
function _sanitizeText(value: string): string {
  // Remove HTML tags and common XSS vectors using a simple regex approach.
  // For production, consider using the `sanitize-html` npm package.
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

const CRM_CREATE = 'crm:contact:create' as const;
const CRM_READ   = 'crm:contact:read'   as const;
const CRM_UPDATE = 'crm:contact:update' as const;
const CRM_DELETE = 'crm:contact:delete' as const;

interface ContactRow {
  id: string; contact_type: string; code: string | null; company_name: string;
  contact_person: string | null; email: string | null; phone: string | null;
  tax_id: string | null; branch_number: string | null;
  address_line1: string | null; address_line2: string | null;
  city: string | null; province: string | null; postal_code: string | null;
  country: string; payment_terms_days: number; credit_limit_satang: number | null;
  notes: string | null; is_active: boolean; tenant_id: string;
  created_at: Date | string; updated_at: Date | string;
}

interface CountRow { count: string; }

function mapContact(c: ContactRow) {
  return {
    id: c.id, contactType: c.contact_type, code: c.code,
    companyName: c.company_name, contactPerson: c.contact_person,
    email: c.email, phone: c.phone, taxId: c.tax_id,
    branchNumber: c.branch_number,
    addressLine1: c.address_line1, addressLine2: c.address_line2,
    city: c.city, province: c.province, postalCode: c.postal_code,
    country: c.country, paymentTermsDays: c.payment_terms_days,
    creditLimitSatang: c.credit_limit_satang, notes: c.notes,
    isActive: c.is_active,
    createdAt: toISO(c.created_at), updatedAt: toISO(c.updated_at),
  };
}

export async function contactRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {

  // POST /contacts
  fastify.post<{ Body: Record<string, unknown> }>(
    `${API_V1_PREFIX}/contacts`,
    {
      schema: {
        description: 'สร้างผู้ติดต่อ (ลูกค้า/ผู้จำหน่าย) — Create a new contact (customer or vendor)',
        tags: ['contacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(CRM_CREATE)],
    },
    async (request, reply) => {
      const b = request.body;
      const { tenantId } = request.user;

      if (!b['companyName']) {
        throw new ValidationError({ detail: 'companyName is required.' });
      }

      // COMP-010: Thai tax ID must be exactly 13 digits if provided
      const taxIdInput = b['taxId'] as string | undefined;
      if (taxIdInput !== undefined && taxIdInput !== null && taxIdInput !== '') {
        if (!/^\d{13}$/.test(taxIdInput)) {
          throw new ValidationError({ detail: 'taxId must be exactly 13 digits (Thai Tax ID standard).' });
        }
      }

      // CRM-004: Check duplicate tax ID within tenant
      if (taxIdInput !== undefined && taxIdInput !== null && taxIdInput !== '') {
        const dupRows = await fastify.sql<{ id: string }[]>`
          SELECT id FROM contacts WHERE tax_id = ${taxIdInput} AND tenant_id = ${tenantId} AND is_active = true LIMIT 1
        `;
        if (dupRows[0]) {
          throw new ConflictError({ detail: `Contact with tax ID ${taxIdInput} already exists.` });
        }
      }

      // Sanitize text fields to prevent stored XSS
      const sanitizedCompanyName   = _sanitizeText(b['companyName'] as string);
      const sanitizedContactPerson = b['contactPerson'] ? _sanitizeText(b['contactPerson'] as string) : null;
      const sanitizedNotes         = b['notes'] ? _sanitizeText(b['notes'] as string) : null;

      const id = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO contacts (
          id, contact_type, code, company_name, contact_person, email, phone,
          tax_id, branch_number, address_line1, address_line2, city, province,
          postal_code, country, payment_terms_days, credit_limit_satang, notes, tenant_id
        ) VALUES (
          ${id},
          ${(b['contactType'] as string | undefined) ?? 'customer'},
          ${(b['code'] as string | undefined) ?? null},
          ${sanitizedCompanyName},
          ${sanitizedContactPerson},
          ${(b['email'] as string | undefined) ?? null},
          ${(b['phone'] as string | undefined) ?? null},
          ${(b['taxId'] as string | undefined) ?? null},
          ${(b['branchNumber'] as string | undefined) ?? null},
          ${(b['addressLine1'] as string | undefined) ?? null},
          ${(b['addressLine2'] as string | undefined) ?? null},
          ${(b['city'] as string | undefined) ?? null},
          ${(b['province'] as string | undefined) ?? null},
          ${(b['postalCode'] as string | undefined) ?? null},
          ${(b['country'] as string | undefined) ?? 'TH'},
          ${Number(b['paymentTermsDays'] ?? 30)},
          ${b['creditLimitSatang'] != null ? Number(b['creditLimitSatang']) : null},
          ${sanitizedNotes},
          ${tenantId}
        )
      `;

      const rows = await fastify.sql<ContactRow[]>`
        SELECT * FROM contacts WHERE id = ${id} LIMIT 1
      `;
      return reply.status(201).send(mapContact(rows[0]!));
    },
  );

  // GET /contacts
  fastify.get<{ Querystring: Record<string, string> }>(
    `${API_V1_PREFIX}/contacts`,
    {
      schema: {
        description: 'รายการผู้ติดต่อพร้อมกรองตามประเภทและค้นหา — List contacts with type filter and search',
        tags: ['contacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(CRM_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const limit  = parseInt(request.query['limit'] ?? '50', 10);
      const offset = parseInt(request.query['offset'] ?? '0', 10);
      const type   = request.query['type'];   // customer | vendor | both
      const search = request.query['search'] ?? '';

      let rows: ContactRow[];
      let countRows: CountRow[];

      // Build base conditions
      const typeClause = type ? `AND contact_type = '${type}'` : '';
      const searchClause = search
        ? `AND (company_name ILIKE '%${search.replace(/'/g, "''")}%' OR tax_id ILIKE '%${search.replace(/'/g, "''")}%' OR email ILIKE '%${search.replace(/'/g, "''")}%')`
        : '';

      countRows = await fastify.sql<CountRow[]>`
        SELECT COUNT(*)::text as count FROM contacts
        WHERE tenant_id = ${tenantId} AND is_active = TRUE
          ${fastify.sql.unsafe(typeClause)}
          ${fastify.sql.unsafe(searchClause)}
      `;
      rows = await fastify.sql<ContactRow[]>`
        SELECT * FROM contacts
        WHERE tenant_id = ${tenantId} AND is_active = TRUE
          ${fastify.sql.unsafe(typeClause)}
          ${fastify.sql.unsafe(searchClause)}
        ORDER BY company_name
        LIMIT ${limit} OFFSET ${offset}
      `;

      const total = parseInt(countRows[0]?.count ?? '0', 10);
      return reply.status(200).send({
        items: rows.map(mapContact), total, limit, offset, hasMore: offset + limit < total,
      });
    },
  );

  // GET /contacts/:id
  fastify.get<{ Params: { id: string } }>(
    `${API_V1_PREFIX}/contacts/:id`,
    {
      schema: {
        description: 'ดูรายละเอียดผู้ติดต่อพร้อมสรุปธุรกรรม — Get contact detail with AR/AP transaction summary',
        tags: ['contacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(CRM_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const rows = await fastify.sql<ContactRow[]>`
        SELECT * FROM contacts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!rows[0]) throw new NotFoundError({ detail: `Contact ${id} not found.` });

      // Transaction summary — invoices (AR) and bills (AP) if contact referenced
      const invoiceSummary = await fastify.sql<{ total_invoices: string; total_amount: string }[]>`
        SELECT COUNT(*)::text as total_invoices,
               COALESCE(SUM(total_satang), 0)::text as total_amount
        FROM invoices
        WHERE tenant_id = ${tenantId} AND customer_id = ${id}
      `.catch(() => [{ total_invoices: '0', total_amount: '0' }]);

      const billSummary = await fastify.sql<{ total_bills: string; total_amount: string }[]>`
        SELECT COUNT(*)::text as total_bills,
               COALESCE(SUM(total_satang), 0)::text as total_amount
        FROM bills
        WHERE tenant_id = ${tenantId} AND vendor_id = ${id}
      `.catch(() => [{ total_bills: '0', total_amount: '0' }]);

      return reply.status(200).send({
        ...mapContact(rows[0]),
        summary: {
          totalInvoices: parseInt(invoiceSummary[0]?.total_invoices ?? '0', 10),
          totalInvoicesSatang: invoiceSummary[0]?.total_amount ?? '0',
          totalBills: parseInt(billSummary[0]?.total_bills ?? '0', 10),
          totalBillsSatang: billSummary[0]?.total_amount ?? '0',
        },
      });
    },
  );

  // PUT /contacts/:id
  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    `${API_V1_PREFIX}/contacts/:id`,
    {
      schema: {
        description: 'อัปเดตข้อมูลผู้ติดต่อ — Update contact information',
        tags: ['contacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(CRM_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const b = request.body;
      const { tenantId } = request.user;

      // COMP-010: Thai tax ID must be exactly 13 digits if provided
      const taxIdUpdate = b['taxId'] as string | undefined;
      if (taxIdUpdate !== undefined && taxIdUpdate !== null && taxIdUpdate !== '') {
        if (!/^\d{13}$/.test(taxIdUpdate)) {
          throw new ValidationError({ detail: 'taxId must be exactly 13 digits (Thai Tax ID standard).' });
        }
      }

      const existing = await fastify.sql<ContactRow[]>`
        SELECT * FROM contacts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) throw new NotFoundError({ detail: `Contact ${id} not found.` });

      const rows = await fastify.sql<ContactRow[]>`
        UPDATE contacts SET
          contact_type        = COALESCE(${(b['contactType'] as string | undefined) ?? null}, contact_type),
          code                = COALESCE(${(b['code'] as string | undefined) ?? null}, code),
          company_name        = COALESCE(${(b['companyName'] as string | undefined) ?? null}, company_name),
          contact_person      = COALESCE(${(b['contactPerson'] as string | undefined) ?? null}, contact_person),
          email               = COALESCE(${(b['email'] as string | undefined) ?? null}, email),
          phone               = COALESCE(${(b['phone'] as string | undefined) ?? null}, phone),
          tax_id              = COALESCE(${(b['taxId'] as string | undefined) ?? null}, tax_id),
          branch_number       = COALESCE(${(b['branchNumber'] as string | undefined) ?? null}, branch_number),
          address_line1       = COALESCE(${(b['addressLine1'] as string | undefined) ?? null}, address_line1),
          address_line2       = COALESCE(${(b['addressLine2'] as string | undefined) ?? null}, address_line2),
          city                = COALESCE(${(b['city'] as string | undefined) ?? null}, city),
          province            = COALESCE(${(b['province'] as string | undefined) ?? null}, province),
          postal_code         = COALESCE(${(b['postalCode'] as string | undefined) ?? null}, postal_code),
          country             = COALESCE(${(b['country'] as string | undefined) ?? null}, country),
          payment_terms_days  = COALESCE(${b['paymentTermsDays'] != null ? Number(b['paymentTermsDays']) : null}, payment_terms_days),
          credit_limit_satang = COALESCE(${b['creditLimitSatang'] != null ? Number(b['creditLimitSatang']) : null}, credit_limit_satang),
          notes               = COALESCE(${(b['notes'] as string | undefined) ?? null}, notes),
          updated_at          = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      return reply.status(200).send(mapContact(rows[0]!));
    },
  );

  // DELETE /contacts/:id — soft delete
  fastify.delete<{ Params: { id: string } }>(
    `${API_V1_PREFIX}/contacts/:id`,
    {
      schema: {
        description: 'ลบผู้ติดต่อ (soft delete) — Soft-delete a contact',
        tags: ['contacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(CRM_DELETE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      // CRM-006: Check for linked invoices before deleting
      const invRows = await fastify.sql<{ id: string }[]>`
        SELECT id FROM invoices WHERE customer_id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (invRows[0]) {
        throw new ConflictError({ detail: `Cannot delete contact ${id}: linked invoices exist.` });
      }
      // Also check bills
      const billRows = await fastify.sql<{ id: string }[]>`
        SELECT id FROM bills WHERE vendor_id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (billRows[0]) {
        throw new ConflictError({ detail: `Cannot delete contact ${id}: linked bills exist.` });
      }

      const rows = await fastify.sql<ContactRow[]>`
        UPDATE contacts SET is_active = FALSE, updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      if (!rows[0]) throw new NotFoundError({ detail: `Contact ${id} not found.` });
      return reply.status(200).send({ id, deleted: true });
    },
  );

  // GET /contacts/:id/transactions
  fastify.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    `${API_V1_PREFIX}/contacts/:id/transactions`,
    {
      schema: {
        description: 'ดูใบแจ้งหนี้และบิลที่เกี่ยวข้องกับผู้ติดต่อ — List invoices and bills related to a contact',
        tags: ['contacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(CRM_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const limit  = parseInt(request.query['limit'] ?? '50', 10);
      const offset = parseInt(request.query['offset'] ?? '0', 10);

      const existing = await fastify.sql<ContactRow[]>`
        SELECT * FROM contacts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) throw new NotFoundError({ detail: `Contact ${id} not found.` });

      const invoices = await fastify.sql<{ id: string; document_number: string; status: string; total_satang: string; created_at: Date | string }[]>`
        SELECT id, document_number, status, total_satang::text, created_at
        FROM invoices
        WHERE tenant_id = ${tenantId} AND customer_id = ${id}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `.catch(() => []);

      const bills = await fastify.sql<{ id: string; document_number: string; status: string; total_satang: string; created_at: Date | string }[]>`
        SELECT id, document_number, status, total_satang::text, created_at
        FROM bills
        WHERE tenant_id = ${tenantId} AND vendor_id = ${id}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `.catch(() => []);

      return reply.status(200).send({
        invoices: invoices.map((i) => ({
          type: 'invoice', id: i.id,
          documentNumber: i.document_number,
          status: i.status, totalSatang: i.total_satang,
          date: toISO(i.created_at),
        })),
        bills: bills.map((b_item) => ({
          type: 'bill', id: b_item.id,
          documentNumber: b_item.document_number,
          status: b_item.status, totalSatang: b_item.total_satang,
          date: toISO(b_item.created_at),
        })),
      });
    },
  );
}
