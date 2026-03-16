'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface DnLine {
  id: string;
  salesOrderLineId: string;
  description: string;
  quantityDelivered: number;
}

interface DeliveryNote {
  id: string;
  documentNumber: string;
  salesOrderId: string;
  customerId: string;
  customerName: string;
  status: DocumentStatusValue;
  deliveryDate: string;
  notes: string | null;
  lines: DnLine[];
  createdAt: string;
  updatedAt: string;
}

export default function DeliveryNoteDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const dnId = params.id;
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const { data: dn, isLoading } = useQuery<DeliveryNote>({
    queryKey: ['dn', tenantId, dnId],
    queryFn: () => api.get<DeliveryNote>(`/delivery-notes/${dnId}`),
    enabled: !!dnId,
  });

  const deliverMutation = useMutation({
    mutationFn: () => api.post(`/delivery-notes/${dnId}/deliver`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dn', tenantId, dnId] });
      showToast.success('Delivery note marked as delivered');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to mark as delivered');
    },
  });

  if (isLoading) return <div className="p-4 lg:p-6"><SkeletonCard variant="default" count={3} /></div>;

  if (!dn) {
    return (
      <div className="p-4 lg:p-6">
        <InlineAlert variant="error" message="Delivery note not found." />
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
            <ArrowLeft className="h-4 w-4" /> Back to Delivery Notes
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{dn.documentNumber}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{dn.customerName} — SO: {dn.salesOrderId.slice(0, 8)}...</p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentStatus status={dn.status} />
          {dn.status === 'draft' && (
            <Button variant="primary" onClick={() => deliverMutation.mutate()} loading={deliverMutation.isPending}>
              <Truck className="h-4 w-4" /> Mark Delivered
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Delivery Date</p>
          <p className="mt-1 text-base font-medium">{new Date(dn.deliveryDate).toLocaleDateString('th-TH')}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Customer</p>
          <p className="mt-1 text-base font-medium">{dn.customerName}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Lines</p>
          <p className="mt-1 text-base font-medium">{dn.lines.length}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Delivery Lines</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">SO Line ID</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Description</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Qty Delivered</th>
              </tr>
            </thead>
            <tbody>
              {dn.lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">{line.salesOrderLineId.slice(0, 8)}...</td>
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3 text-right font-medium">{line.quantityDelivered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dn.notes && (
        <div>
          <h2 className="mb-1 text-base font-semibold text-[var(--color-foreground)]">Notes</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">{dn.notes}</p>
        </div>
      )}
    </div>
  );
}
