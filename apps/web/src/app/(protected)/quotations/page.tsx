'use client';

import { useCallback, useMemo, useState } from 'react';
import { Eye, Plus, Copy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'converted' | 'expired';

interface Quotation {
  id: string;
  documentNumber: string;
  customerName: string;
  subject: string;
  totalSatang: string;
  validUntil: string;
  status: QuotationStatus;
}

interface QuotationListResponse {
  items: Quotation[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Approved',
  rejected: 'Rejected',
  converted: 'Converted',
  expired: 'Expired',
};

const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
  expired: 'bg-orange-100 text-orange-700',
};

function StatusBadge({ status }: { status: QuotationStatus }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Converted', value: 'converted' },
  { label: 'Expired', value: 'expired' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QuotationsPage(): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (status) p['status'] = status;
    return p;
  }, [status]);

  const { data, loading, refetch } = useApi<QuotationListResponse>(
    '/quotations',
    params,
  );
  const quotations = data?.items ?? [];

  const handleDuplicate = useCallback(
    async (id: string, docNumber: string) => {
      setDuplicating(id);
      try {
        const result = await api.post<{ id: string; documentNumber: string }>(
          `/quotations/${id}/duplicate`,
        );
        if ('id' in result) {
          showToast.success(`Duplicated as ${String((result as { documentNumber?: string }).documentNumber ?? '')}`);
          refetch();
        }
      } catch {
        showToast.error(`Failed to duplicate ${docNumber}`);
      } finally {
        setDuplicating(null);
      }
    },
    [refetch],
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            Quotations
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            ใบเสนอราคา — Manage customer quotations
          </p>
        </div>
        <Link href="/quotations/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Quotation
          </Button>
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              status === opt.value
                ? 'bg-slate-900 text-white'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:bg-slate-200',
            )}
          >
            {opt.label}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
            {data.total} quotation{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonRow count={5} />
      ) : quotations.length === 0 ? (
        <EmptyState
          context="quotation-list"
          ctaLabel="Create Quotation"
          onCtaClick={() => router.push('/quotations/new')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((qt) => {
                const isExpired =
                  qt.status !== 'converted' &&
                  qt.status !== 'rejected' &&
                  new Date(qt.validUntil) < new Date();

                return (
                  <tr
                    key={qt.id}
                    className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30"
                  >
                    <td className="px-4 py-3 font-medium font-mono text-xs">
                      {qt.documentNumber}
                    </td>
                    <td className="px-4 py-3">{qt.customerName}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-[var(--color-muted-foreground)]">
                      {qt.subject}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MoneyDisplay amount={BigInt(qt.totalSatang)} size="sm" />
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3',
                        isExpired
                          ? 'font-medium text-orange-600'
                          : 'text-[var(--color-muted-foreground)]',
                      )}
                    >
                      {new Date(qt.validUntil).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={isExpired && qt.status === 'sent' ? 'expired' : qt.status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link href={`/quotations/${qt.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={duplicating === qt.id}
                          onClick={() => void handleDuplicate(qt.id, qt.documentNumber)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Clone
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
