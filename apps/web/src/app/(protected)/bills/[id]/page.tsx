'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';

/** Map API status values to DocumentStatusValue ('void' → 'voided') */
function mapStatus(s: string): DocumentStatusValue {
  const map: Record<string, DocumentStatusValue> = { void: 'voided', converted: 'approved', expired: 'rejected' };
  return (map[s] ?? s) as DocumentStatusValue;
}
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillLine {
  id: string;
  lineNumber: number;
  description: string;
  amountSatang: string;
  accountId: string;
}

interface Bill {
  id: string;
  documentNumber: string;
  vendorId: string;
  /** API may return 'void' instead of 'voided' */
  status: string;
  totalSatang: string;
  paidSatang: string;
  dueDate: string;
  notes: string | null;
  lines: BillLine[];
  createdAt: string;
  updatedAt: string;
}

interface BillPayment {
  id: string;
  documentNumber: string;
  billId: string;
  amountSatang: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  journalEntryId: string | null;
  billStatus: string;
  createdAt: string;
}

interface BillPaymentListResponse {
  items: BillPayment[];
  total: number;
}

type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'promptpay';

interface PayBillFormData {
  amountSatang: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
}

const PAYMENT_METHOD_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'PromptPay', value: 'promptpay' },
];

// ---------------------------------------------------------------------------
// Pay Bill Dialog
// ---------------------------------------------------------------------------

interface PayBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill;
  onSubmit: (data: PayBillFormData) => void;
  loading: boolean;
}

function PayBillDialog({
  open,
  onOpenChange,
  bill,
  onSubmit,
  loading,
}: PayBillDialogProps): React.JSX.Element {
  const remainingSatang = BigInt(bill.totalSatang) - BigInt(bill.paidSatang);
  const remainingBaht = (Number(remainingSatang) / 100).toFixed(2);

  const [amountBaht, setAmountBaht] = useState(remainingBaht);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors: string[] = [];
      const bahtNum = parseFloat(amountBaht);
      if (isNaN(bahtNum) || bahtNum <= 0) validationErrors.push('Amount must be positive');
      if (!paymentDate) validationErrors.push('Payment date is required');

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }
      setErrors([]);
      onSubmit({
        amountSatang: Math.round(bahtNum * 100).toString(),
        paymentDate,
        paymentMethod,
        reference,
      });
    },
    [amountBaht, paymentDate, paymentMethod, reference, onSubmit],
  );

  const handleClose = useCallback(() => {
    setAmountBaht(remainingBaht);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('bank_transfer');
    setReference('');
    setErrors([]);
    onOpenChange(false);
  }, [remainingBaht, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Pay Bill">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && <InlineAlert variant="error" message={errors.join(', ')} />}

        <div className="rounded-md bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Bill Total</span>
            <MoneyDisplay amount={BigInt(bill.totalSatang)} size="sm" />
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Already Paid</span>
            <MoneyDisplay amount={BigInt(bill.paidSatang)} size="sm" />
          </div>
          <div className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-1 font-medium">
            <span>Remaining</span>
            <MoneyDisplay amount={remainingSatang} size="sm" />
          </div>
        </div>

        <div>
          <label htmlFor="pay-amount" className="mb-1.5 block text-sm font-medium text-foreground">
            Payment Amount (THB) *
          </label>
          <input
            id="pay-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amountBaht}
            onChange={(e) => setAmountBaht(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="pay-date" className="mb-1.5 block text-sm font-medium text-foreground">
            Payment Date *
          </label>
          <input
            id="pay-date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="pay-method" className="mb-1.5 block text-sm font-medium text-foreground">
            Payment Method *
          </label>
          <select
            id="pay-method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className={inputClasses}
          >
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pay-ref" className="mb-1.5 block text-sm font-medium text-foreground">
            Reference
          </label>
          <input
            id="pay-ref"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. TRF-2026-001"
            className={inputClasses}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Record Payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const billId = params.id;
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const [payDialogOpen, setPayDialogOpen] = useState(false);

  const { data: bill, isLoading: billLoading } = useQuery<Bill>({
    queryKey: queryKeys.bill(tenantId, billId),
    queryFn: () => api.get<Bill>(`/bills/${billId}`),
    enabled: !!billId,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<BillPaymentListResponse>({
    queryKey: queryKeys.billPayments(tenantId, billId),
    queryFn: () => api.get<BillPaymentListResponse>('/bill-payments', { billId }),
    enabled: !!billId,
  });

  const payments = paymentsData?.items ?? [];

  const payMutation = useMutation({
    mutationFn: (data: PayBillFormData) =>
      api.post('/bill-payments', { billId, ...data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bill(tenantId, billId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billPayments(tenantId, billId) });
      setPayDialogOpen(false);
      showToast.success('Payment recorded successfully');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to record payment');
    },
  });

  if (billLoading) {
    return (
      <div className="p-4 lg:p-6">
        <SkeletonCard variant="default" count={3} />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-4 lg:p-6">
        <InlineAlert variant="error" message="Bill not found." />
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  const canPay = mapStatus(bill.status) === 'posted' || mapStatus(bill.status) === 'partial';

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    promptpay: 'PromptPay',
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Back button + header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bills
          </button>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            {bill.documentNumber}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Vendor ID: {bill.vendorId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentStatus status={mapStatus(bill.status)} />
          {canPay && (
            <Button variant="primary" onClick={() => setPayDialogOpen(true)}>
              <CreditCard className="h-4 w-4" />
              Pay Bill
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Total
          </p>
          <div className="mt-1">
            <MoneyDisplay amount={BigInt(bill.totalSatang)} size="md" />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Paid
          </p>
          <div className="mt-1">
            <MoneyDisplay amount={BigInt(bill.paidSatang)} size="md" />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Balance
          </p>
          <div className="mt-1">
            <MoneyDisplay
              amount={BigInt(bill.totalSatang) - BigInt(bill.paidSatang)}
              size="md"
            />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Due Date
          </p>
          <p className="mt-1 text-base font-medium text-[var(--color-foreground)]">
            {new Date(bill.dueDate).toLocaleDateString('th-TH')}
          </p>
        </div>
      </div>

      {/* Bill lines */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Bill Lines</h2>
        {(bill.lines ?? []).filter((line): line is NonNullable<typeof line> => line != null).length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">No line items.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(bill.lines ?? []).filter((line): line is NonNullable<typeof line> => line != null).map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {line.lineNumber}
                    </td>
                    <td className="px-4 py-3">{line.description}</td>
                    <td className="px-4 py-3 text-right">
                      <MoneyDisplay amount={BigInt(line.amountSatang || 0)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      {bill.notes && (
        <div>
          <h2 className="mb-1 text-base font-semibold text-[var(--color-foreground)]">Notes</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">{bill.notes}</p>
        </div>
      )}

      {/* Payment history */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">
          Payment History
        </h2>
        {paymentsLoading ? (
          <SkeletonCard variant="default" count={2} />
        ) : payments.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">
                    Method
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.reference ?? p.documentNumber}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(p.paymentDate).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-4 py-3">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoneyDisplay amount={BigInt(p.amountSatang)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pay Bill Dialog */}
      {canPay && (
        <PayBillDialog
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          bill={bill}
          onSubmit={(data) => payMutation.mutate(data)}
          loading={payMutation.isPending}
        />
      )}
    </div>
  );
}
