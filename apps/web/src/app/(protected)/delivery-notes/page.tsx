'use client';

import { useMemo, useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';

/** Map API status to DocumentStatusValue ('void' → 'voided') */
function mapStatus(s: string): DocumentStatusValue {
  const map: Record<string, DocumentStatusValue> = { void: 'voided', converted: 'approved', expired: 'rejected' };
  return (map[s] ?? s) as DocumentStatusValue;
}

interface DeliveryNote {
  id: string;
  documentNumber: string;
  customerName: string;
  salesOrderId: string;
  deliveryDate: string;
  status: string;
}

interface DeliveryNoteListResponse {
  items: DeliveryNote[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function DeliveryNotesPage(): React.JSX.Element {
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

  const { data, loading } = useApi<DeliveryNoteListResponse>('/delivery-notes', params);
  const notes = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Delivery Notes</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">ใบส่งของ — Manage delivery notes</p>
        </div>
        <Link href="/delivery-notes/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Delivery Note
          </Button>
        </Link>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search delivery notes..."
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
      ) : notes.length === 0 ? (
        <EmptyState
          context="delivery-note-list"
          ctaLabel="Create Delivery Note"
          onCtaClick={() => router.push('/delivery-notes/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sales Order</th>
                <th className="px-4 py-3">Delivery Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((dn) => (
                <tr key={dn.id} className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono-figures font-medium">{dn.documentNumber}</td>
                  <td className="px-4 py-3">{dn.customerName}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{dn.salesOrderId.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {new Date(dn.deliveryDate).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3"><DocumentStatus status={mapStatus(dn.status)} size="sm" /></td>
                  <td className="px-4 py-3">
                    <Link href={`/delivery-notes/${dn.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </Link>
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
