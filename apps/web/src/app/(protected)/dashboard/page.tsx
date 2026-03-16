'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  CreditCard,
  BookOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { MoneyDisplay } from '@/components/domain/money-display';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types — matched to actual API: GET /api/v1/dashboard/executive
// ---------------------------------------------------------------------------

interface AmountWithCurrency {
  amountSatang: string;
  currency: string;
}

interface ExecutiveDashboard {
  period: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalRevenue: AmountWithCurrency;
  totalExpenses: AmountWithCurrency;
  cashFlow: {
    inflow: AmountWithCurrency;
    outflow: AmountWithCurrency;
    net: AmountWithCurrency;
  };
  arAging: {
    current: AmountWithCurrency;
    days1to30: AmountWithCurrency;
    days31to60: AmountWithCurrency;
    days61to90: AmountWithCurrency;
    over90: AmountWithCurrency;
    total: AmountWithCurrency;
  };
  revenueTrend: Array<{ month: string; revenue: AmountWithCurrency }>;
  expenseBreakdown: Array<{ category: string; amount: AmountWithCurrency }>;
  budgetUtilization: Array<{ accountId: string; budgeted: AmountWithCurrency; actual: AmountWithCurrency }>;
}

// ---------------------------------------------------------------------------
// Metric Card
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
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';

  const { data: dashboard, isLoading } = useQuery<ExecutiveDashboard>({
    queryKey: queryKeys.dashboardMetrics(tenantId),
    queryFn: () => api.get<ExecutiveDashboard>('/dashboard/executive'),
  });

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {'สวัสดีคุณ'}
          {user?.name ?? ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Metric Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard count={5} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Total Revenue (MTD)" icon={TrendingUp}>
            <MoneyDisplay
              amount={BigInt(dashboard?.totalRevenue?.amountSatang ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Total Expenses (MTD)" icon={TrendingDown}>
            <MoneyDisplay
              amount={BigInt(dashboard?.totalExpenses?.amountSatang ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Net Cash Flow" icon={DollarSign}>
            <MoneyDisplay
              amount={BigInt(dashboard?.cashFlow?.net?.amountSatang ?? '0')}
              size="lg"
              showSign
            />
          </MetricCard>

          <MetricCard label="Outstanding AR (Total)" icon={Receipt}>
            <MoneyDisplay
              amount={BigInt(dashboard?.arAging?.total?.amountSatang ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Cash Inflow" icon={TrendingUp}>
            <MoneyDisplay
              amount={BigInt(dashboard?.cashFlow?.inflow?.amountSatang ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Cash Outflow" icon={TrendingDown}>
            <MoneyDisplay
              amount={BigInt(dashboard?.cashFlow?.outflow?.amountSatang ?? '0')}
              size="lg"
            />
          </MetricCard>
        </div>
      )}

      {/* AR Aging breakdown */}
      {!isLoading && dashboard?.arAging && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">AR Aging</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Current', key: 'current' as const },
              { label: '1-30 days', key: 'days1to30' as const },
              { label: '31-60 days', key: 'days31to60' as const },
              { label: '61-90 days', key: 'days61to90' as const },
              { label: '90+ days', key: 'over90' as const },
            ].map(({ label, key }) => (
              <div key={key} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="mt-1">
                  <MoneyDisplay
                    amount={BigInt(dashboard.arAging[key]?.amountSatang ?? '0')}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/invoices/new')}
          >
            <FileText className="h-4 w-4" />
            Create Invoice
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/payments/new')}
          >
            <CreditCard className="h-4 w-4" />
            Record Payment
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/journal-entries/new')}
          >
            <BookOpen className="h-4 w-4" />
            Create Journal Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
