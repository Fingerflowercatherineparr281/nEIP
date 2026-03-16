'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, Send } from 'lucide-react';
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

interface PurchaseOrder {
  id: string;
  documentNumber: string;
  vendorId: string;
  totalSatang: string;
  orderDate: string;
  status: DocumentStatusValue;
}

interface PurchaseOrderListResponse {
  items: PurchaseOrder[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Partial Received', value: 'partial_received' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function PurchaseOrdersPage(): React.JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sendTarget, setSendTarget] = useState<PurchaseOrder | null>(null);
  const [sending, setSending] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading, refetch } = useApi<PurchaseOrderListResponse>('/purchase-orders', params);
  const orders = data?.items ?? [];

  const handleSend = useCallback(async () => {
    if (!sendTarget) return;
    setSending(true);
    try {
      await api.post(`/purchase-orders/${sendTarget.id}/send`);
      showToast.success(`Purchase order ${sendTarget.documentNumber} sent`);
      setSendTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to send purchase order');
    } finally {
      setSending(false);
    }
  }, [sendTarget, refetch]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Purchase Orders</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">ใบสั่งซื้อ — Manage purchase orders</p>
        </div>
        <Link href="/purchase-orders/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        </Link>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search purchase orders..."
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
          context="purchase-order-list"
          ctaLabel="Create Purchase Order"
          onCtaClick={() => router.push('/purchase-orders/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id} className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono-figures font-medium">{po.documentNumber}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{po.vendorId}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(po.totalSatang)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {new Date(po.orderDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3"><DocumentStatus status={po.status} size="sm" /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/purchase-orders/${po.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /> View</Button>
                      </Link>
                      {po.status === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => setSendTarget(po)}>
                          <Send className="h-3.5 w-3.5" /> Send
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
        open={sendTarget !== null}
        onOpenChange={(open) => { if (!open) setSendTarget(null); }}
        title="Send Purchase Order"
        description={`Send purchase order ${sendTarget?.documentNumber ?? ''} to vendor?`}
        confirmLabel="Send"
        confirmVariant="primary"
        onConfirm={handleSend}
        loading={sending}
      />
    </div>
  );
}
