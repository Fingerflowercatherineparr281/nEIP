'use client';

/**
 * Executive Dashboard — Story 14.2
 *
 * Features:
 * 1. Revenue trend (6 months) — CSS bar chart
 * 2. Expense breakdown — category summary
 * 3. Cash Flow summary — inflow vs outflow
 * 4. AR/AP aging overview
 * 5. Budget utilization — percentage bars
 * 6. Time period selector: MTD, QTD, YTD, Custom range
 * 7. All monetary values use MoneyDisplay
 * 8. Responsive layout
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SkeletonCard } from '@/components/ui/skeleton';
import { MoneyDisplay } from '@/components/domain/money-display';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimePeriod = 'mtd' | 'qtd' | 'ytd' | 'custom';

interface MoneyVO {
  amountSatang: string;
  currency: string;
}

interface RevenueTrendItem {
  month: string;
  revenue: MoneyVO;
}

interface ExpenseItem {
  code: string;
  name: string;
  amount: MoneyVO;
}

interface BudgetItem {
  code: string;
  name: string;
  budget: MoneyVO;
  actual: MoneyVO;
  percentage: number;
}

interface ArAgingData {
  current: MoneyVO;
  days1to30: MoneyVO;
  days31to60: MoneyVO;
  days61to90: MoneyVO;
  over90: MoneyVO;
  total: MoneyVO;
}

interface CashFlowData {
  inflow: MoneyVO;
  outflow: MoneyVO;
  net: MoneyVO;
}

interface ExecutiveDashboardData {
  period: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  revenueTrend: RevenueTrendItem[];
  totalRevenue: MoneyVO;
  expenseBreakdown: ExpenseItem[];
  totalExpenses: MoneyVO;
  cashFlow: CashFlowData;
  arAging: ArAgingData;
  budgetUtilization: BudgetItem[];
}

// ---------------------------------------------------------------------------
// Period selector labels
// ---------------------------------------------------------------------------

const PERIOD_LABELS: Record<TimePeriod, string> = {
  mtd: 'MTD',
  qtd: 'QTD',
  ytd: 'YTD',
  custom: 'Custom',
};

// ---------------------------------------------------------------------------
// Metric Card (reused from dashboard)
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}

function MetricCard({ label, icon: Icon, children, className }: MetricCardProps): React.JSX.Element {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue Chart (CSS bars)
// ---------------------------------------------------------------------------

function RevenueChart({ data }: { data: RevenueTrendItem[] }): React.JSX.Element {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No revenue data available</p>;
  }

  const maxRevenue = Math.max(
    ...data.map((d) => Number(BigInt(d.revenue.amountSatang))),
    1,
  );

  return (
    <div className="flex items-end gap-2" style={{ height: '160px' }}>
      {data.map((item) => {
        const value = Number(BigInt(item.revenue.amountSatang));
        const height = maxRevenue > 0 ? (value / maxRevenue) * 100 : 0;
        return (
          <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full flex items-end" style={{ height: '140px' }}>
              <div
                className="w-full rounded-t bg-[var(--color-primary)] transition-all"
                style={{ height: `${String(height)}%`, minHeight: value > 0 ? '4px' : '0' }}
                title={`${item.month}: ${String(value / 100)} THB`}
              />
            </div>
            <span className="text-xs text-muted-foreground">{item.month.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ExecutiveDashboardPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const [period, setPeriod] = useState<TimePeriod>('mtd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const queryParams: Record<string, string> = { period };
  if (period === 'custom' && customStart) queryParams['startDate'] = customStart;
  if (period === 'custom' && customEnd) queryParams['endDate'] = customEnd;

  const { data, isLoading } = useQuery<ExecutiveDashboardData>({
    queryKey: [tenantId, 'dashboard', 'executive', period, customStart, customEnd],
    queryFn: () => api.get<ExecutiveDashboardData>('/dashboard/executive', queryParams),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">
            From:
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="ml-2 rounded border border-border bg-card px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            To:
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="ml-2 rounded border border-border bg-card px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard count={6} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <MetricCard label="Total Revenue" icon={TrendingUp}>
              <MoneyDisplay
                amount={BigInt(data?.totalRevenue.amountSatang ?? '0')}
                size="lg"
              />
            </MetricCard>

            <MetricCard label="Total Expenses" icon={TrendingDown}>
              <MoneyDisplay
                amount={BigInt(data?.totalExpenses.amountSatang ?? '0')}
                size="lg"
              />
            </MetricCard>

            <MetricCard label="Net Cash Flow" icon={DollarSign}>
              <MoneyDisplay
                amount={BigInt(data?.cashFlow.net.amountSatang ?? '0')}
                size="lg"
                showSign
              />
            </MetricCard>
          </div>

          {/* Revenue Trend */}
          <div className="mb-8 rounded-lg border border-border bg-card p-4">
            <SectionHeader title="Revenue Trend (6 Months)" icon={BarChart3} />
            <RevenueChart data={data?.revenueTrend ?? []} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
            {/* Expense Breakdown */}
            <div className="rounded-lg border border-border bg-card p-4">
              <SectionHeader title="Expense Breakdown" icon={PieChart} />
              {(data?.expenseBreakdown ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses for this period</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(data?.expenseBreakdown ?? []).map((item) => (
                    <div key={item.code} className="flex items-center justify-between py-1">
                      <span className="text-sm text-foreground truncate mr-2">
                        {item.code} — {item.name}
                      </span>
                      <MoneyDisplay
                        amount={BigInt(item.amount.amountSatang)}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cash Flow Summary */}
            <div className="rounded-lg border border-border bg-card p-4">
              <SectionHeader title="Cash Flow Summary" icon={DollarSign} />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Inflow (Revenue)</span>
                  <MoneyDisplay
                    amount={BigInt(data?.cashFlow.inflow.amountSatang ?? '0')}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Outflow (Expenses)</span>
                  <MoneyDisplay
                    amount={BigInt(data?.cashFlow.outflow.amountSatang ?? '0')}
                    size="sm"
                  />
                </div>
                <hr className="border-border" />
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-sm text-foreground">Net</span>
                  <MoneyDisplay
                    amount={BigInt(data?.cashFlow.net.amountSatang ?? '0')}
                    size="md"
                    showSign
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AR/AP Aging Overview */}
          <div className="mb-8 rounded-lg border border-border bg-card p-4">
            <SectionHeader title="AR/AP Aging Overview" icon={Clock} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left text-muted-foreground font-medium">Bucket</th>
                    <th className="py-2 text-right text-muted-foreground font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Current', key: 'current' as const },
                    { label: '1-30 Days', key: 'days1to30' as const },
                    { label: '31-60 Days', key: 'days31to60' as const },
                    { label: '61-90 Days', key: 'days61to90' as const },
                    { label: 'Over 90 Days', key: 'over90' as const },
                  ].map(({ label, key }) => (
                    <tr key={key} className="border-b border-border last:border-0">
                      <td className="py-2 text-foreground">{label}</td>
                      <td className="py-2 text-right">
                        <MoneyDisplay
                          amount={BigInt(data?.arAging[key].amountSatang ?? '0')}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 text-foreground">Total</td>
                    <td className="py-2 text-right">
                      <MoneyDisplay
                        amount={BigInt(data?.arAging.total.amountSatang ?? '0')}
                        size="sm"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget Utilization */}
          <div className="rounded-lg border border-border bg-card p-4">
            <SectionHeader title="Budget Utilization" icon={BarChart3} />
            {(data?.budgetUtilization ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No budget data available</p>
            ) : (
              <div className="space-y-4">
                {(data?.budgetUtilization ?? []).map((item) => (
                  <div key={item.code}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground truncate mr-2">
                        {item.code} — {item.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MoneyDisplay
                          amount={BigInt(item.actual.amountSatang)}
                          size="sm"
                        />
                        <span>/</span>
                        <MoneyDisplay
                          amount={BigInt(item.budget.amountSatang)}
                          size="sm"
                        />
                      </div>
                    </div>
                    <ProgressBar
                      value={Math.min(item.percentage, 100)}
                      max={100}
                      showValue
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
