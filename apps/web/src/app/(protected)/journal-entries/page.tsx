'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FilterBar } from '@/components/ui/filter-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus, type DocumentStatusValue } from '@/components/domain/document-status';
import { api, AppError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalEntryLine {
  debitSatang?: number;
  creditSatang?: number;
}

interface JournalEntry {
  id: string;
  documentNumber: string;
  createdAt: string;
  description: string;
  lines: JournalEntryLine[];
  status: DocumentStatusValue;
}

interface JournalEntryListResponse {
  items: JournalEntry[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Posted', value: 'posted' },
  { label: 'Voided', value: 'voided' },
];

// ---------------------------------------------------------------------------
// Journal Entries List Page
// ---------------------------------------------------------------------------

export default function JournalEntriesPage(): React.JSX.Element {
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Action dialog state
  const [postTarget, setPostTarget] = useState<JournalEntry | null>(null);
  const [reverseTarget, setReverseTarget] = useState<JournalEntry | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (statusFilter) params['status'] = statusFilter;
    return params;
  }, [search, statusFilter]);

  const { data, isLoading } = useQuery<JournalEntryListResponse>({
    queryKey: queryKeys.journalEntryList(tenantId, filters),
    queryFn: () => api.get<JournalEntryListResponse>('/journal-entries', filters),
  });

  const entries = data?.items ?? [];

  // Post mutation
  const postMutation = useMutation({
    mutationFn: (id: string) => api.post(`/journal-entries/${id}/post`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.journalEntries(tenantId) });
      setPostTarget(null);
      showToast.success('Journal entry posted');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to post');
    },
  });

  // Reverse mutation
  const reverseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/journal-entries/${id}/reverse`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.journalEntries(tenantId) });
      setReverseTarget(null);
      showToast.success('Journal entry reversed');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to reverse');
    },
  });

  const formatDate = useCallback((iso: string) => {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
        <Button variant="primary" onClick={() => router.push('/journal-entries/new')}>
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search doc number or memo..."
        statusOptions={STATUS_OPTIONS}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        resultCount={data?.total ?? 0}
        className="mb-4"
      />

      {/* Table */}
      {isLoading ? (
        <SkeletonRow count={6} />
      ) : entries.length === 0 ? (
        <EmptyState
          message="No journal entries"
          description={search || statusFilter ? 'Try adjusting your filters.' : 'Create your first journal entry.'}
          {...(!search && !statusFilter ? { ctaLabel: 'New Entry', onCtaClick: () => router.push('/journal-entries/new') } : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doc Number</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Memo</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total Amount</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => router.push(`/journal-entries/${entry.id}`)}
                      className="text-primary hover:underline"
                    >
                      {entry.documentNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
                  <td className="hidden max-w-[200px] truncate px-4 py-3 text-muted-foreground md:table-cell">
                    {entry.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay
                      amount={BigInt(
                        entry.lines.reduce((sum, l) => sum + (l.debitSatang ?? 0), 0),
                      )}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatus status={entry.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {(entry.status === 'draft' || entry.status === 'pending') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPostTarget(entry)}
                          aria-label={`Post ${entry.documentNumber}`}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {entry.status === 'posted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReverseTarget(entry)}
                          aria-label={`Reverse ${entry.documentNumber}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
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

      {/* Post confirmation */}
      <ConfirmDialog
        open={postTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPostTarget(null);
        }}
        title="Post Journal Entry"
        description={`Post ${postTarget?.documentNumber ?? ''} to the general ledger? This will update account balances.`}
        confirmLabel="Post"
        confirmVariant="primary"
        onConfirm={() => {
          if (postTarget) postMutation.mutate(postTarget.id);
        }}
        loading={postMutation.isPending}
      />

      {/* Reverse confirmation */}
      <ConfirmDialog
        open={reverseTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReverseTarget(null);
        }}
        title="Reverse Journal Entry"
        description={`Create a reversing entry for ${reverseTarget?.documentNumber ?? ''}? This will create a new entry with opposite debits and credits.`}
        confirmLabel="Reverse"
        confirmVariant="destructive"
        onConfirm={() => {
          if (reverseTarget) reverseMutation.mutate(reverseTarget.id);
        }}
        loading={reverseMutation.isPending}
      />
    </div>
  );
}
