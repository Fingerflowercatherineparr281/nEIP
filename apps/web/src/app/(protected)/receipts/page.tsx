'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, Ban } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';

/** Map API status to DocumentStatusValue ('void' → 'voided') */
function mapStatus(s: string): DocumentStatusValue {
  const map: Record<string, DocumentStatusValue> = { void: 'voided', converted: 'approved', expired: 'rejected' };
  return (map[s] ?? s) as DocumentStatusValue;
}

interface Receipt {
  id: string;
  documentNumber: string;
  customerName: string;
  amountSatang: string;
  receiptDate: string;
  paymentMethod: string;
  status: string;
}

interface ReceiptListResponse {
  items: Receipt[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Issued', value: 'issued' },
  { label: 'Voided', value: 'voided' },
];

export default function ReceiptsPage(): React.JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [voidTarget, setVoidTarget] = useState<Receipt | null>(null);
  const [voiding, setVoiding] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading, refetch } = useApi<ReceiptListResponse>('/receipts', params);
  const receipts = data?.items ?? [];

  const handleVoid = useCallback(async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await api.post(`/receipts/${voidTarget.id}/void`);
      showToast.success(`Receipt ${voidTarget.documentNumber} voided`);
      setVoidTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to void receipt');
    } finally {
      setVoiding(false);
    }
  }, [voidTarget, refetch]);

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    promptpay: 'PromptPay',
    credit_card: 'Credit Card',
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Receipts</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">ใบเสร็จรับเงิน — Official payment receipts</p>
        </div>
        <Link href="/receipts/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Issue Receipt
          </Button>
        </Link>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search receipts..."
        statusOptions={STATUS_OPTIONS}
        statusValue={status}
        onStatusChange={setStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        resultCount={data?.total}
      />

      {loading ? (
        <SkeletonRow count={5} />
      ) : receipts.length === 0 ? (
        <EmptyState
          context="receipt-list"
          ctaLabel="Issue Receipt"
          onCtaClick={() => router.push('/receipts/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono-figures font-medium">{r.documentNumber}</td>
                  <td className="px-4 py-3">{r.customerName}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(r.amountSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {new Date(r.receiptDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
                  </td>
                  <td className="px-4 py-3"><DocumentStatus status={mapStatus(r.status)} size="sm" /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/receipts/${r.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /> View</Button>
                      </Link>
                      {mapStatus(r.status) === 'issued' && (
                        <Button variant="ghost" size="sm" onClick={() => setVoidTarget(r)}>
                          <Ban className="h-3.5 w-3.5" /> Void
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
        title="Void Receipt"
        description={`Are you sure you want to void receipt ${voidTarget?.documentNumber ?? ''}?`}
        confirmLabel="Void Receipt"
        confirmVariant="destructive"
        onConfirm={handleVoid}
        loading={voiding}
      />
    </div>
  );
}
