'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, CheckCircle } from 'lucide-react';
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

interface SalesOrder {
  id: string;
  documentNumber: string;
  customerName: string;
  totalSatang: string;
  orderDate: string;
  status: DocumentStatusValue;
}

interface SalesOrderListResponse {
  items: SalesOrder[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Partial Delivered', value: 'partial_delivered' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function SalesOrdersPage(): React.JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<SalesOrder | null>(null);
  const [confirming, setConfirming] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading, refetch } = useApi<SalesOrderListResponse>('/sales-orders', params);
  const orders = data?.items ?? [];

  const handleConfirm = useCallback(async () => {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      await api.post(`/sales-orders/${confirmTarget.id}/confirm`);
      showToast.success(`Sales order ${confirmTarget.documentNumber} confirmed`);
      setConfirmTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to confirm sales order');
    } finally {
      setConfirming(false);
    }
  }, [confirmTarget, refetch]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Sales Orders</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">ใบสั่งขาย — Manage customer sales orders</p>
        </div>
        <Link href="/sales-orders/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Sales Order
          </Button>
        </Link>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search sales orders..."
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
      ) : orders.length === 0 ? (
        <EmptyState
          context="sales-order-list"
          ctaLabel="Create Sales Order"
          onCtaClick={() => router.push('/sales-orders/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((so) => (
                <tr
                  key={so.id}
                  className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-mono-figures font-medium">{so.documentNumber}</td>
                  <td className="px-4 py-3">{so.customerName}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(so.totalSatang)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {new Date(so.orderDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatus status={so.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/sales-orders/${so.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      {so.status === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmTarget(so)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                          Confirm
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
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
        title="Confirm Sales Order"
        description={`Confirm sales order ${confirmTarget?.documentNumber ?? ''}?`}
        confirmLabel="Confirm"
        confirmVariant="primary"
        onConfirm={handleConfirm}
        loading={confirming}
      />
    </div>
  );
}
