'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Package, FileText, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';

interface PoLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  receivedQuantity: number;
  unitPriceSatang: string;
  amountSatang: string;
  accountId: string | null;
}

type PoStatus = DocumentStatusValue | 'confirmed' | 'sent' | 'partial_received' | 'received' | 'cancelled';

interface PurchaseOrder {
  id: string;
  documentNumber: string;
  vendorId: string;
  status: PoStatus;
  orderDate: string;
  expectedDate: string | null;
  totalSatang: string;
  notes: string | null;
  convertedBillId: string | null;
  lines: PoLine[];
  createdAt: string;
}

interface ReceiveLine {
  lineId: string;
  quantityReceived: string;
}

function ReceiveGoodsDialog({ open, onOpenChange, po, onSubmit, loading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  onSubmit: (lines: Array<{ lineId: string; quantityReceived: number }>) => void;
  loading: boolean;
}): React.JSX.Element {
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>(
    po.lines.map((l) => ({ lineId: l.id, quantityReceived: String(l.quantity - l.receivedQuantity) })),
  );

  const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const lines = receiveLines
      .filter((l) => parseFloat(l.quantityReceived) > 0)
      .map((l) => ({ lineId: l.lineId, quantityReceived: parseFloat(l.quantityReceived) }));
    if (lines.length === 0) { return; }
    onSubmit(lines);
  }, [receiveLines, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Record Received Goods">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">Enter quantities received for each line item.</p>
        {po.lines.map((line, i) => (
          <div key={line.id} className="grid grid-cols-[1fr_7rem] gap-3 items-center">
            <div>
              <p className="text-sm font-medium">{line.description}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Ordered: {line.quantity} | Already received: {line.receivedQuantity}</p>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              max={line.quantity - line.receivedQuantity}
              value={receiveLines[i]?.quantityReceived ?? '0'}
              onChange={(e) => setReceiveLines((prev) => prev.map((l, idx) => idx === i ? { ...l, quantityReceived: e.target.value } : l))}
              className={inputClasses}
            />
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={loading}>Record Receipt</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function PurchaseOrderDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const poId = params.id;
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { data: po, isLoading } = useQuery<PurchaseOrder>({
    queryKey: ['po', tenantId, poId],
    queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${poId}`),
    enabled: !!poId,
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${poId}/send`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['po', tenantId, poId] });
      showToast.success('Purchase order sent');
    },
    onError: (err: Error) => { showToast.error(err instanceof AppError ? err.message : 'Failed'); },
  });

  const receiveMutation = useMutation({
    mutationFn: (lines: Array<{ lineId: string; quantityReceived: number }>) =>
      api.post(`/purchase-orders/${poId}/receive`, { lines }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['po', tenantId, poId] });
      setReceiveOpen(false);
      showToast.success('Goods received recorded');
    },
    onError: (err: Error) => { showToast.error(err instanceof AppError ? err.message : 'Failed'); },
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${poId}/convert-to-bill`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['po', tenantId, poId] });
      showToast.success('Bill created from purchase order');
    },
    onError: (err: Error) => { showToast.error(err instanceof AppError ? err.message : 'Failed'); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${poId}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['po', tenantId, poId] });
      showToast.success('Purchase order cancelled');
    },
    onError: (err: Error) => { showToast.error(err instanceof AppError ? err.message : 'Failed'); },
  });

  if (isLoading) return <div className="p-4 lg:p-6"><SkeletonCard variant="default" count={3} /></div>;

  if (!po) {
    return (
      <div className="p-4 lg:p-6">
        <InlineAlert variant="error" message="Purchase order not found." />
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  const canReceive = ['sent', 'partial_received'].includes(po.status);
  const canConvert = ['sent', 'partial_received', 'received'].includes(po.status) && !po.convertedBillId;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-start justify-between">
        <div>
          <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            <ArrowLeft className="h-4 w-4" /> Back to Purchase Orders
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{po.documentNumber}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Vendor: {po.vendorId}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DocumentStatus status={po.status as DocumentStatusValue} />
          {po.status === 'draft' && (
            <>
              <Button variant="primary" onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
                <Send className="h-4 w-4" /> Send to Vendor
              </Button>
              <Button variant="outline" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            </>
          )}
          {po.status === 'sent' && (
            <Button variant="outline" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          )}
          {canReceive && (
            <Button variant="outline" onClick={() => setReceiveOpen(true)}>
              <Package className="h-4 w-4" /> Receive Goods
            </Button>
          )}
          {canConvert && (
            <Button variant="outline" onClick={() => convertMutation.mutate()} loading={convertMutation.isPending}>
              <FileText className="h-4 w-4" /> Convert to Bill
            </Button>
          )}
        </div>
      </div>

      {po.convertedBillId && (
        <InlineAlert variant="info" message={`This PO has been converted to bill ${po.convertedBillId}`} />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Total</p>
          <div className="mt-1"><MoneyDisplay amount={BigInt(po.totalSatang)} size="md" /></div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Order Date</p>
          <p className="mt-1 text-base font-medium">{new Date(po.orderDate).toLocaleDateString('th-TH')}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Expected Date</p>
          <p className="mt-1 text-base font-medium">
            {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('th-TH') : '-'}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Lines</p>
          <p className="mt-1 text-base font-medium">{po.lines.length}</p>
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
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Ordered</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Received</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{line.lineNumber}</td>
                  <td className="px-4 py-3">{line.description}</td>
                  <td className="px-4 py-3 text-right">{line.quantity}</td>
                  <td className={cn('px-4 py-3 text-right font-medium', line.receivedQuantity >= line.quantity ? 'text-green-600' : '')}>
                    {line.receivedQuantity}
                  </td>
                  <td className="px-4 py-3 text-right"><MoneyDisplay amount={BigInt(line.unitPriceSatang)} size="sm" /></td>
                  <td className="px-4 py-3 text-right"><MoneyDisplay amount={BigInt(line.amountSatang)} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {po.notes && (
        <div>
          <h2 className="mb-1 text-base font-semibold">Notes</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">{po.notes}</p>
        </div>
      )}

      {canReceive && (
        <ReceiveGoodsDialog
          open={receiveOpen}
          onOpenChange={setReceiveOpen}
          po={po}
          onSubmit={(lines) => receiveMutation.mutate(lines)}
          loading={receiveMutation.isPending}
        />
      )}
    </div>
  );
}
