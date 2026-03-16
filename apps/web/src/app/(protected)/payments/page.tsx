'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { MoneyDisplay } from '@/components/domain/money-display';
import { CreditCard } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payment {
  id: string;
  paymentNumber: string;
  customerId: string;
  /** Amount in satang — API returns string */
  amountSatang: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  /** API returns 'unmatched' | 'matched' | 'voided' */
  status: string;
  invoiceId: string | null;
}

/** Map API payment status to a display-friendly label */
function formatPaymentStatus(s: string): string {
  const labels: Record<string, string> = {
    unmatched: 'Unmatched',
    matched: 'Matched',
    voided: 'Voided',
    void: 'Voided',
    pending: 'Pending',
    approved: 'Approved',
  };
  return labels[s] ?? s;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unmatched: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  matched: 'bg-green-50 text-green-700 border border-green-200',
  voided: 'bg-red-50 text-red-700 border border-red-200',
  void: 'bg-red-50 text-red-700 border border-red-200',
  pending: 'bg-gray-50 text-gray-700 border border-gray-200',
  approved: 'bg-blue-50 text-blue-700 border border-blue-200',
};

interface PaymentListResponse {
  items: Payment[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Unmatched', value: 'unmatched' },
  { label: 'Matched', value: 'matched' },
  { label: 'Voided', value: 'voided' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PaymentsPage(): React.JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading } = useApi<PaymentListResponse>('/payments', params);
  const payments = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Payments</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Record and match payments to invoices
          </p>
        </div>
        <Link href="/payments/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search payments..."
        statusOptions={STATUS_OPTIONS}
        statusValue={status}
        onStatusChange={setStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        resultCount={data?.total}
      />

      {/* Table */}
      {loading ? (
        <SkeletonRow count={5} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          message="No payments found"
          description="No payments match the current filters."
          ctaLabel="Record Payment"
          onCtaClick={() => router.push('/payments/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Payment Number</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pmt) => (
                <tr
                  key={pmt.id}
                  className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-mono-figures font-medium">
                    {pmt.paymentNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {pmt.customerId}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(pmt.amountSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {new Date(pmt.paymentDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)] capitalize">
                    {pmt.paymentMethod.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ${PAYMENT_STATUS_COLORS[pmt.status] ?? 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                      {formatPaymentStatus(pmt.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {pmt.invoiceId ? (
                      <Link
                        href={`/invoices/${pmt.invoiceId}`}
                        className="font-mono-figures text-[var(--color-primary)] hover:underline"
                      >
                        {pmt.invoiceId.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-[var(--color-muted-foreground)]">--</span>
                    )}
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
