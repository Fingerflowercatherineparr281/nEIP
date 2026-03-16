'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

type ReceiptStatus = DocumentStatusValue | 'issued' | 'voided';

interface Receipt {
  id: string;
  documentNumber: string;
  paymentId: string | null;
  invoiceId: string | null;
  customerId: string;
  customerName: string;
  amountSatang: string;
  receiptDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  status: ReceiptStatus;
  voidedAt: string | null;
  createdAt: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', promptpay: 'PromptPay', credit_card: 'Credit Card',
};

export default function ReceiptDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const receiptId = params.id;
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const { data: receipt, isLoading } = useQuery<Receipt>({
    queryKey: ['receipt', tenantId, receiptId],
    queryFn: () => api.get<Receipt>(`/receipts/${receiptId}`),
    enabled: !!receiptId,
  });

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/receipts/${receiptId}/void`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['receipt', tenantId, receiptId] });
      showToast.success('Receipt voided');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to void receipt');
    },
  });

  if (isLoading) return <div className="p-4 lg:p-6"><SkeletonCard variant="default" count={2} /></div>;

  if (!receipt) {
    return (
      <div className="p-4 lg:p-6">
        <InlineAlert variant="error" message="Receipt not found." />
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
            <ArrowLeft className="h-4 w-4" /> Back to Receipts
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{receipt.documentNumber}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{receipt.customerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentStatus status={receipt.status as DocumentStatusValue} />
          {receipt.status === 'issued' && (
            <Button variant="outline" onClick={() => voidMutation.mutate()} loading={voidMutation.isPending}>
              <Ban className="h-4 w-4" /> Void Receipt
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Amount</p>
          <div className="mt-1"><MoneyDisplay amount={BigInt(receipt.amountSatang)} size="md" /></div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Date</p>
          <p className="mt-1 text-base font-medium">{new Date(receipt.receiptDate).toLocaleDateString('th-TH')}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">Method</p>
          <p className="mt-1 text-base font-medium">{PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-foreground)]">Details</h2>
        {receipt.reference && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">Reference</span>
            <span className="font-medium">{receipt.reference}</span>
          </div>
        )}
        {receipt.invoiceId && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">Invoice ID</span>
            <span className="font-mono text-xs">{receipt.invoiceId}</span>
          </div>
        )}
        {receipt.paymentId && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">Payment ID</span>
            <span className="font-mono text-xs">{receipt.paymentId}</span>
          </div>
        )}
        {receipt.voidedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">Voided At</span>
            <span className="font-medium text-[var(--color-destructive)]">{new Date(receipt.voidedAt).toLocaleDateString('th-TH')}</span>
          </div>
        )}
        {receipt.notes && (
          <div>
            <p className="text-sm text-[var(--color-muted-foreground)]">Notes: {receipt.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
