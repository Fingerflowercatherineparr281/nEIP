/**
 * Fiscal Period Management — domain logic and tool definitions.
 *
 * Architecture reference: Story 2.7.
 *
 * Tools:
 *   gl.createFiscalYear — create a fiscal year with 12 monthly periods
 *   gl.closePeriod      — close a fiscal period (blocks posting)
 *   gl.reopenPeriod     — reopen a closed fiscal period
 *   gl.getCurrentPeriod  — get the current open period for a date
 */

import { z } from 'zod';
import { eq, and, lte, gte } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { NotFoundError, ConflictError, ok, err } from '@neip/shared';
import type { ToolResult } from '@neip/shared';
import type { DbClient } from '@neip/db';
import { fiscal_years, fiscal_periods } from '@neip/db';
import type { ToolDefinition, ExecutionContext } from '../tool-registry/types.js';
import { EventStore } from '../events/event-store.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const createFiscalYearSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

const closePeriodSchema = z.object({
  periodId: z.string().min(1),
});

const reopenPeriodSchema = z.object({
  periodId: z.string().min(1),
});

const getCurrentPeriodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface FiscalYearOutput {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  tenantId: string;
  periods: FiscalPeriodOutput[];
}

export interface FiscalPeriodOutput {
  id: string;
  fiscalYearId: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createFiscalPeriodTools(db: DbClient, eventStore: EventStore) {
  // -------------------------------------------------------------------------
  // gl.createFiscalYear
  // -------------------------------------------------------------------------
  const createFiscalYear: ToolDefinition<z.infer<typeof createFiscalYearSchema>, FiscalYearOutput> = {
    name: 'gl.createFiscalYear',
    description: 'Create a fiscal year and auto-generate 12 monthly periods.',
    inputSchema: createFiscalYearSchema,
    handler: async (
      params: z.infer<typeof createFiscalYearSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<FiscalYearOutput>> => {
      // Check for duplicate fiscal year
      const existing = await db
        .select({ id: fiscal_years.id })
        .from(fiscal_years)
        .where(
          and(
            eq(fiscal_years.tenant_id, ctx.tenantId),
            eq(fiscal_years.year, params.year),
          ),
        );

      if (existing.length > 0) {
        return err(
          new ConflictError({
            detail: `Fiscal year ${params.year} already exists for this tenant.`,
          }),
        );
      }

      const fiscalYearId = uuidv7();
      const startDate = params.startDate;

      // Compute end date (12 months from start, minus 1 day)
      const start = new Date(startDate + 'T00:00:00Z');
      const endDateObj = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1));
      const endDate = formatDate(endDateObj);

      await db.insert(fiscal_years).values({
        id: fiscalYearId,
        year: params.year,
        start_date: startDate,
        end_date: endDate,
        tenant_id: ctx.tenantId,
      });

      // Auto-generate 12 monthly periods
      const periods: FiscalPeriodOutput[] = [];
      for (let i = 0; i < 12; i++) {
        const periodId = uuidv7();
        const periodStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, start.getUTCDate()));
        const periodEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, start.getUTCDate() - 1));
        const periodStartStr = formatDate(periodStart);
        const periodEndStr = formatDate(periodEnd);

        await db.insert(fiscal_periods).values({
          id: periodId,
          fiscal_year_id: fiscalYearId,
          period_number: i + 1,
          start_date: periodStartStr,
          end_date: periodEndStr,
          status: 'open',
        });

        periods.push({
          id: periodId,
          fiscalYearId,
          periodNumber: i + 1,
          startDate: periodStartStr,
          endDate: periodEndStr,
          status: 'open',
        });
      }

      return ok({
        id: fiscalYearId,
        year: params.year,
        startDate,
        endDate,
        tenantId: ctx.tenantId,
        periods,
      });
    },
  };

  // -------------------------------------------------------------------------
  // gl.closePeriod
  // -------------------------------------------------------------------------
  const closePeriod: ToolDefinition<z.infer<typeof closePeriodSchema>, FiscalPeriodOutput> = {
    name: 'gl.closePeriod',
    description: 'Close a fiscal period to block posting.',
    inputSchema: closePeriodSchema,
    handler: async (
      params: z.infer<typeof closePeriodSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<FiscalPeriodOutput>> => {
      const rows = await db
        .select()
        .from(fiscal_periods)
        .where(eq(fiscal_periods.id, params.periodId));

      const period = rows[0];
      if (period === undefined) {
        return err(new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` }));
      }

      // Verify tenant ownership via fiscal year
      const fyRows = await db
        .select()
        .from(fiscal_years)
        .where(
          and(
            eq(fiscal_years.id, period.fiscal_year_id),
            eq(fiscal_years.tenant_id, ctx.tenantId),
          ),
        );
      if (fyRows.length === 0) {
        return err(new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` }));
      }

      if (period.status === 'closed') {
        return err(
          new ConflictError({
            detail: `Fiscal period ${period.period_number} is already closed.`,
          }),
        );
      }

      await db
        .update(fiscal_periods)
        .set({ status: 'closed', updated_at: new Date() })
        .where(eq(fiscal_periods.id, params.periodId));

      // Emit event
      await eventStore.append({
        type: 'FiscalPeriodClosed',
        aggregateId: params.periodId,
        aggregateType: 'FiscalPeriod',
        tenantId: ctx.tenantId,
        payload: { periodId: params.periodId, periodNumber: period.period_number },
        version: 1,
      });

      return ok({
        id: period.id,
        fiscalYearId: period.fiscal_year_id,
        periodNumber: period.period_number,
        startDate: period.start_date,
        endDate: period.end_date,
        status: 'closed',
      });
    },
  };

  // -------------------------------------------------------------------------
  // gl.reopenPeriod
  // -------------------------------------------------------------------------
  const reopenPeriod: ToolDefinition<z.infer<typeof reopenPeriodSchema>, FiscalPeriodOutput> = {
    name: 'gl.reopenPeriod',
    description: 'Reopen a previously closed fiscal period.',
    inputSchema: reopenPeriodSchema,
    handler: async (
      params: z.infer<typeof reopenPeriodSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<FiscalPeriodOutput>> => {
      const rows = await db
        .select()
        .from(fiscal_periods)
        .where(eq(fiscal_periods.id, params.periodId));

      const period = rows[0];
      if (period === undefined) {
        return err(new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` }));
      }

      // Verify tenant ownership via fiscal year
      const fyRows = await db
        .select()
        .from(fiscal_years)
        .where(
          and(
            eq(fiscal_years.id, period.fiscal_year_id),
            eq(fiscal_years.tenant_id, ctx.tenantId),
          ),
        );
      if (fyRows.length === 0) {
        return err(new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` }));
      }

      if (period.status === 'open') {
        return err(
          new ConflictError({
            detail: `Fiscal period ${period.period_number} is already open.`,
          }),
        );
      }

      await db
        .update(fiscal_periods)
        .set({ status: 'open', updated_at: new Date() })
        .where(eq(fiscal_periods.id, params.periodId));

      // Emit event
      await eventStore.append({
        type: 'FiscalPeriodReopened',
        aggregateId: params.periodId,
        aggregateType: 'FiscalPeriod',
        tenantId: ctx.tenantId,
        payload: { periodId: params.periodId, periodNumber: period.period_number },
        version: 2,
      });

      return ok({
        id: period.id,
        fiscalYearId: period.fiscal_year_id,
        periodNumber: period.period_number,
        startDate: period.start_date,
        endDate: period.end_date,
        status: 'open',
      });
    },
  };

  // -------------------------------------------------------------------------
  // gl.getCurrentPeriod
  // -------------------------------------------------------------------------
  const getCurrentPeriod: ToolDefinition<z.infer<typeof getCurrentPeriodSchema>, FiscalPeriodOutput> = {
    name: 'gl.getCurrentPeriod',
    description: 'Get the open fiscal period for a given date.',
    inputSchema: getCurrentPeriodSchema,
    handler: async (
      params: z.infer<typeof getCurrentPeriodSchema>,
      ctx: ExecutionContext,
    ): Promise<ToolResult<FiscalPeriodOutput>> => {
      // Find the fiscal year for this tenant that spans the given date
      const fyRows = await db
        .select()
        .from(fiscal_years)
        .where(
          and(
            eq(fiscal_years.tenant_id, ctx.tenantId),
            lte(fiscal_years.start_date, params.date),
            gte(fiscal_years.end_date, params.date),
          ),
        );

      const fy = fyRows[0];
      if (fy === undefined) {
        return err(
          new NotFoundError({
            detail: `No fiscal year found for date "${params.date}".`,
          }),
        );
      }

      // Find the period within this fiscal year that spans the date
      const periodRows = await db
        .select()
        .from(fiscal_periods)
        .where(
          and(
            eq(fiscal_periods.fiscal_year_id, fy.id),
            lte(fiscal_periods.start_date, params.date),
            gte(fiscal_periods.end_date, params.date),
          ),
        );

      const period = periodRows[0];
      if (period === undefined) {
        return err(
          new NotFoundError({
            detail: `No fiscal period found for date "${params.date}".`,
          }),
        );
      }

      return ok({
        id: period.id,
        fiscalYearId: period.fiscal_year_id,
        periodNumber: period.period_number,
        startDate: period.start_date,
        endDate: period.end_date,
        status: period.status,
      });
    },
  };

  return { createFiscalYear, closePeriod, reopenPeriod, getCurrentPeriod };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
