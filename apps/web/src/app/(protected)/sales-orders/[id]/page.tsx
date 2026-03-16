'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, X, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface SoLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  deliveredQuantity: number;
  unitPriceSatang: string;
  amountSatang: string;
  accountId: string | null;
}

interface SalesOrder {
  id: string;
  documentNumber: string;
  customerId: string;
  customerName: string;
  status: DocumentStatusValue;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalSatang: string;
  quotationId: string | null;
  notes: string | null;
  lines: SoLine[];
  createdAt: string;
  updatedAt: string;
}

export default function SalesOrderDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const soId = params.id;
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const { data: so, isLoading } = useQuery<SalesOrder>({
    queryKey: ['so', tenantId, soId],
    queryFn: () => api.get<SalesOrder>(`/sales-orders/${soId}`),
    enabled: !!soId,
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/sales-orders/${soId}/confirm`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['so', tenantId, soId] });
      showToast.success('Sales order confirmed');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to confirm');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/sales-orders/${soId}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['so', tenantId, soId] });
      showToast.success('Sales order cancelled');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to cancel');
    },
  });

  if (isLoading) {
    return <div className="p-4 lg:p-6"><SkeletonCard variant="default" count={3} /></div>;
  }

  if (!so) {
    return (
      <div className="p-4 lg:p-6">
        <InlineAlert variant="error" message="Sales order not found." />
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
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Sales Orders
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{so.documentNumber}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{so.customerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentStatus status={so.status} />
          {so.status === 'draft' && (
            <>
              <Button variant="primary" onClick={() => confirmMutation.mutate()} loading={confirmMutation.isPending}>
                <CheckCircle className="h-4 w-4" /> Confirm
              </Button>
              <Button variant="outline" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            </>
          )}
          {['confirmed', 'partial_delivered'].includes(so.status) && (
            <Button variant="outline" onClick={() => router.push(`/delivery-notes/new?soId=${so.id}`)}>
              <Truck className="h-4 w-4" /> Create Delivery Note
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Total</p>
          <div className="mt-1"><MoneyDisplay amount={BigInt(so.totalSatang)} size="md" /></div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Order Date</p>
          <p className="mt-1 text-base font-medium text-[var(--color-foreground)]">
            {new Date(so.orderDate).toLocaleDateString('th-TH')}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Expected Delivery</p>
          <p className="mt-1 text-base font-medium text-[var(--color-foreground)]">
            {so.expectedDeliveryDate ? new Date(so.expectedDeliveryDate).toLocaleDateString('th-TH') : '-'}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Quotation Ref</p>
          <p className="mt-1 text-base font-medium text-[var(--color-foreground)]">{so.quotationId ?? '-'}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Line Items</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">#</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Description</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Delivered</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {so.lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{line.lineNumber}</td>
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3 text-right">{line.quantity}</td>
                  <td className="px-4 py-3 text-right">{line.deliveredQuantity}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(line.unitPriceSatang)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(line.amountSatang)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {so.notes && (
        <div>
          <h2 className="mb-1 text-base font-semibold text-[var(--color-foreground)]">Notes</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">{so.notes}</p>
        </div>
      )}
    </div>
  );
}
