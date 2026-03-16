/**
 * HR Employee & Department routes.
 *
 * Routes:
 *   POST /api/v1/departments        — create department
 *   GET  /api/v1/departments        — list departments
 *   PUT  /api/v1/departments/:id    — update department
 *   POST /api/v1/employees          — create employee
 *   GET  /api/v1/employees          — list (filter by department, status)
 *   GET  /api/v1/employees/:id      — detail
 *   PUT  /api/v1/employees/:id      — update
 *   POST /api/v1/employees/:id/resign — resign
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ValidationError, ConflictError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { toISO } from '../../lib/to-iso.js';

const HR_DEPT_CREATE    = 'hr:department:create'    as const;
const HR_DEPT_READ      = 'hr:department:read'       as const;
const HR_DEPT_UPDATE    = 'hr:department:update'     as const;
const HR_EMP_CREATE     = 'hr:employee:create'       as const;
const HR_EMP_READ       = 'hr:employee:read'         as const;
const HR_EMP_UPDATE     = 'hr:employee:update'       as const;
const HR_EMP_RESIGN     = 'hr:employee:resign'       as const;
const HR_EMP_ANONYMIZE  = 'hr:employee:anonymize'    as const;

interface DepartmentRow {
  id: string; code: string; name_th: string; name_en: string;
  manager_id: string | null; cost_center_id: string | null; tenant_id: string;
  created_at: Date | string; updated_at: Date | string;
}

interface EmployeeRow {
  id: string; employee_code: string; title_th: string | null;
  first_name_th: string; last_name_th: string;
  first_name_en: string | null; last_name_en: string | null;
  nickname: string | null; email: string | null; phone: string | null;
  national_id: string | null; tax_id: string | null;
  social_security_number: string | null; date_of_birth: string | null;
  hire_date: string; position: string | null; department_id: string | null;
  employment_type: string; status: string; salary_satang: number;
  bank_account_number: string | null; bank_name: string | null;
  provident_fund_percent: number; resignation_date: string | null;
  notes: string | null; tenant_id: string; created_by: string | null;
  nationality: string | null;
  created_at: Date | string; updated_at: Date | string;
}

/** Mask Thai national ID: show first digit and first 4, hide middle with X */
function maskNationalId(nid: string | null): string | null {
  if (!nid) return null;
  // Format: X-XXXX-XXXXX-XX-X  (13 digits)
  const d = nid.replace(/\D/g, '');
  if (d.length !== 13) return '1-XXXX-XXXXX-XX-X';
  return `${d[0]}-${d.slice(1, 5)}-XXXXX-XX-X`;
}

interface CountRow { count: string; }

function mapDept(d: DepartmentRow) {
  return {
    id: d.id, code: d.code, nameTh: d.name_th, nameEn: d.name_en,
    managerId: d.manager_id, costCenterId: d.cost_center_id,
    createdAt: toISO(d.created_at), updatedAt: toISO(d.updated_at),
  };
}

/** Full detail response — used by GET /employees/:id */
function mapEmployee(e: EmployeeRow) {
  return {
    id: e.id, employeeCode: e.employee_code, titleTh: e.title_th,
    firstNameTh: e.first_name_th, lastNameTh: e.last_name_th,
    firstNameEn: e.first_name_en, lastNameEn: e.last_name_en,
    nickname: e.nickname, email: e.email, phone: e.phone,
    nationalId: e.national_id, taxId: e.tax_id,
    socialSecurityNumber: e.social_security_number,
    dateOfBirth: e.date_of_birth, hireDate: e.hire_date,
    position: e.position, departmentId: e.department_id,
    employmentType: e.employment_type, status: e.status,
    salarySatang: e.salary_satang,
    bankAccountNumber: e.bank_account_number, bankName: e.bank_name,
    providentFundPercent: e.provident_fund_percent,
    resignationDate: e.resignation_date, notes: e.notes,
    nationality: e.nationality ?? 'TH',
    createdAt: toISO(e.created_at), updatedAt: toISO(e.updated_at),
  };
}

/**
 * PDPA-compliant list response — strips nationalId, salarySatang, and sensitive PII.
 * Used by GET /employees (list) only.
 */
function mapEmployeeList(e: EmployeeRow) {
  return {
    id: e.id, employeeCode: e.employee_code, titleTh: e.title_th,
    firstNameTh: e.first_name_th, lastNameTh: e.last_name_th,
    firstNameEn: e.first_name_en, lastNameEn: e.last_name_en,
    nickname: e.nickname, email: e.email,
    // PDPA: mask national ID in list; omit salarySatang
    nationalId: maskNationalId(e.national_id),
    hireDate: e.hire_date,
    position: e.position, departmentId: e.department_id,
    employmentType: e.employment_type, status: e.status,
    providentFundPercent: e.provident_fund_percent,
    nationality: e.nationality ?? 'TH',
    createdAt: toISO(e.created_at), updatedAt: toISO(e.updated_at),
  };
}

export async function employeeRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {

  // =========================================================================
  // DEPARTMENTS
  // =========================================================================

  fastify.post<{ Body: Record<string, unknown> }>(
    `${API_V1_PREFIX}/departments`,
    {
      schema: {
        description: 'สร้างแผนกใหม่ — Create a new department',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_DEPT_CREATE)],
    },
    async (request, reply) => {
      const b = request.body;
      const { tenantId } = request.user;

      if (!b['code'] || !b['nameTh'] || !b['nameEn']) {
        throw new ValidationError({ detail: 'code, nameTh, nameEn are required.' });
      }

      const id = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO departments (id, code, name_th, name_en, manager_id, cost_center_id, tenant_id)
        VALUES (
          ${id}, ${b['code'] as string}, ${b['nameTh'] as string}, ${b['nameEn'] as string},
          ${(b['managerId'] as string | undefined) ?? null},
          ${(b['costCenterId'] as string | undefined) ?? null},
          ${tenantId}
        )
      `;

      const rows = await fastify.sql<DepartmentRow[]>`
        SELECT * FROM departments WHERE id = ${id} LIMIT 1
      `;
      return reply.status(201).send(mapDept(rows[0]!));
    },
  );

  fastify.get(
    `${API_V1_PREFIX}/departments`,
    {
      schema: {
        description: 'รายการแผนกทั้งหมด — List all departments',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_DEPT_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const rows = await fastify.sql<DepartmentRow[]>`
        SELECT * FROM departments WHERE tenant_id = ${tenantId} ORDER BY name_en
      `;
      return reply.status(200).send({ items: rows.map(mapDept), total: rows.length });
    },
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    `${API_V1_PREFIX}/departments/:id`,
    {
      schema: {
        description: 'อัปเดตข้อมูลแผนก — Update department information',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_DEPT_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const b = request.body;
      const { tenantId } = request.user;

      const existing = await fastify.sql<DepartmentRow[]>`
        SELECT * FROM departments WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) throw new NotFoundError({ detail: `Department ${id} not found.` });

      const rows = await fastify.sql<DepartmentRow[]>`
        UPDATE departments SET
          code            = COALESCE(${(b['code'] as string | undefined) ?? null}, code),
          name_th         = COALESCE(${(b['nameTh'] as string | undefined) ?? null}, name_th),
          name_en         = COALESCE(${(b['nameEn'] as string | undefined) ?? null}, name_en),
          manager_id      = COALESCE(${(b['managerId'] as string | undefined) ?? null}, manager_id),
          cost_center_id  = COALESCE(${(b['costCenterId'] as string | undefined) ?? null}, cost_center_id),
          updated_at      = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      return reply.status(200).send(mapDept(rows[0]!));
    },
  );

  // =========================================================================
  // EMPLOYEES
  // =========================================================================

  fastify.post<{ Body: Record<string, unknown> }>(
    `${API_V1_PREFIX}/employees`,
    {
      schema: {
        description: 'สร้างพนักงานใหม่ — Create a new employee record',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_EMP_CREATE)],
    },
    async (request, reply) => {
      const b = request.body;
      const { tenantId, sub: userId } = request.user;

      if (!b['employeeCode'] || !b['firstNameTh'] || !b['lastNameTh'] || !b['hireDate']) {
        throw new ValidationError({ detail: 'employeeCode, firstNameTh, lastNameTh, hireDate are required.' });
      }

      // HR-004: Validate national ID format (13 digits)
      const nationalId = (b['nationalId'] as string | undefined) ?? null;
      if (nationalId !== null) {
        if (!/^\d{13}$/.test(nationalId)) {
          throw new ValidationError({ detail: 'nationalId must be exactly 13 digits.' });
        }
        // HR-003: Check for duplicate national ID within tenant
        const dupRows = await fastify.sql<{ id: string }[]>`
          SELECT id FROM employees WHERE national_id = ${nationalId} AND tenant_id = ${tenantId} LIMIT 1
        `;
        if (dupRows[0]) {
          throw new ConflictError({ detail: `Employee with national ID ${nationalId} already exists.` });
        }
      }

      const id = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO employees (
          id, employee_code, title_th, first_name_th, last_name_th,
          first_name_en, last_name_en, nickname, email, phone,
          national_id, tax_id, social_security_number, date_of_birth,
          hire_date, position, department_id, employment_type, status,
          salary_satang, bank_account_number, bank_name,
          provident_fund_percent, notes, nationality, tenant_id, created_by
        ) VALUES (
          ${id},
          ${b['employeeCode'] as string},
          ${(b['titleTh'] as string | undefined) ?? null},
          ${b['firstNameTh'] as string},
          ${b['lastNameTh'] as string},
          ${(b['firstNameEn'] as string | undefined) ?? null},
          ${(b['lastNameEn'] as string | undefined) ?? null},
          ${(b['nickname'] as string | undefined) ?? null},
          ${(b['email'] as string | undefined) ?? null},
          ${(b['phone'] as string | undefined) ?? null},
          ${(b['nationalId'] as string | undefined) ?? null},
          ${(b['taxId'] as string | undefined) ?? null},
          ${(b['socialSecurityNumber'] as string | undefined) ?? null},
          ${(b['dateOfBirth'] as string | undefined) ?? null},
          ${b['hireDate'] as string},
          ${(b['position'] as string | undefined) ?? null},
          ${(b['departmentId'] as string | undefined) ?? null},
          ${(b['employmentType'] as string | undefined) ?? 'full_time'},
          'active',
          ${Number(b['salarySatang'] ?? 0)},
          ${(b['bankAccountNumber'] as string | undefined) ?? null},
          ${(b['bankName'] as string | undefined) ?? null},
          ${Number(b['providentFundPercent'] ?? 0)},
          ${(b['notes'] as string | undefined) ?? null},
          ${(b['nationality'] as string | undefined) ?? 'TH'},
          ${tenantId},
          ${userId}
        )
      `;

      const rows = await fastify.sql<EmployeeRow[]>`
        SELECT * FROM employees WHERE id = ${id} LIMIT 1
      `;
      return reply.status(201).send(mapEmployee(rows[0]!));
    },
  );

  fastify.get<{ Querystring: Record<string, string> }>(
    `${API_V1_PREFIX}/employees`,
    {
      schema: {
        description: 'รายการพนักงานพร้อมตัวกรองตามแผนกและสถานะ — List employees with filters by department and status',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_EMP_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const limit  = parseInt(request.query['limit'] ?? '50', 10);
      const offset = parseInt(request.query['offset'] ?? '0', 10);
      const status = request.query['status'];
      const deptId = request.query['departmentId'];
      const search = request.query['search'] ?? '';

      const clauses: string[] = [`e.tenant_id = '${tenantId}'`];
      if (status) clauses.push(`e.status = '${status}'`);
      if (deptId) clauses.push(`e.department_id = '${deptId}'`);
      if (search) {
        const s = search.replace(/'/g, "''");
        clauses.push(`(e.first_name_th ILIKE '%${s}%' OR e.last_name_th ILIKE '%${s}%' OR e.email ILIKE '%${s}%' OR e.employee_code ILIKE '%${s}%')`);
      }
      const where = clauses.join(' AND ');

      const countRows = await fastify.sql<CountRow[]>`
        SELECT COUNT(*)::text as count FROM employees e WHERE ${fastify.sql.unsafe(where)}
      `;
      const rows = await fastify.sql<EmployeeRow[]>`
        SELECT e.* FROM employees e WHERE ${fastify.sql.unsafe(where)}
        ORDER BY e.first_name_th LIMIT ${limit} OFFSET ${offset}
      `;

      const total = parseInt(countRows[0]?.count ?? '0', 10);
      return reply.status(200).send({
        items: rows.map(mapEmployeeList), total, limit, offset, hasMore: offset + limit < total,
      });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    `${API_V1_PREFIX}/employees/:id`,
    {
      schema: {
        description: 'ดูรายละเอียดพนักงาน — Get employee detail',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_EMP_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const rows = await fastify.sql<EmployeeRow[]>`
        SELECT * FROM employees WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!rows[0]) throw new NotFoundError({ detail: `Employee ${id} not found.` });
      return reply.status(200).send(mapEmployee(rows[0]));
    },
  );

  fastify.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    `${API_V1_PREFIX}/employees/:id`,
    {
      schema: {
        description: 'อัปเดตข้อมูลพนักงาน — Update employee information',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_EMP_UPDATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const b = request.body;
      const { tenantId } = request.user;

      const existing = await fastify.sql<EmployeeRow[]>`
        SELECT * FROM employees WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) throw new NotFoundError({ detail: `Employee ${id} not found.` });

      const rows = await fastify.sql<EmployeeRow[]>`
        UPDATE employees SET
          title_th               = COALESCE(${(b['titleTh'] as string | undefined) ?? null}, title_th),
          first_name_th          = COALESCE(${(b['firstNameTh'] as string | undefined) ?? null}, first_name_th),
          last_name_th           = COALESCE(${(b['lastNameTh'] as string | undefined) ?? null}, last_name_th),
          first_name_en          = COALESCE(${(b['firstNameEn'] as string | undefined) ?? null}, first_name_en),
          last_name_en           = COALESCE(${(b['lastNameEn'] as string | undefined) ?? null}, last_name_en),
          nickname               = COALESCE(${(b['nickname'] as string | undefined) ?? null}, nickname),
          email                  = COALESCE(${(b['email'] as string | undefined) ?? null}, email),
          phone                  = COALESCE(${(b['phone'] as string | undefined) ?? null}, phone),
          position               = COALESCE(${(b['position'] as string | undefined) ?? null}, position),
          department_id          = COALESCE(${(b['departmentId'] as string | undefined) ?? null}, department_id),
          employment_type        = COALESCE(${(b['employmentType'] as string | undefined) ?? null}, employment_type),
          salary_satang          = COALESCE(${b['salarySatang'] != null ? Number(b['salarySatang']) : null}, salary_satang),
          bank_account_number    = COALESCE(${(b['bankAccountNumber'] as string | undefined) ?? null}, bank_account_number),
          bank_name              = COALESCE(${(b['bankName'] as string | undefined) ?? null}, bank_name),
          provident_fund_percent = COALESCE(${b['providentFundPercent'] != null ? Number(b['providentFundPercent']) : null}, provident_fund_percent),
          notes                  = COALESCE(${(b['notes'] as string | undefined) ?? null}, notes),
          nationality            = COALESCE(${(b['nationality'] as string | undefined) ?? null}, nationality),
          updated_at             = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      return reply.status(200).send(mapEmployee(rows[0]!));
    },
  );

  // =========================================================================
  // POST /employees/:id/anonymize — PDPA right to erasure (COMP-034)
  // Keeps record for payroll/legal history but scrubs PII
  // =========================================================================
  fastify.post<{ Params: { id: string } }>(
    `${API_V1_PREFIX}/employees/:id/anonymize`,
    {
      schema: {
        description: 'PDPA anonymization — replaces PII with anonymized placeholders while keeping the employment record for legal/payroll history',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_EMP_ANONYMIZE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const existing = await fastify.sql<EmployeeRow[]>`
        SELECT * FROM employees WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) throw new NotFoundError({ detail: `Employee ${id} not found.` });
      if (existing[0].status === 'anonymized') {
        throw new ConflictError({ detail: `Employee ${id} has already been anonymized.` });
      }

      const rows = await fastify.sql<EmployeeRow[]>`
        UPDATE employees SET
          status              = 'anonymized',
          first_name_th       = 'ลบข้อมูล',
          last_name_th        = 'ลบข้อมูล',
          first_name_en       = 'Anonymized',
          last_name_en        = 'Anonymized',
          email               = ${'anonymized-' + id + '@deleted'},
          phone               = NULL,
          national_id         = NULL,
          bank_account_number = NULL,
          date_of_birth       = NULL,
          title_th            = NULL,
          nickname            = NULL,
          notes               = NULL,
          updated_at          = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING *
      `;
      if (!rows[0]) throw new NotFoundError({ detail: `Employee ${id} not found.` });

      request.log.info({ employeeId: id, tenantId }, 'Employee PII anonymized (PDPA)');

      return reply.status(200).send(mapEmployee(rows[0]));
    },
  );

  // POST /employees/:id/resign
  fastify.post<{ Params: { id: string }; Body: { resignationDate?: string; notes?: string } }>(
    `${API_V1_PREFIX}/employees/:id/resign`,
    {
      schema: {
        description: 'บันทึกการลาออกของพนักงาน — Record employee resignation',
        tags: ['hr'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [requireAuth, requirePermission(HR_EMP_RESIGN)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { resignationDate, notes } = request.body ?? {};

      const rows = await fastify.sql<EmployeeRow[]>`
        UPDATE employees SET
          status          = 'resigned',
          resignation_date = COALESCE(${resignationDate ?? null}, resignation_date),
          notes           = COALESCE(${notes ?? null}, notes),
          updated_at      = NOW()
        WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'active'
        RETURNING *
      `;
      if (!rows[0]) {
        const existing = await fastify.sql<{ id: string; status: string }[]>`
          SELECT id, status FROM employees WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
        `;
        if (!existing[0]) throw new NotFoundError({ detail: `Employee ${id} not found.` });
        throw new ValidationError({ detail: `Employee ${id} is already ${existing[0].status}.` });
      }
      return reply.status(200).send(mapEmployee(rows[0]));
    },
  );
}
