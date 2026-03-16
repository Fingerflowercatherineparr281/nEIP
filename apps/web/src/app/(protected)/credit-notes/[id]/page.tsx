'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface CnLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceSatang: string;
  amountSatang: string;
  accountId: string | null;
}

interface CreditNote {
  id: string;
  documentNumber: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  reason: string;
  totalSatang: string;
  status: DocumentStatusValue;
  notes: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  lines: CnLine[];
  createdAt: string;
}

export default function CreditNoteDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const cnId = params.id;
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const { data: cn, isLoading } = useQuery<CreditNote>({
    queryKey: ['cn', tenantId, cnId],
    queryFn: () => api.get<CreditNote>(`/credit-notes/${cnId}`),
    enabled: !!cnId,
  });

  const issueMutation = useMutation({
    mutationFn: () => api.post(`/credit-notes/${cnId}/issue`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cn', tenantId, cnId] });
      showToast.success('Credit note issued');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to issue');
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/credit-notes/${cnId}/void`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cn', tenantId, cnId] });
      showToast.success('Credit note voided');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to void');
    },
  });

  if (isLoading) return <div className="p-4 lg:p-6"><SkeletonCard variant="default" count={3} /></div>;

  if (!cn) {
    return (
      <div className="p-4 lg:p-6">
        <InlineAlert variant="error" message="Credit note not found." />
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-start justify-between">
        <div>
          <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            <ArrowLeft className="h-4 w-4" /> Back to Credit Notes
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{cn.documentNumber}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{cn.customerName} — Invoice: {cn.invoiceId.slice(0, 8)}...</p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentStatus status={cn.status} />
          {cn.status === 'draft' && (
            <Button variant="primary" onClick={() => issueMutation.mutate()} loading={issueMutation.isPending}>
              <CheckCircle className="h-4 w-4" /> Issue
            </Button>
          )}
          {cn.status !== 'voided' && (
            <Button variant="outline" onClick={() => voidMutation.mutate()} loading={voidMutation.isPending}>
              <Ban className="h-4 w-4" /> Void
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Total Credit</p>
          <div className="mt-1"><MoneyDisplay amount={BigInt(cn.totalSatang)} size="md" /></div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Reason</p>
          <p className="mt-1 text-base font-medium truncate">{cn.reason}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Issued At</p>
          <p className="mt-1 text-base font-medium">
            {cn.issuedAt ? new Date(cn.issuedAt).toLocaleDateString('th-TH') : '-'}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Credit Lines</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Description</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cn.lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3 text-right">{line.quantity}</td>
                  <td className="px-4 py-3 text-right"><MoneyDisplay amount={BigInt(line.unitPriceSatang)} size="sm" /></td>
                  <td className="px-4 py-3 text-right"><MoneyDisplay amount={BigInt(line.amountSatang)} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cn.notes && (
        <div>
          <h2 className="mb-1 text-base font-semibold">Notes</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">{cn.notes}</p>
        </div>
      )}
    </div>
  );
}
