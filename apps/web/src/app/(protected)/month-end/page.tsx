'use client';

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen, Play, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FiscalPeriod {
  id: string;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
}

interface FiscalYear {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  periods: FiscalPeriod[];
  createdAt: string;
}

interface FiscalYearListResponse {
  items: FiscalYear[];
}

interface MonthEndJobResponse {
  jobId: string;
  status: string;
  message: string;
}

interface MonthEndJobStatus {
  jobId: string;
  state: string;
  data: unknown;
  createdOn: string;
  completedOn?: string | null;
}

// ---------------------------------------------------------------------------
// Period Status Badge
// ---------------------------------------------------------------------------

interface PeriodStatusBadgeProps {
  status: 'open' | 'closed';
}

function PeriodStatusBadge({ status }: PeriodStatusBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        status === 'closed'
          ? 'border-[var(--color-hitl-blocked)] bg-[var(--color-hitl-blocked-bg)] text-[var(--color-hitl-blocked)]'
          : 'border-[var(--color-hitl-auto)] bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)]',
      )}
    >
      {status === 'closed' ? (
        <Lock className="h-3 w-3" aria-hidden="true" />
      ) : (
        <LockOpen className="h-3 w-3" aria-hidden="true" />
      )}
      {status === 'closed' ? 'Closed' : 'Open'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MonthEndPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const [closePeriodTarget, setClosePeriodTarget] = useState<FiscalPeriod | null>(null);
  const [reopenPeriodTarget, setReopenPeriodTarget] = useState<FiscalPeriod | null>(null);
  const [activeJob, setActiveJob] = useState<MonthEndJobResponse | null>(null);
  const [monthEndTarget, setMonthEndTarget] = useState<{
    year: number;
    period: FiscalPeriod;
  } | null>(null);

  const { data: fiscalData, isLoading } = useQuery<FiscalYearListResponse>({
    queryKey: queryKeys.fiscalYears(tenantId),
    queryFn: () => api.get<FiscalYearListResponse>('/fiscal-years'),
  });

  const { data: jobStatus, refetch: refetchJob } = useQuery<MonthEndJobStatus>({
    queryKey: queryKeys.monthEndJob(tenantId, activeJob?.jobId ?? ''),
    queryFn: () => api.get<MonthEndJobStatus>(`/month-end/${activeJob!.jobId}`),
    enabled: !!activeJob?.jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.state === 'completed' || data.state === 'failed')) return false;
      return 3000;
    },
  });

  const closePeriodMutation = useMutation({
    mutationFn: (periodId: string) =>
      api.post<FiscalPeriod>(`/fiscal-periods/${periodId}/close`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.fiscalYears(tenantId) });
      setClosePeriodTarget(null);
      showToast.success('Period closed successfully');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to close period');
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: (periodId: string) =>
      api.post<FiscalPeriod>(`/fiscal-periods/${periodId}/reopen`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.fiscalYears(tenantId) });
      setReopenPeriodTarget(null);
      showToast.success('Period reopened successfully');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to reopen period');
    },
  });

  const monthEndCloseMutation = useMutation({
    mutationFn: ({ fiscalYear, fiscalPeriod }: { fiscalYear: number; fiscalPeriod: number }) =>
      api.post<MonthEndJobResponse>('/month-end/close', { fiscalYear, fiscalPeriod }),
    onSuccess: (data) => {
      setActiveJob(data);
      setMonthEndTarget(null);
      showToast.info('Month-end close job queued');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to queue month-end close');
    },
  });

  const handleMonthEndClose = useCallback(
    (year: number, period: FiscalPeriod) => {
      setMonthEndTarget({ year, period });
    },
    [],
  );

  const fiscalYears = fiscalData?.items ?? [];

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Month-End Close</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage fiscal periods and initiate month-end close processes
        </p>
      </div>

      {/* Active job status banner */}
      {activeJob && (
        <div className="rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-100)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-primary-700)]">
                Month-End Close Job
              </p>
              <p className="text-xs text-[var(--color-primary-700)]/70">{activeJob.message}</p>
            </div>
            <div className="flex items-center gap-3">
              {jobStatus && (
                <span className="rounded-full bg-[var(--color-primary-200)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-700)] capitalize">
                  {jobStatus.state}
                </span>
              )}
              {(!jobStatus || (jobStatus.state !== 'completed' && jobStatus.state !== 'failed')) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refetchJob()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              )}
              {jobStatus && (jobStatus.state === 'completed' || jobStatus.state === 'failed') && (
                <Button variant="ghost" size="sm" onClick={() => setActiveJob(null)}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fiscal Years */}
      {isLoading ? (
        <SkeletonCard variant="default" count={2} />
      ) : fiscalYears.length === 0 ? (
        <InlineAlert
          variant="info"
          message="No fiscal years found."
          description="Create a fiscal year in Settings to get started."
        />
      ) : (
        <div className="space-y-8">
          {fiscalYears.map((fy) => (
            <div key={fy.id}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
                  FY {fy.year}
                </h2>
                <span className="text-sm text-[var(--color-muted-foreground)]">
                  {fy.startDate} — {fy.endDate}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                        Month
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                        Date Range
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fy.periods.map((period) => {
                      const monthIndex = period.periodNumber - 1;
                      const monthName = MONTH_NAMES[monthIndex] ?? `P${period.periodNumber}`;

                      return (
                        <tr
                          key={period.id}
                          className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30"
                        >
                          <td className="px-4 py-3 font-medium">{period.periodNumber}</td>
                          <td className="px-4 py-3">{monthName}</td>
                          <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                            {period.startDate} — {period.endDate}
                          </td>
                          <td className="px-4 py-3">
                            <PeriodStatusBadge status={period.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {period.status === 'open' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setClosePeriodTarget(period)}
                                  >
                                    <Lock className="h-3.5 w-3.5" />
                                    Close Period
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMonthEndClose(fy.year, period)}
                                    disabled={monthEndCloseMutation.isPending}
                                  >
                                    <Play className="h-3.5 w-3.5" />
                                    Month-End
                                  </Button>
                                </>
                              )}
                              {period.status === 'closed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReopenPeriodTarget(period)}
                                >
                                  <LockOpen className="h-3.5 w-3.5" />
                                  Reopen
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Close Period Confirm */}
      <ConfirmDialog
        open={closePeriodTarget !== null}
        onOpenChange={(open) => { if (!open) setClosePeriodTarget(null); }}
        title="Close Fiscal Period"
        description={`Are you sure you want to close Period ${closePeriodTarget?.periodNumber ?? ''} (${closePeriodTarget?.startDate ?? ''} – ${closePeriodTarget?.endDate ?? ''})? No new journal entries will be posted to this period.`}
        confirmLabel="Close Period"
        confirmVariant="destructive"
        onConfirm={() => {
          if (closePeriodTarget) closePeriodMutation.mutate(closePeriodTarget.id);
        }}
        loading={closePeriodMutation.isPending}
      />

      {/* Reopen Period Confirm */}
      <ConfirmDialog
        open={reopenPeriodTarget !== null}
        onOpenChange={(open) => { if (!open) setReopenPeriodTarget(null); }}
        title="Reopen Fiscal Period"
        description={`Are you sure you want to reopen Period ${reopenPeriodTarget?.periodNumber ?? ''}? This will allow new journal entries to be posted.`}
        confirmLabel="Reopen Period"
        confirmVariant="primary"
        onConfirm={() => {
          if (reopenPeriodTarget) reopenPeriodMutation.mutate(reopenPeriodTarget.id);
        }}
        loading={reopenPeriodMutation.isPending}
      />

      {/* Month-End Close Confirm */}
      <ConfirmDialog
        open={monthEndTarget !== null}
        onOpenChange={(open) => { if (!open) setMonthEndTarget(null); }}
        title="Run Month-End Close"
        description={`This will queue a month-end close job for Period ${monthEndTarget?.period.periodNumber ?? ''} of FY ${monthEndTarget?.year ?? ''}. The process will close the period and run all month-end procedures.`}
        confirmLabel="Run Month-End Close"
        confirmVariant="primary"
        onConfirm={() => {
          if (monthEndTarget) {
            monthEndCloseMutation.mutate({
              fiscalYear: monthEndTarget.year,
              fiscalPeriod: monthEndTarget.period.periodNumber,
            });
          }
        }}
        loading={monthEndCloseMutation.isPending}
      />
    </div>
  );
}
