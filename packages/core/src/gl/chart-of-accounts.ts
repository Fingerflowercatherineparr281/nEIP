/**
 * Chart of Accounts — domain logic and tool definitions.
 *
 * Architecture reference: Story 2.5.
 *
 * Tools:
 *   gl.listAccounts   — list all accounts for a tenant
 *   gl.createAccount  — create a new account
 *   gl.updateAccount  — update an existing account (soft delete via isActive: false)
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { AppError, NotFoundError, ConflictError, ok, err } from '@neip/shared';
import type { ToolResult } from '@neip/shared';
import type { DbClient } from '@neip/db';
import { chart_of_accounts } from '@neip/db';
import type { ToolDefinition, ExecutionContext } from '../tool-registry/types.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const listAccountsSchema = z.object({
  accountType: z
    .enum(['asset', 'liability', 'equity', 'revenue', 'expense'])
    .optional(),
  isActive: z.boolean().optional(),
});

const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  nameTh: z.string().min(1),
  nameEn: z.string().min(1),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentId: z.string().optional(),
});

const updateAccountSchema = z.object({
  id: z.string().min(1),
  nameTh: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface AccountOutput {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  accountType: string;
  isActive: boolean;
  parentId: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createChartOfAccountsTools(db: DbClient) {
  // -------------------------------------------------------------------------
  // gl.listAccounts
  // -------------------------------------------------------------------------
  const listAccounts: ToolDefinition<z.infer<typeof listAccountsSchema>, AccountOutput[]> = {
    name: 'gl.listAccounts',
    description: 'List all chart of accounts entries for the current tenant.',
    inputSchema: listAccountsSchema,
    handler: async (
      params: z.infer<typeof listAccountsSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<AccountOutput[]>> => {
      const conditions = [eq(chart_of_accounts.tenant_id, ctx.tenantId)];

      if (params.accountType !== undefined) {
        conditions.push(eq(chart_of_accounts.account_type, params.accountType));
      }
      if (params.isActive !== undefined) {
        conditions.push(eq(chart_of_accounts.is_active, params.isActive));
      }

      const rows = await db
        .select()
        .from(chart_of_accounts)
        .where(and(...conditions));

      const result: AccountOutput[] = rows.map((r) => ({
        id: r.id,
        code: r.code,
        nameTh: r.name_th,
        nameEn: r.name_en,
        accountType: r.account_type,
        isActive: r.is_active,
        parentId: r.parent_id,
        tenantId: r.tenant_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return ok(result);
    },
  };

  // -------------------------------------------------------------------------
  // gl.createAccount
  // -------------------------------------------------------------------------
  const createAccount: ToolDefinition<z.infer<typeof createAccountSchema>, AccountOutput> = {
    name: 'gl.createAccount',
    description: 'Create a new account in the chart of accounts.',
    inputSchema: createAccountSchema,
    handler: async (
      params: z.infer<typeof createAccountSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<AccountOutput>> => {
      // Check code uniqueness per tenant
      const existing = await db
        .select({ id: chart_of_accounts.id })
        .from(chart_of_accounts)
        .where(
          and(
            eq(chart_of_accounts.tenant_id, ctx.tenantId),
            eq(chart_of_accounts.code, params.code),
          ),
        );

      if (existing.length > 0) {
        return err(
          new ConflictError({
            detail: `Account code "${params.code}" already exists for this tenant.`,
          }),
        );
      }

      const id = uuidv7();
      const now = new Date();

      const row: typeof chart_of_accounts.$inferInsert = {
        id,
        code: params.code,
        name_th: params.nameTh,
        name_en: params.nameEn,
        account_type: params.accountType,
        is_active: true,
        tenant_id: ctx.tenantId,
        created_at: now,
        updated_at: now,
      };

      if (params.parentId !== undefined) {
        row.parent_id = params.parentId;
      }

      try {
        await db.insert(chart_of_accounts).values(row);
      } catch (thrown: unknown) {
        if (isUniqueViolation(thrown)) {
          return err(
            new ConflictError({
              detail: `Account code "${params.code}" already exists for this tenant.`,
            }),
          );
        }
        throw thrown;
      }

      return ok({
        id,
        code: params.code,
        nameTh: params.nameTh,
        nameEn: params.nameEn,
        accountType: params.accountType,
        isActive: true,
        parentId: params.parentId ?? null,
        tenantId: ctx.tenantId,
        createdAt: now,
        updatedAt: now,
      });
    },
  };

  // -------------------------------------------------------------------------
  // gl.updateAccount
  // -------------------------------------------------------------------------
  const updateAccount: ToolDefinition<z.infer<typeof updateAccountSchema>, AccountOutput> = {
    name: 'gl.updateAccount',
    description: 'Update an existing account (soft delete via isActive: false).',
    inputSchema: updateAccountSchema,
    handler: async (
      params: z.infer<typeof updateAccountSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<AccountOutput>> => {
      // Fetch existing account
      const rows = await db
        .select()
        .from(chart_of_accounts)
        .where(
          and(
            eq(chart_of_accounts.id, params.id),
            eq(chart_of_accounts.tenant_id, ctx.tenantId),
          ),
        );

      const existing = rows[0];
      if (existing === undefined) {
        return err(
          new NotFoundError({
            detail: `Account "${params.id}" not found.`,
          }),
        );
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date(),
      };

      if (params.nameTh !== undefined) updates['name_th'] = params.nameTh;
      if (params.nameEn !== undefined) updates['name_en'] = params.nameEn;
      if (params.isActive !== undefined) updates['is_active'] = params.isActive;
      if (params.parentId !== undefined) updates['parent_id'] = params.parentId;

      await db
        .update(chart_of_accounts)
        .set(updates)
        .where(eq(chart_of_accounts.id, params.id));

      // Return updated account
      const updatedRows = await db
        .select()
        .from(chart_of_accounts)
        .where(eq(chart_of_accounts.id, params.id));

      const updated = updatedRows[0];
      if (updated === undefined) {
        return err(
          new AppError({
            type: 'https://problems.neip.app/internal-error',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Failed to retrieve updated account.',
          }),
        );
      }

      return ok({
        id: updated.id,
        code: updated.code,
        nameTh: updated.name_th,
        nameEn: updated.name_en,
        accountType: updated.account_type,
        isActive: updated.is_active,
        parentId: updated.parent_id,
        tenantId: updated.tenant_id,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      });
    },
  };

  return { listAccounts, createAccount, updateAccount };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  return e['code'] === '23505';
}
