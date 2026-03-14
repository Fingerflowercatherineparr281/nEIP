/**
 * Report generation routes:
 *   GET /api/v1/reports/balance-sheet      — Balance Sheet
 *   GET /api/v1/reports/income-statement   — Income Statement
 *   GET /api/v1/reports/trial-balance      — Trial Balance
 *   GET /api/v1/reports/budget-variance    — Budget vs Actual
 *   GET /api/v1/reports/equity-changes     — Equity Changes
 *   GET /api/v1/reports/ar-aging           — AR Aging Report
 *
 * Story 4.6 — Report Generation API
 *
 * All monetary values use Money VO format: { amountSatang: string, currency: "THB" }
 * Report generation target: < 30s
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import {
  REPORT_BALANCE_SHEET_READ,
  REPORT_INCOME_STATEMENT_READ,
  REPORT_TRIAL_BALANCE_READ,
  REPORT_GL_READ,
  REPORT_AR_READ,
  REPORT_AP_READ,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// Shared types / schemas
// ---------------------------------------------------------------------------

const moneySchema = {
  type: 'object',
  properties: {
    amountSatang: { type: 'string', description: 'Amount in satang (smallest currency unit)' },
    currency: { type: 'string', default: 'THB' },
  },
} as const;

const fiscalQuerySchema = {
  type: 'object',
  properties: {
    fiscalYear: { type: 'integer', description: 'Fiscal year to report on' },
    period: { type: 'integer', minimum: 1, maximum: 12, description: 'Fiscal period (1-12)' },
    asOfDate: { type: 'string', format: 'date', description: 'Report as-of date' },
  },
} as const;

interface FiscalQuery {
  fiscalYear?: number;
  period?: number;
  asOfDate?: string;
}

interface AccountBalanceRow {
  account_id: string;
  code: string;
  name_en: string;
  name_th: string;
  account_type: string;
  total_debit: string | null;
  total_credit: string | null;
}

interface BudgetRow {
  account_id: string;
  code: string;
  name_en: string;
  account_type: string;
  amount_satang: string;
}

// ---------------------------------------------------------------------------
// Helper: money value object
// ---------------------------------------------------------------------------

function money(amountSatang: bigint | string, currency = 'THB') {
  return {
    amountSatang: amountSatang.toString(),
    currency,
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function reportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/v1/reports/balance-sheet
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/balance-sheet`,
    {
      schema: {
        description: 'Generate Balance Sheet report',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: fiscalQuerySchema,
        response: {
          200: {
            description: 'Balance Sheet report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              fiscalYear: { type: 'integer' },
              period: { type: 'integer', nullable: true },
              assets: { type: 'array', items: { type: 'object' } },
              liabilities: { type: 'array', items: { type: 'object' } },
              equity: { type: 'array', items: { type: 'object' } },
              totalAssets: moneySchema,
              totalLiabilities: moneySchema,
              totalEquity: moneySchema,
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_BALANCE_SHEET_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const fiscalYear = request.query.fiscalYear ?? new Date().getFullYear();
      const period = request.query.period;

      // Query account balances from posted journal entries.
      let balanceRows: AccountBalanceRow[];
      if (period !== undefined) {
        balanceRows = await fastify.sql<AccountBalanceRow[]>`
          SELECT
            coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
            COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
            COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
          FROM chart_of_accounts coa
          LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
          LEFT JOIN journal_entries je ON je.id = jel.entry_id
            AND je.status = 'posted'
            AND je.fiscal_year = ${fiscalYear}
            AND je.fiscal_period <= ${period}
            AND je.tenant_id = ${tenantId}
          WHERE coa.tenant_id = ${tenantId}
            AND coa.account_type IN ('asset', 'liability', 'equity')
          GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
          ORDER BY coa.code
        `;
      } else {
        balanceRows = await fastify.sql<AccountBalanceRow[]>`
          SELECT
            coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
            COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
            COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
          FROM chart_of_accounts coa
          LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
          LEFT JOIN journal_entries je ON je.id = jel.entry_id
            AND je.status = 'posted'
            AND je.fiscal_year = ${fiscalYear}
            AND je.tenant_id = ${tenantId}
          WHERE coa.tenant_id = ${tenantId}
            AND coa.account_type IN ('asset', 'liability', 'equity')
          GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
          ORDER BY coa.code
        `;
      }

      let totalAssets = 0n;
      let totalLiabilities = 0n;
      let totalEquity = 0n;

      const assets: Array<{ code: string; name: string; balance: ReturnType<typeof money> }> = [];
      const liabilities: Array<{ code: string; name: string; balance: ReturnType<typeof money> }> = [];
      const equity: Array<{ code: string; name: string; balance: ReturnType<typeof money> }> = [];

      for (const row of balanceRows) {
        const debit = BigInt(row.total_debit ?? '0');
        const credit = BigInt(row.total_credit ?? '0');
        // Assets have normal debit balance; liabilities/equity have normal credit balance.
        const balance = row.account_type === 'asset' ? debit - credit : credit - debit;

        const item = {
          code: row.code,
          name: row.name_en,
          nameTh: row.name_th,
          balance: money(balance),
        };

        switch (row.account_type) {
          case 'asset':
            assets.push(item);
            totalAssets += balance;
            break;
          case 'liability':
            liabilities.push(item);
            totalLiabilities += balance;
            break;
          case 'equity':
            equity.push(item);
            totalEquity += balance;
            break;
        }
      }

      return reply.status(200).send({
        reportName: 'Balance Sheet',
        generatedAt: new Date().toISOString(),
        fiscalYear,
        period: period ?? null,
        assets,
        liabilities,
        equity,
        totalAssets: money(totalAssets),
        totalLiabilities: money(totalLiabilities),
        totalEquity: money(totalEquity),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/reports/income-statement
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/income-statement`,
    {
      schema: {
        description: 'Generate Income Statement (Profit & Loss) report',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: fiscalQuerySchema,
        response: {
          200: {
            description: 'Income Statement report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              fiscalYear: { type: 'integer' },
              period: { type: 'integer', nullable: true },
              revenue: { type: 'array', items: { type: 'object' } },
              expenses: { type: 'array', items: { type: 'object' } },
              totalRevenue: moneySchema,
              totalExpenses: moneySchema,
              netIncome: moneySchema,
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_INCOME_STATEMENT_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const fiscalYear = request.query.fiscalYear ?? new Date().getFullYear();
      const period = request.query.period;

      let balanceRows: AccountBalanceRow[];
      if (period !== undefined) {
        balanceRows = await fastify.sql<AccountBalanceRow[]>`
          SELECT
            coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
            COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
            COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
          FROM chart_of_accounts coa
          LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
          LEFT JOIN journal_entries je ON je.id = jel.entry_id
            AND je.status = 'posted'
            AND je.fiscal_year = ${fiscalYear}
            AND je.fiscal_period = ${period}
            AND je.tenant_id = ${tenantId}
          WHERE coa.tenant_id = ${tenantId}
            AND coa.account_type IN ('revenue', 'expense')
          GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
          ORDER BY coa.code
        `;
      } else {
        balanceRows = await fastify.sql<AccountBalanceRow[]>`
          SELECT
            coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
            COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
            COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
          FROM chart_of_accounts coa
          LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
          LEFT JOIN journal_entries je ON je.id = jel.entry_id
            AND je.status = 'posted'
            AND je.fiscal_year = ${fiscalYear}
            AND je.tenant_id = ${tenantId}
          WHERE coa.tenant_id = ${tenantId}
            AND coa.account_type IN ('revenue', 'expense')
          GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
          ORDER BY coa.code
        `;
      }

      let totalRevenue = 0n;
      let totalExpenses = 0n;

      const revenue: Array<{ code: string; name: string; amount: ReturnType<typeof money> }> = [];
      const expenses: Array<{ code: string; name: string; amount: ReturnType<typeof money> }> = [];

      for (const row of balanceRows) {
        const debit = BigInt(row.total_debit ?? '0');
        const credit = BigInt(row.total_credit ?? '0');

        if (row.account_type === 'revenue') {
          const amount = credit - debit; // Revenue has normal credit balance
          revenue.push({ code: row.code, name: row.name_en, amount: money(amount) });
          totalRevenue += amount;
        } else {
          const amount = debit - credit; // Expenses have normal debit balance
          expenses.push({ code: row.code, name: row.name_en, amount: money(amount) });
          totalExpenses += amount;
        }
      }

      return reply.status(200).send({
        reportName: 'Income Statement',
        generatedAt: new Date().toISOString(),
        fiscalYear,
        period: period ?? null,
        revenue,
        expenses,
        totalRevenue: money(totalRevenue),
        totalExpenses: money(totalExpenses),
        netIncome: money(totalRevenue - totalExpenses),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/reports/trial-balance
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/trial-balance`,
    {
      schema: {
        description: 'Generate Trial Balance report',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: fiscalQuerySchema,
        response: {
          200: {
            description: 'Trial Balance report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              fiscalYear: { type: 'integer' },
              accounts: { type: 'array', items: { type: 'object' } },
              totalDebits: moneySchema,
              totalCredits: moneySchema,
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_TRIAL_BALANCE_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const fiscalYear = request.query.fiscalYear ?? new Date().getFullYear();

      const balanceRows = await fastify.sql<AccountBalanceRow[]>`
        SELECT
          coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
          COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
          COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
        LEFT JOIN journal_entries je ON je.id = jel.entry_id
          AND je.status = 'posted'
          AND je.fiscal_year = ${fiscalYear}
          AND je.tenant_id = ${tenantId}
        WHERE coa.tenant_id = ${tenantId}
          AND coa.is_active = true
        GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
        ORDER BY coa.code
      `;

      let totalDebits = 0n;
      let totalCredits = 0n;

      const accounts = balanceRows.map((row) => {
        const debit = BigInt(row.total_debit ?? '0');
        const credit = BigInt(row.total_credit ?? '0');
        totalDebits += debit;
        totalCredits += credit;

        return {
          code: row.code,
          name: row.name_en,
          nameTh: row.name_th,
          accountType: row.account_type,
          debit: money(debit),
          credit: money(credit),
        };
      });

      return reply.status(200).send({
        reportName: 'Trial Balance',
        generatedAt: new Date().toISOString(),
        fiscalYear,
        accounts,
        totalDebits: money(totalDebits),
        totalCredits: money(totalCredits),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/reports/budget-variance
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/budget-variance`,
    {
      schema: {
        description: 'Generate Budget vs Actual variance report',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: fiscalQuerySchema,
        response: {
          200: {
            description: 'Budget Variance report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              fiscalYear: { type: 'integer' },
              items: { type: 'array', items: { type: 'object' } },
              totalBudget: moneySchema,
              totalActual: moneySchema,
              totalVariance: moneySchema,
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_GL_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const fiscalYear = request.query.fiscalYear ?? new Date().getFullYear();

      // Get budgets for the fiscal year.
      const budgetRows = await fastify.sql<BudgetRow[]>`
        SELECT b.account_id, coa.code, coa.name_en, coa.account_type, b.amount_satang::text
        FROM budgets b
        JOIN chart_of_accounts coa ON coa.id = b.account_id
        WHERE b.tenant_id = ${tenantId} AND b.fiscal_year = ${fiscalYear}
        ORDER BY coa.code
      `;

      // Get actual amounts from posted journal entries.
      const actualRows = await fastify.sql<AccountBalanceRow[]>`
        SELECT
          coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
          COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
          COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
        FROM chart_of_accounts coa
        JOIN journal_entry_lines jel ON jel.account_id = coa.id
        JOIN journal_entries je ON je.id = jel.entry_id
          AND je.status = 'posted'
          AND je.fiscal_year = ${fiscalYear}
          AND je.tenant_id = ${tenantId}
        WHERE coa.tenant_id = ${tenantId}
        GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
      `;

      // Build a map of actuals by account_id.
      const actualMap = new Map<string, bigint>();
      for (const row of actualRows) {
        const debit = BigInt(row.total_debit ?? '0');
        const credit = BigInt(row.total_credit ?? '0');
        // For expense accounts, actual = debit - credit; for revenue, actual = credit - debit.
        const actual = row.account_type === 'expense' ? debit - credit : credit - debit;
        actualMap.set(row.account_id, actual);
      }

      let totalBudget = 0n;
      let totalActual = 0n;
      let totalVariance = 0n;

      const items = budgetRows.map((bRow) => {
        const budgetAmount = BigInt(bRow.amount_satang);
        const actual = actualMap.get(bRow.account_id) ?? 0n;
        const variance = budgetAmount - actual;

        totalBudget += budgetAmount;
        totalActual += actual;
        totalVariance += variance;

        return {
          code: bRow.code,
          name: bRow.name_en,
          accountType: bRow.account_type,
          budget: money(budgetAmount),
          actual: money(actual),
          variance: money(variance),
          variancePercent: budgetAmount === 0n ? 0 : Number((variance * 10000n) / budgetAmount) / 100,
        };
      });

      return reply.status(200).send({
        reportName: 'Budget Variance',
        generatedAt: new Date().toISOString(),
        fiscalYear,
        items,
        totalBudget: money(totalBudget),
        totalActual: money(totalActual),
        totalVariance: money(totalVariance),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/reports/equity-changes
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/equity-changes`,
    {
      schema: {
        description: 'Generate Statement of Changes in Equity report',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: fiscalQuerySchema,
        response: {
          200: {
            description: 'Equity Changes report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              fiscalYear: { type: 'integer' },
              items: { type: 'array', items: { type: 'object' } },
              openingBalance: moneySchema,
              closingBalance: moneySchema,
              netChange: moneySchema,
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_GL_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const fiscalYear = request.query.fiscalYear ?? new Date().getFullYear();

      // Get equity account balances.
      const equityRows = await fastify.sql<AccountBalanceRow[]>`
        SELECT
          coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
          COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
          COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
        LEFT JOIN journal_entries je ON je.id = jel.entry_id
          AND je.status = 'posted'
          AND je.fiscal_year = ${fiscalYear}
          AND je.tenant_id = ${tenantId}
        WHERE coa.tenant_id = ${tenantId}
          AND coa.account_type = 'equity'
        GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
        ORDER BY coa.code
      `;

      // Get prior year equity balances for opening balance.
      const priorRows = await fastify.sql<AccountBalanceRow[]>`
        SELECT
          coa.id as account_id, coa.code, coa.name_en, coa.name_th, coa.account_type,
          COALESCE(SUM(jel.debit_satang), 0)::text as total_debit,
          COALESCE(SUM(jel.credit_satang), 0)::text as total_credit
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
        LEFT JOIN journal_entries je ON je.id = jel.entry_id
          AND je.status = 'posted'
          AND je.fiscal_year < ${fiscalYear}
          AND je.tenant_id = ${tenantId}
        WHERE coa.tenant_id = ${tenantId}
          AND coa.account_type = 'equity'
        GROUP BY coa.id, coa.code, coa.name_en, coa.name_th, coa.account_type
      `;

      const priorMap = new Map<string, bigint>();
      let openingBalance = 0n;
      for (const row of priorRows) {
        const balance = BigInt(row.total_credit ?? '0') - BigInt(row.total_debit ?? '0');
        priorMap.set(row.account_id, balance);
        openingBalance += balance;
      }

      let closingBalance = 0n;
      const items = equityRows.map((row) => {
        const currentPeriod = BigInt(row.total_credit ?? '0') - BigInt(row.total_debit ?? '0');
        const opening = priorMap.get(row.account_id) ?? 0n;
        const closing = opening + currentPeriod;
        closingBalance += closing;

        return {
          code: row.code,
          name: row.name_en,
          nameTh: row.name_th,
          openingBalance: money(opening),
          changes: money(currentPeriod),
          closingBalance: money(closing),
        };
      });

      return reply.status(200).send({
        reportName: 'Statement of Changes in Equity',
        generatedAt: new Date().toISOString(),
        fiscalYear,
        items,
        openingBalance: money(openingBalance),
        closingBalance: money(closingBalance),
        netChange: money(closingBalance - openingBalance),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/reports/ar-aging
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/ar-aging`,
    {
      schema: {
        description: 'Generate AR Aging report',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            asOfDate: { type: 'string', format: 'date', description: 'Aging as-of date (defaults to today)' },
          },
        },
        response: {
          200: {
            description: 'AR Aging report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              asOfDate: { type: 'string', format: 'date' },
              buckets: {
                type: 'object',
                properties: {
                  current: moneySchema,
                  days1to30: moneySchema,
                  days31to60: moneySchema,
                  days61to90: moneySchema,
                  over90: moneySchema,
                },
              },
              total: moneySchema,
              customers: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_AR_READ)],
    },
    async (request, reply) => {
      const asOfDate = request.query.asOfDate ?? new Date().toISOString().slice(0, 10);

      // TODO: Query invoices table when AR schema is available.
      // For now, return an empty aging report stub.
      // The actual implementation would:
      // 1. Query all unpaid/partial invoices with due_date <= asOfDate
      // 2. Calculate aging buckets based on days past due
      // 3. Group by customer

      return reply.status(200).send({
        reportName: 'AR Aging',
        generatedAt: new Date().toISOString(),
        asOfDate,
        buckets: {
          current: money(0n),
          days1to30: money(0n),
          days31to60: money(0n),
          days61to90: money(0n),
          over90: money(0n),
        },
        total: money(0n),
        customers: [],
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/reports/ap-aging
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: FiscalQuery }>(
    `${API_V1_PREFIX}/reports/ap-aging`,
    {
      schema: {
        description: 'Generate AP Aging report — outstanding bills by aging bucket',
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            asOfDate: { type: 'string', format: 'date', description: 'Aging as-of date (defaults to today)' },
          },
        },
        response: {
          200: {
            description: 'AP Aging report',
            type: 'object',
            properties: {
              reportName: { type: 'string' },
              generatedAt: { type: 'string', format: 'date-time' },
              asOfDate: { type: 'string', format: 'date' },
              buckets: {
                type: 'object',
                properties: {
                  current: moneySchema,
                  days1to30: moneySchema,
                  days31to60: moneySchema,
                  days61to90: moneySchema,
                  over90: moneySchema,
                },
              },
              total: moneySchema,
              vendors: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(REPORT_AP_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const asOfDate = request.query.asOfDate ?? new Date().toISOString().slice(0, 10);
      const asOfDateObj = new Date(asOfDate);

      // Query outstanding bills (posted or partial) for this tenant
      interface BillRow {
        id: string;
        document_number: string;
        vendor_id: string;
        vendor_name: string;
        total_satang: string;
        paid_satang: string;
        due_date: string;
      }

      const billRows = await fastify.sql<BillRow[]>`
        SELECT
          b.id, b.document_number, b.vendor_id, v.name as vendor_name,
          b.total_satang::text, b.paid_satang::text, b.due_date
        FROM bills b
        JOIN vendors v ON v.id = b.vendor_id
        WHERE b.tenant_id = ${tenantId}
          AND b.status IN ('posted', 'partial')
        ORDER BY b.due_date ASC
      `;

      // Aging buckets
      let current = 0n;
      let days1to30 = 0n;
      let days31to60 = 0n;
      let days61to90 = 0n;
      let over90 = 0n;

      // Vendor aggregation
      const vendorMap = new Map<string, {
        vendorId: string;
        vendorName: string;
        current: bigint;
        days1to30: bigint;
        days31to60: bigint;
        days61to90: bigint;
        over90: bigint;
        total: bigint;
        bills: Array<{
          documentNumber: string;
          outstandingSatang: string;
          dueDate: string;
          daysOverdue: number;
        }>;
      }>();

      for (const row of billRows) {
        const outstandingSatang = BigInt(row.total_satang) - BigInt(row.paid_satang);
        if (outstandingSatang <= 0n) continue;

        const dueDate = new Date(row.due_date);
        const diffMs = asOfDateObj.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        // Assign to bucket
        if (daysOverdue === 0) {
          current += outstandingSatang;
        } else if (daysOverdue <= 30) {
          days1to30 += outstandingSatang;
        } else if (daysOverdue <= 60) {
          days31to60 += outstandingSatang;
        } else if (daysOverdue <= 90) {
          days61to90 += outstandingSatang;
        } else {
          over90 += outstandingSatang;
        }

        // Aggregate by vendor
        let vendorEntry = vendorMap.get(row.vendor_id);
        if (vendorEntry === undefined) {
          vendorEntry = {
            vendorId: row.vendor_id,
            vendorName: row.vendor_name,
            current: 0n,
            days1to30: 0n,
            days31to60: 0n,
            days61to90: 0n,
            over90: 0n,
            total: 0n,
            bills: [],
          };
          vendorMap.set(row.vendor_id, vendorEntry);
        }

        vendorEntry.total += outstandingSatang;
        if (daysOverdue === 0) {
          vendorEntry.current += outstandingSatang;
        } else if (daysOverdue <= 30) {
          vendorEntry.days1to30 += outstandingSatang;
        } else if (daysOverdue <= 60) {
          vendorEntry.days31to60 += outstandingSatang;
        } else if (daysOverdue <= 90) {
          vendorEntry.days61to90 += outstandingSatang;
        } else {
          vendorEntry.over90 += outstandingSatang;
        }

        vendorEntry.bills.push({
          documentNumber: row.document_number,
          outstandingSatang: outstandingSatang.toString(),
          dueDate: row.due_date,
          daysOverdue,
        });
      }

      const totalOutstanding = current + days1to30 + days31to60 + days61to90 + over90;

      const vendors = [...vendorMap.values()].map((v) => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        current: money(v.current),
        days1to30: money(v.days1to30),
        days31to60: money(v.days31to60),
        days61to90: money(v.days61to90),
        over90: money(v.over90),
        total: money(v.total),
        bills: v.bills,
      }));

      return reply.status(200).send({
        reportName: 'AP Aging',
        generatedAt: new Date().toISOString(),
        asOfDate,
        buckets: {
          current: money(current),
          days1to30: money(days1to30),
          days31to60: money(days31to60),
          days61to90: money(days61to90),
          over90: money(over90),
        },
        total: money(totalOutstanding),
        vendors,
      });
    },
  );
}
