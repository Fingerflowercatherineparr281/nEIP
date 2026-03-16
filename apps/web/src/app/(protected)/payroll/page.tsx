'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface PayrollRun {
  id: string; payPeriodStart: string; payPeriodEnd: string;
  runDate: string; status: string;
  totalGrossSatang: number; totalNetSatang: number;
  totalDeductionsSatang: number;
}

interface PayrollListResponse { items: PayrollRun[]; total: number; }

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  calculated: 'bg-blue-100 text-blue-700',
  approved: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};

function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';

export default function PayrollPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newRun, setNewRun] = useState({ payPeriodStart: '', payPeriodEnd: '', runDate: new Date().toISOString().split('T')[0] ?? '' });

  const { data, isLoading } = useQuery<PayrollListResponse>({
    queryKey: [tenantId, 'payroll'],
    queryFn: () => api.get<PayrollListResponse>('/payroll'),
  });

  const createMutation = useMutation({
    mutationFn: (d: typeof newRun) => api.post('/payroll', d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'payroll'] });
      setCreateOpen(false);
      showToast.success('Payroll run created');
    },
    onError: (err: Error) => showToast.error(err instanceof AppError ? err.message : 'Failed'),
  });

  const runs = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Monthly payroll processing runs</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />New Run
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRow count={4} />
      ) : runs.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No payroll runs yet"
          description="Create your first payroll run."
          ctaLabel="New Run"
          onCtaClick={() => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Period</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Run Date</th>
                <th className="px-4 py-3 text-center font-medium text-[var(--color-muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Gross (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Net (฿)</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-medium">
                    {run.payPeriodStart} — {run.payPeriodEnd}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{run.runDate}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[run.status] ?? ''}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(run.totalGrossSatang)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(run.totalNetSatang)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/payroll/${run.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New Payroll Run">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newRun); }} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Pay Period Start</label>
            <input type="date" value={newRun.payPeriodStart} onChange={(e) => setNewRun((p) => ({ ...p, payPeriodStart: e.target.value }))} className={inputClasses} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Pay Period End</label>
            <input type="date" value={newRun.payPeriodEnd} onChange={(e) => setNewRun((p) => ({ ...p, payPeriodEnd: e.target.value }))} className={inputClasses} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Run Date</label>
            <input type="date" value={newRun.runDate} onChange={(e) => setNewRun((p) => ({ ...p, runDate: e.target.value }))} className={inputClasses} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
