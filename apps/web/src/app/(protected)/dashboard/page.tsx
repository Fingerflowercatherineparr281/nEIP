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
  ClipboardCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { MoneyDisplay } from '@/components/domain/money-display';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardMetrics {
  totalRevenue: string;     // satang as string
  totalExpenses: string;
  netIncome: string;
  outstandingAR: string;
  pendingApprovals: number;
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

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: queryKeys.dashboardMetrics(tenantId),
    queryFn: () => api.get<DashboardMetrics>('/reports/dashboard'),
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
              amount={BigInt(metrics?.totalRevenue ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Total Expenses (MTD)" icon={TrendingDown}>
            <MoneyDisplay
              amount={BigInt(metrics?.totalExpenses ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Net Income" icon={DollarSign}>
            <MoneyDisplay
              amount={BigInt(metrics?.netIncome ?? '0')}
              size="lg"
              showSign
            />
          </MetricCard>

          <MetricCard label="Outstanding AR" icon={Receipt}>
            <MoneyDisplay
              amount={BigInt(metrics?.outstandingAR ?? '0')}
              size="lg"
            />
          </MetricCard>

          <MetricCard label="Pending Approvals" icon={ClipboardCheck}>
            <span className="text-lg font-semibold text-foreground">
              {metrics?.pendingApprovals ?? 0}
            </span>
          </MetricCard>
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
