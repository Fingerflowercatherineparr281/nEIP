'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, Ban, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Bill {
  id: string;
  documentNumber: string;
  vendorId: string;
  /** Amount in satang */
  totalSatang: number;
  paidSatang: number;
  dueDate: string;
  status: DocumentStatusValue;
}

interface BillListResponse {
  items: Bill[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Posted', value: 'posted' },
  { label: 'Partial', value: 'partial' },
  { label: 'Paid', value: 'paid' },
  { label: 'Voided', value: 'voided' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillsPage(): React.JSX.Element {
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Void dialog
  const [voidTarget, setVoidTarget] = useState<Bill | null>(null);
  const [voiding, setVoiding] = useState(false);

  // Post dialog
  const [postTarget, setPostTarget] = useState<Bill | null>(null);
  const [posting, setPosting] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading, refetch } = useApi<BillListResponse>('/bills', params);
  const bills = data?.items ?? [];

  const handleVoid = useCallback(async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await api.post(`/bills/${voidTarget.id}/void`);
      showToast.success(`Bill ${voidTarget.documentNumber} voided`);
      setVoidTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to void bill');
    } finally {
      setVoiding(false);
    }
  }, [voidTarget, refetch]);

  const handlePost = useCallback(async () => {
    if (!postTarget) return;
    setPosting(true);
    try {
      await api.post(`/bills/${postTarget.id}/post`);
      showToast.success(`Bill ${postTarget.documentNumber} posted`);
      setPostTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to post bill');
    } finally {
      setPosting(false);
    }
  }, [postTarget, refetch]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Bills</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage vendor bills and expenses
          </p>
        </div>
        <Link href="/bills/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Bill
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bills..."
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
      ) : bills.length === 0 ? (
        <EmptyState
          context="bill-list"
          ctaLabel="Create Bill"
          onCtaClick={() => router.push('/bills/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-mono-figures font-medium">
                    {bill.documentNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {bill.vendorId}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(bill.totalSatang)} size="sm" />
                  </td>
                  <td className={cn(
                    'px-4 py-3',
                    new Date(bill.dueDate) < new Date() && bill.status !== 'voided' && bill.status !== 'paid'
                      ? 'text-[var(--color-overdue)] font-medium'
                      : 'text-[var(--color-muted-foreground)]',
                  )}>
                    {new Date(bill.dueDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatus status={bill.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/bills/${bill.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      {bill.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPostTarget(bill)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Post
                        </Button>
                      )}
                      {(bill.status === 'draft' || bill.status === 'posted') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoidTarget(bill)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Void
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

      {/* Void Confirm Dialog */}
      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
        title="Void Bill"
        description={`Are you sure you want to void bill ${voidTarget?.documentNumber ?? ''}? This action cannot be undone.`}
        confirmLabel="Void Bill"
        confirmVariant="destructive"
        onConfirm={handleVoid}
        loading={voiding}
      />

      {/* Post Confirm Dialog */}
      <ConfirmDialog
        open={postTarget !== null}
        onOpenChange={(open) => { if (!open) setPostTarget(null); }}
        title="Post Bill"
        description={`Are you sure you want to post bill ${postTarget?.documentNumber ?? ''}? Once posted, the bill cannot be edited.`}
        confirmLabel="Post Bill"
        confirmVariant="primary"
        onConfirm={handlePost}
        loading={posting}
      />
    </div>
  );
}
