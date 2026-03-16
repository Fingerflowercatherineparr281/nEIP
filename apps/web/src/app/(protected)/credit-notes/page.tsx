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

/** Map API status to DocumentStatusValue ('void' → 'voided') */
function mapStatus(s: string): DocumentStatusValue {
  const map: Record<string, DocumentStatusValue> = { void: 'voided', converted: 'approved', expired: 'rejected' };
  return (map[s] ?? s) as DocumentStatusValue;
}

interface CreditNote {
  id: string;
  documentNumber: string;
  customerName: string;
  totalSatang: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface CreditNoteListResponse {
  items: CreditNote[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Issued', value: 'issued' },
  { label: 'Voided', value: 'voided' },
];

export default function CreditNotesPage(): React.JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [issueTarget, setIssueTarget] = useState<CreditNote | null>(null);
  const [issuing, setIssuing] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    return p;
  }, [search, status, dateFrom, dateTo]);

  const { data, loading, refetch } = useApi<CreditNoteListResponse>('/credit-notes', params);
  const creditNotes = data?.items ?? [];

  const handleIssue = useCallback(async () => {
    if (!issueTarget) return;
    setIssuing(true);
    try {
      await api.post(`/credit-notes/${issueTarget.id}/issue`);
      showToast.success(`Credit note ${issueTarget.documentNumber} issued`);
      setIssueTarget(null);
      refetch();
    } catch {
      showToast.error('Failed to issue credit note');
    } finally {
      setIssuing(false);
    }
  }, [issueTarget, refetch]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Credit Notes</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">ใบลดหนี้ — Reduce customer outstanding balance</p>
        </div>
        <Link href="/credit-notes/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New Credit Note
          </Button>
        </Link>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search credit notes..."
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
      ) : creditNotes.length === 0 ? (
        <EmptyState
          context="credit-note-list"
          ctaLabel="Create Credit Note"
          onCtaClick={() => router.push('/credit-notes/new')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.map((cn) => (
                <tr key={cn.id} className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono-figures font-medium">{cn.documentNumber}</td>
                  <td className="px-4 py-3">{cn.customerName}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(cn.totalSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)] max-w-32 truncate">{cn.reason}</td>
                  <td className="px-4 py-3"><DocumentStatus status={mapStatus(cn.status)} size="sm" /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/credit-notes/${cn.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /> View</Button>
                      </Link>
                      {mapStatus(cn.status) === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => setIssueTarget(cn)}>
                          <CheckCircle className="h-3.5 w-3.5" /> Issue
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
        open={issueTarget !== null}
        onOpenChange={(open) => { if (!open) setIssueTarget(null); }}
        title="Issue Credit Note"
        description={`Issue credit note ${issueTarget?.documentNumber ?? ''}? This will create a reversing journal entry.`}
        confirmLabel="Issue"
        confirmVariant="primary"
        onConfirm={handleIssue}
        loading={issuing}
      />
    </div>
  );
}
