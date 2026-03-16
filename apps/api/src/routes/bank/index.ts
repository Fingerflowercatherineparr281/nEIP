/**
 * Bank Reconciliation routes (กระทบยอดธนาคาร / FI-BL):
 *   POST /api/v1/bank-accounts              — create bank account
 *   GET  /api/v1/bank-accounts              — list accounts
 *   GET  /api/v1/bank-accounts/:id          — detail + recent transactions
 *   POST /api/v1/bank-accounts/:id/transactions — add manual transaction
 *   POST /api/v1/bank-accounts/:id/import   — import bank statement (CSV)
 *   GET  /api/v1/bank-accounts/:id/reconciliation — reconciliation report
 *   POST /api/v1/bank-transactions/:id/reconcile  — match to JE
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NotFoundError, ValidationError, API_V1_PREFIX } from '@neip/shared';
import { requireAuth } from '../../hooks/require-auth.js';
import { requirePermission } from '../../hooks/require-permission.js';
import { toISO } from '../../lib/to-iso.js';
import {
  FI_BANK_CREATE,
  FI_BANK_READ,
  FI_BANK_IMPORT,
  FI_BANK_RECONCILE,
} from '../../lib/permissions.js';

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

const createBankAccountSchema = {
  type: 'object',
  required: ['accountName', 'accountNumber', 'bankName'],
  additionalProperties: false,
  properties: {
    accountName: { type: 'string', minLength: 1, maxLength: 255 },
    accountNumber: { type: 'string', minLength: 1, maxLength: 50 },
    bankName: { type: 'string', minLength: 1, maxLength: 100 },
    glAccountId: { type: 'string', nullable: true },
    currency: { type: 'string', default: 'THB', maxLength: 3 },
  },
} as const;

const createTransactionSchema = {
  type: 'object',
  required: ['transactionDate', 'description'],
  additionalProperties: false,
  properties: {
    transactionDate: { type: 'string', format: 'date' },
    description: { type: 'string', minLength: 1, maxLength: 500 },
    debitSatang: { type: 'string', default: '0' },
    creditSatang: { type: 'string', default: '0' },
    reference: { type: 'string', maxLength: 100, nullable: true },
  },
} as const;

const reconcileSchema = {
  type: 'object',
  required: ['journalEntryId'],
  additionalProperties: false,
  properties: {
    journalEntryId: { type: 'string' },
  },
} as const;

const bankAccountResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    accountName: { type: 'string' },
    accountNumber: { type: 'string' },
    bankName: { type: 'string' },
    glAccountId: { type: 'string', nullable: true },
    currency: { type: 'string' },
    balanceSatang: { type: 'string' },
    tenantId: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const transactionResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    bankAccountId: { type: 'string' },
    transactionDate: { type: 'string' },
    description: { type: 'string' },
    debitSatang: { type: 'string' },
    creditSatang: { type: 'string' },
    reference: { type: 'string', nullable: true },
    reconciled: { type: 'boolean' },
    reconciledJeId: { type: 'string', nullable: true },
    createdAt: { type: 'string' },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateBankAccountBody {
  accountName: string;
  accountNumber: string;
  bankName: string;
  glAccountId?: string;
  currency?: string;
}

interface CreateTransactionBody {
  transactionDate: string;
  description: string;
  debitSatang?: string;
  creditSatang?: string;
  reference?: string;
}

interface ReconcileBody {
  journalEntryId: string;
}

interface IdParams { id: string; }

interface BankAccountRow {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  gl_account_id: string | null;
  currency: string;
  balance_satang: bigint;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface BankTransactionRow {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  debit_satang: bigint;
  credit_satang: bigint;
  reference: string | null;
  reconciled: boolean;
  reconciled_je_id: string | null;
  tenant_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

function mapAccount(r: BankAccountRow) {
  return {
    id: r.id,
    accountName: r.account_name,
    accountNumber: r.account_number,
    bankName: r.bank_name,
    glAccountId: r.gl_account_id,
    currency: r.currency,
    balanceSatang: r.balance_satang.toString(),
    tenantId: r.tenant_id,
    createdAt: toISO(r.created_at),
    updatedAt: toISO(r.updated_at),
  };
}

function mapTransaction(r: BankTransactionRow) {
  return {
    id: r.id,
    bankAccountId: r.bank_account_id,
    transactionDate: typeof r.transaction_date === 'string'
      ? r.transaction_date
      : (r.transaction_date as unknown as Date).toISOString().slice(0, 10),
    description: r.description,
    debitSatang: r.debit_satang.toString(),
    creditSatang: r.credit_satang.toString(),
    reference: r.reference,
    reconciled: r.reconciled,
    reconciledJeId: r.reconciled_je_id,
    createdAt: toISO(r.created_at),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function bankRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /api/v1/bank-accounts
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateBankAccountBody }>(
    `${API_V1_PREFIX}/bank-accounts`,
    {
      schema: {
        description: 'Create a bank account',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        body: createBankAccountSchema,
        response: { 201: { description: 'Bank account created', ...bankAccountResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_CREATE)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { accountName, accountNumber, bankName, glAccountId = null, currency = 'THB' } = request.body;

      const id = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO bank_accounts (id, account_name, account_number, bank_name, gl_account_id, currency, balance_satang, tenant_id)
        VALUES (${id}, ${accountName}, ${accountNumber}, ${bankName}, ${glAccountId}, ${currency}, 0, ${tenantId})
      `;

      const rows = await fastify.sql<[BankAccountRow]>`SELECT * FROM bank_accounts WHERE id = ${id} LIMIT 1`;
      return reply.status(201).send(mapAccount(rows[0]));
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/bank-accounts
  // -------------------------------------------------------------------------
  fastify.get(
    `${API_V1_PREFIX}/bank-accounts`,
    {
      schema: {
        description: 'List bank accounts',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: bankAccountResponseSchema },
              total: { type: 'integer' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_READ)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const accounts = await fastify.sql<BankAccountRow[]>`SELECT * FROM bank_accounts WHERE tenant_id = ${tenantId} ORDER BY account_name`;
      return reply.status(200).send({ items: accounts.map(mapAccount), total: accounts.length });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/bank-accounts/:id — detail with recent transactions
  // -------------------------------------------------------------------------
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bank-accounts/:id`,
    {
      schema: {
        description: 'Get bank account detail with recent transactions',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              account: bankAccountResponseSchema,
              recentTransactions: { type: 'array', items: transactionResponseSchema },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const rows = await fastify.sql<[BankAccountRow?]>`SELECT * FROM bank_accounts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!rows[0]) throw new NotFoundError({ detail: `Bank account ${id} not found.` });

      const txns = await fastify.sql<BankTransactionRow[]>`
        SELECT * FROM bank_transactions WHERE bank_account_id = ${id} ORDER BY transaction_date DESC, created_at DESC LIMIT 20
      `;

      return reply.status(200).send({
        account: mapAccount(rows[0]),
        recentTransactions: txns.map(mapTransaction),
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/bank-accounts/:id/transactions — add manual transaction
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams; Body: CreateTransactionBody }>(
    `${API_V1_PREFIX}/bank-accounts/:id/transactions`,
    {
      schema: {
        description: 'Add a manual transaction to a bank account',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: createTransactionSchema,
        response: { 201: { description: 'Transaction created', ...transactionResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_CREATE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { transactionDate, description, debitSatang = '0', creditSatang = '0', reference = null } = request.body;

      const acct = await fastify.sql<[{ id: string }?]>`SELECT id FROM bank_accounts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!acct[0]) throw new NotFoundError({ detail: `Bank account ${id} not found.` });

      const debit = BigInt(debitSatang);
      const credit = BigInt(creditSatang);

      if (debit === 0n && credit === 0n) {
        throw new ValidationError({ detail: 'Either debitSatang or creditSatang must be non-zero.' });
      }

      const txnId = crypto.randomUUID();
      await fastify.sql`
        INSERT INTO bank_transactions (id, bank_account_id, transaction_date, description, debit_satang, credit_satang, reference, reconciled, tenant_id)
        VALUES (${txnId}, ${id}, ${transactionDate}, ${description}, ${debit.toString()}::bigint, ${credit.toString()}::bigint, ${reference}, false, ${tenantId})
      `;

      // Update account running balance
      await fastify.sql`
        UPDATE bank_accounts SET balance_satang = balance_satang + ${credit.toString()}::bigint - ${debit.toString()}::bigint, updated_at = NOW()
        WHERE id = ${id}
      `;

      const rows = await fastify.sql<[BankTransactionRow]>`SELECT * FROM bank_transactions WHERE id = ${txnId} LIMIT 1`;
      return reply.status(201).send(mapTransaction(rows[0]));
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/bank-accounts/:id/import — import CSV bank statement
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bank-accounts/:id/import`,
    {
      schema: {
        description: 'Import bank statement from CSV (multipart)',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              imported: { type: 'integer' },
              skipped: { type: 'integer' },
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_IMPORT)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const acct = await fastify.sql<[{ id: string }?]>`SELECT id FROM bank_accounts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!acct[0]) throw new NotFoundError({ detail: `Bank account ${id} not found.` });

      // Read uploaded CSV
      const data = await request.file();
      if (!data) {
        throw new ValidationError({ detail: 'No file uploaded. Send a CSV with columns: date,description,debit,credit,reference' });
      }

      const raw = await data.toBuffer();
      const text = raw.toString('utf-8');
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      // Skip header row
      const dataLines = lines.slice(1);
      let imported = 0;
      let skipped = 0;

      for (const line of dataLines) {
        const parts = line.split(',');
        if (parts.length < 4) { skipped++; continue; }

        const [date, desc, debitStr, creditStr, ref] = parts;
        if (!date || !desc) { skipped++; continue; }

        const debitNum = parseFloat(debitStr?.trim() ?? '0');
        const creditNum = parseFloat(creditStr?.trim() ?? '0');
        const debit = BigInt(Math.round(isNaN(debitNum) ? 0 : debitNum * 100));
        const credit = BigInt(Math.round(isNaN(creditNum) ? 0 : creditNum * 100));

        await fastify.sql`
          INSERT INTO bank_transactions (id, bank_account_id, transaction_date, description, debit_satang, credit_satang, reference, reconciled, tenant_id)
          VALUES (${crypto.randomUUID()}, ${id}, ${date.trim()}, ${desc.trim()}, ${debit.toString()}::bigint, ${credit.toString()}::bigint, ${ref?.trim() ?? null}, false, ${tenantId})
        `;
        // Update balance
        await fastify.sql`
          UPDATE bank_accounts SET balance_satang = balance_satang + ${credit.toString()}::bigint - ${debit.toString()}::bigint, updated_at = NOW()
          WHERE id = ${id}
        `;
        imported++;
      }

      return reply.status(200).send({ imported, skipped, message: `Imported ${imported} transactions, skipped ${skipped}.` });
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/bank-accounts/:id/reconciliation — reconciliation report
  // -------------------------------------------------------------------------
  fastify.get<{ Params: IdParams }>(
    `${API_V1_PREFIX}/bank-accounts/:id/reconciliation`,
    {
      schema: {
        description: 'Reconciliation report — unmatched bank transactions',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              account: bankAccountResponseSchema,
              unreconciledCount: { type: 'integer' },
              unreconciledDebitSatang: { type: 'string' },
              unreconciledCreditSatang: { type: 'string' },
              unreconciledTransactions: { type: 'array', items: transactionResponseSchema },
            },
          },
        },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_READ)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;

      const acctRows = await fastify.sql<[BankAccountRow?]>`SELECT * FROM bank_accounts WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
      if (!acctRows[0]) throw new NotFoundError({ detail: `Bank account ${id} not found.` });

      const txns = await fastify.sql<BankTransactionRow[]>`
        SELECT * FROM bank_transactions
        WHERE bank_account_id = ${id} AND reconciled = false
        ORDER BY transaction_date DESC
      `;

      let totalDebit = 0n;
      let totalCredit = 0n;
      for (const t of txns) {
        totalDebit += t.debit_satang;
        totalCredit += t.credit_satang;
      }

      return reply.status(200).send({
        account: mapAccount(acctRows[0]),
        unreconciledCount: txns.length,
        unreconciledDebitSatang: totalDebit.toString(),
        unreconciledCreditSatang: totalCredit.toString(),
        unreconciledTransactions: txns.map(mapTransaction),
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/bank-transactions/:id/reconcile — match to JE
  // -------------------------------------------------------------------------
  fastify.post<{ Params: IdParams; Body: ReconcileBody }>(
    `${API_V1_PREFIX}/bank-transactions/:id/reconcile`,
    {
      schema: {
        description: 'Reconcile a bank transaction by matching it to a journal entry',
        tags: ['bank'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: reconcileSchema,
        response: { 200: { description: 'Transaction reconciled', ...transactionResponseSchema } },
      },
      preHandler: [requireAuth, requirePermission(FI_BANK_RECONCILE)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tenantId } = request.user;
      const { journalEntryId } = request.body;

      const existing = await fastify.sql<[BankTransactionRow?]>`
        SELECT * FROM bank_transactions WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!existing[0]) throw new NotFoundError({ detail: `Bank transaction ${id} not found.` });
      if (existing[0].reconciled) {
        throw new ValidationError({ detail: 'Transaction is already reconciled.' });
      }

      // Verify journal entry exists
      const je = await fastify.sql<[{ id: string }?]>`
        SELECT id FROM journal_entries WHERE id = ${journalEntryId} AND tenant_id = ${tenantId} LIMIT 1
      `;
      if (!je[0]) throw new NotFoundError({ detail: `Journal entry ${journalEntryId} not found.` });

      const rows = await fastify.sql<[BankTransactionRow]>`
        UPDATE bank_transactions SET reconciled = true, reconciled_je_id = ${journalEntryId}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      return reply.status(200).send(mapTransaction(rows[0]));
    },
  );
}
