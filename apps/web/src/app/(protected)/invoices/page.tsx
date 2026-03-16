'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, Ban } from 'lucide-react';
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  /** Amount in satang */
  totalSatang: number;
  dueDate: string;
  status: string;
}

/** Map API status to DocumentStatusValue (API uses 'void', UI uses 'voided') */
function mapStatus(s: string): DocumentStatusValue {
  if (s === 'void') return 'voided';
  return s as DocumentStatusValue;
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Posted', value: 'posted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Voided', value: 'voided' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoicesPage(): React.JSX.Element {
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Void dialog
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading, refetch } = useApi<InvoiceListResponse>('/invoices', params);
  const invoices = data?.items ?? [];

  const handleVoid = useCallback(async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await api.post(`/invoices/${voidTarget.id}/void`);
      showToast.success(`Invoice ${voidTarget.invoiceNumber} voided`);
      setVoidTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to void invoice');
    } finally {
      setVoiding(false);
    }
  }, [voidTarget, refetch]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Invoices</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage customer invoices
          </p>
        </div>
        <Link href="/invoices/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoices..."
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
      ) : invoices.length === 0 ? (
        <EmptyState
          context="invoice-list"
          ctaLabel="Create Invoice"
          onCtaClick={() => router.push('/invoices/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Invoice Number</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-mono-figures font-medium">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {inv.customerId}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(inv.totalSatang ?? 0)} size="sm" />
                  </td>
                  <td className={cn(
                    'px-4 py-3',
                    new Date(inv.dueDate) < new Date() && inv.status !== 'voided' && inv.status !== 'posted'
                      ? 'text-[var(--color-overdue)] font-medium'
                      : 'text-[var(--color-muted-foreground)]',
                  )}>
                    {new Date(inv.dueDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatus status={mapStatus(inv.status)} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      {inv.status !== 'voided' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoidTarget(inv)}
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
        title="Void Invoice"
        description={`Are you sure you want to void invoice ${voidTarget?.invoiceNumber ?? ''}? This action cannot be undone.`}
        confirmLabel="Void Invoice"
        confirmVariant="destructive"
        onConfirm={handleVoid}
        loading={voiding}
      />
    </div>
  );
}
