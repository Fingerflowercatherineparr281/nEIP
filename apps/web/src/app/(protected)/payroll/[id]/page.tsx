'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface PayrollItem {
  id: string; employeeId: string;
  baseSalarySatang: number; grossSatang: number;
  socialSecuritySatang: number; providentFundSatang: number;
  personalIncomeTaxSatang: number; totalDeductionsSatang: number;
  netSatang: number; employerSscSatang: number; status: string;
}

interface PayrollRunDetail {
  id: string; payPeriodStart: string; payPeriodEnd: string;
  runDate: string; status: string;
  totalGrossSatang: number; totalDeductionsSatang: number;
  totalNetSatang: number; totalEmployerSscSatang: number; totalTaxSatang: number;
  items: PayrollItem[];
}

function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

const STATUS_ACTIONS: Record<string, string> = {
  draft: 'Calculate',
  calculated: 'Approve',
  approved: 'Pay',
};

export default function PayrollDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const { data: run, isLoading } = useQuery<PayrollRunDetail>({
    queryKey: [tenantId, 'payroll', id],
    queryFn: () => api.get<PayrollRunDetail>(`/payroll/${id}`),
  });

  const actionMutation = useMutation({
    mutationFn: (action: 'calculate' | 'approve' | 'pay') =>
      api.post(`/payroll/${id}/${action}`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'payroll', id] });
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'payroll'] });
      showToast.success('Payroll updated');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Action failed');
    },
  });

  if (isLoading) return <div className="p-6"><SkeletonRow count={8} /></div>;
  if (!run) return <div className="p-6 text-[var(--color-muted-foreground)]">Payroll run not found.</div>;

  const nextAction = STATUS_ACTIONS[run.status];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Link href="/payroll">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Payroll Run</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {run.payPeriodStart} — {run.payPeriodEnd}
          </p>
        </div>
        {nextAction && (
          <Button
            variant="primary"
            onClick={() => actionMutation.mutate(run.status === 'draft' ? 'calculate' : run.status === 'calculated' ? 'approve' : 'pay')}
            loading={actionMutation.isPending}
          >
            {nextAction}
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Gross', value: formatBaht(run.totalGrossSatang) },
          { label: 'Total Deductions', value: formatBaht(run.totalDeductionsSatang) },
          { label: 'Total Net', value: formatBaht(run.totalNetSatang) },
          { label: 'Employer SSC', value: formatBaht(run.totalEmployerSscSatang) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-[var(--color-border)] p-4">
            <p className="text-xs text-[var(--color-muted-foreground)]">{card.label}</p>
            <p className="text-lg font-semibold font-mono">฿{card.value}</p>
          </div>
        ))}
      </div>

      {/* Employee items */}
      {run.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Employee</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Base (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Gross (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">SSC (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">PIT (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Net (฿)</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono text-xs">{item.employeeId}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(item.baseSalarySatang)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(item.grossSatang)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{formatBaht(item.socialSecuritySatang)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{formatBaht(item.personalIncomeTaxSatang)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-400">
                    {formatBaht(item.netSatang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
