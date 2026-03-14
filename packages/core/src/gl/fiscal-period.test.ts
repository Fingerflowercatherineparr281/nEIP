/**
 * Tests for Fiscal Period Management — Story 2.7.
 * Given-When-Then pattern (AR29).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictError, NotFoundError } from '@neip/shared';
import type { ExecutionContext } from '../tool-registry/types.js';

// ---------------------------------------------------------------------------
// Testable fiscal period logic (in-memory)
// ---------------------------------------------------------------------------

interface FakeFiscalYear {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  tenantId: string;
}

interface FakeFiscalPeriod {
  id: string;
  fiscalYearId: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
}

const CTX: ExecutionContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  requestId: 'req-001',
};

class TestableFiscalPeriodService {
  private readonly _years: FakeFiscalYear[] = [];
  private readonly _periods: FakeFiscalPeriod[] = [];
  private readonly _events: { type: string; aggregateId: string }[] = [];

  async createFiscalYear(
    params: { year: number; startDate: string },
    ctx: ExecutionContext,
  ) {
    // Check duplicate
    const dup = this._years.find(
      (y) => y.tenantId === ctx.tenantId && y.year === params.year,
    );
    if (dup) {
      throw new ConflictError({
        detail: `Fiscal year ${params.year} already exists for this tenant.`,
      });
    }

    const { uuidv7 } = await import('uuidv7');
    const id = uuidv7();

    const start = new Date(params.startDate + 'T00:00:00Z');
    const endDateObj = new Date(
      Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1),
    );
    const endDate = formatDate(endDateObj);

    const fy: FakeFiscalYear = {
      id,
      year: params.year,
      startDate: params.startDate,
      endDate,
      tenantId: ctx.tenantId,
    };
    this._years.push(fy);

    // Generate 12 monthly periods
    const periods: FakeFiscalPeriod[] = [];
    for (let i = 0; i < 12; i++) {
      const periodId = uuidv7();
      const periodStart = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, start.getUTCDate()),
      );
      const periodEnd = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, start.getUTCDate() - 1),
      );
      const period: FakeFiscalPeriod = {
        id: periodId,
        fiscalYearId: id,
        periodNumber: i + 1,
        startDate: formatDate(periodStart),
        endDate: formatDate(periodEnd),
        status: 'open',
      };
      periods.push(period);
      this._periods.push(period);
    }

    return { ...fy, periods };
  }

  async closePeriod(params: { periodId: string }, ctx: ExecutionContext) {
    const period = this._periods.find((p) => p.id === params.periodId);
    if (!period) throw new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` });

    // Verify tenant
    const fy = this._years.find(
      (y) => y.id === period.fiscalYearId && y.tenantId === ctx.tenantId,
    );
    if (!fy) throw new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` });

    if (period.status === 'closed') {
      throw new ConflictError({
        detail: `Fiscal period ${period.periodNumber} is already closed.`,
      });
    }

    period.status = 'closed';
    this._events.push({ type: 'FiscalPeriodClosed', aggregateId: params.periodId });
    return { ...period };
  }

  async reopenPeriod(params: { periodId: string }, ctx: ExecutionContext) {
    const period = this._periods.find((p) => p.id === params.periodId);
    if (!period) throw new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` });

    const fy = this._years.find(
      (y) => y.id === period.fiscalYearId && y.tenantId === ctx.tenantId,
    );
    if (!fy) throw new NotFoundError({ detail: `Fiscal period "${params.periodId}" not found.` });

    if (period.status === 'open') {
      throw new ConflictError({
        detail: `Fiscal period ${period.periodNumber} is already open.`,
      });
    }

    period.status = 'open';
    this._events.push({ type: 'FiscalPeriodReopened', aggregateId: params.periodId });
    return { ...period };
  }

  get events() { return this._events; }
  get periods() { return this._periods; }
}

function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FiscalPeriod.createFiscalYear', () => {
  let service: TestableFiscalPeriodService;

  beforeEach(() => {
    service = new TestableFiscalPeriodService();
  });

  it('Given no fiscal years, When creating year 2026, Then 12 periods are generated', async () => {
    // When
    const result = await service.createFiscalYear(
      { year: 2026, startDate: '2026-01-01' },
      CTX,
    );

    // Then
    expect(result.year).toBe(2026);
    expect(result.periods).toHaveLength(12);
    expect(result.periods[0]?.periodNumber).toBe(1);
    expect(result.periods[11]?.periodNumber).toBe(12);
    expect(result.periods[0]?.status).toBe('open');
  });

  it('Given fiscal year 2026 exists, When creating again, Then ConflictError is thrown', async () => {
    // Given
    await service.createFiscalYear({ year: 2026, startDate: '2026-01-01' }, CTX);

    // When / Then
    await expect(
      service.createFiscalYear({ year: 2026, startDate: '2026-01-01' }, CTX),
    ).rejects.toThrow(ConflictError);
  });

  it('Given fiscal year starting April, When created, Then periods span Apr-Mar', async () => {
    // Given / When
    const result = await service.createFiscalYear(
      { year: 2026, startDate: '2026-04-01' },
      CTX,
    );

    // Then
    expect(result.startDate).toBe('2026-04-01');
    expect(result.endDate).toBe('2027-03-31');
    expect(result.periods[0]?.startDate).toBe('2026-04-01');
  });
});

describe('FiscalPeriod.closePeriod', () => {
  let service: TestableFiscalPeriodService;
  let periodId: string;

  beforeEach(async () => {
    service = new TestableFiscalPeriodService();
    const fy = await service.createFiscalYear(
      { year: 2026, startDate: '2026-01-01' },
      CTX,
    );
    periodId = fy.periods[0]!.id;
  });

  it('Given an open period, When closing, Then status becomes closed', async () => {
    // When
    const result = await service.closePeriod({ periodId }, CTX);

    // Then
    expect(result.status).toBe('closed');
  });

  it('Given an already closed period, When closing again, Then ConflictError is thrown', async () => {
    // Given
    await service.closePeriod({ periodId }, CTX);

    // When / Then
    await expect(service.closePeriod({ periodId }, CTX)).rejects.toThrow(ConflictError);
  });

  it('Given period closed, When event emitted, Then FiscalPeriodClosed is recorded', async () => {
    // When
    await service.closePeriod({ periodId }, CTX);

    // Then
    expect(service.events.some((e) => e.type === 'FiscalPeriodClosed')).toBe(true);
  });
});

describe('FiscalPeriod.reopenPeriod', () => {
  let service: TestableFiscalPeriodService;
  let periodId: string;

  beforeEach(async () => {
    service = new TestableFiscalPeriodService();
    const fy = await service.createFiscalYear(
      { year: 2026, startDate: '2026-01-01' },
      CTX,
    );
    periodId = fy.periods[0]!.id;
  });

  it('Given a closed period, When reopening, Then status becomes open', async () => {
    // Given
    await service.closePeriod({ periodId }, CTX);

    // When
    const result = await service.reopenPeriod({ periodId }, CTX);

    // Then
    expect(result.status).toBe('open');
  });

  it('Given an already open period, When reopening, Then ConflictError is thrown', async () => {
    // When / Then
    await expect(service.reopenPeriod({ periodId }, CTX)).rejects.toThrow(ConflictError);
  });

  it('Given period reopened, When event emitted, Then FiscalPeriodReopened is recorded', async () => {
    // Given
    await service.closePeriod({ periodId }, CTX);

    // When
    await service.reopenPeriod({ periodId }, CTX);

    // Then
    expect(service.events.some((e) => e.type === 'FiscalPeriodReopened')).toBe(true);
  });
});
