'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow, SkeletonCard } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { showToast } from '@/components/ui/toast';
import { ApprovalCard } from '@/components/domain/approval-card';
import type { HitlZone } from '@/components/domain/confidence-indicator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalItem {
  id: string;
  documentRef: string;
  documentType: string;
  /** Amount in satang */
  amount: number;
  confidence: number;
  description: string;
  aiReasoning: string;
  status: string;
  createdAt: string;
}

interface ApprovalListResponse {
  data: ApprovalItem[];
  total: number;
}

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const CONFIDENCE_ZONES: HitlZone[] = ['auto', 'suggest', 'review', 'manual', 'blocked'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApprovalsPage(): React.JSX.Element {
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [zone, setZone] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Batch action dialogs
  const [showBatchApprove, setShowBatchApprove] = useState(false);
  const [showBatchReject, setShowBatchReject] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (status) p['status'] = status;
    if (dateFrom) p['dateFrom'] = dateFrom;
    if (dateTo) p['dateTo'] = dateTo;
    if (zone) p['zone'] = zone;
    return p;
  }, [search, status, dateFrom, dateTo, zone]);

  const { data, loading, refetch } = useApi<ApprovalListResponse>('/approvals', params);
  const items = data?.data ?? [];

  // Selection handlers
  const handleSelectChange = useCallback((id: string, isSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(
    async (id: string) => {
      try {
        await api.post(`/approvals/${id}/approve`);
        showToast.success('Item approved');
        refetch();
      } catch {
        showToast.error('Failed to approve');
      }
    },
    [refetch],
  );

  const handleReject = useCallback(
    async (id: string) => {
      try {
        await api.post(`/approvals/${id}/reject`);
        showToast.success('Item rejected');
        refetch();
      } catch {
        showToast.error('Failed to reject');
      }
    },
    [refetch],
  );

  const handleEdit = useCallback(
    (id: string) => {
      const item = items.find((it) => it.id === id);
      if (item) {
        const typePath = item.documentType === 'invoice' ? 'invoices' : 'journal-entries';
        router.push(`/${typePath}/${id}`);
      }
    },
    [items, router],
  );

  // Batch actions
  const handleBatchApprove = useCallback(async () => {
    setBatchLoading(true);
    try {
      await api.post('/approvals/batch-approve', { ids: Array.from(selected) });
      showToast.success(`${selected.size} items approved`);
      setSelected(new Set());
      setShowBatchApprove(false);
      refetch();
    } catch {
      showToast.error('Failed to approve items');
    } finally {
      setBatchLoading(false);
    }
  }, [selected, refetch]);

  const handleBatchReject = useCallback(async () => {
    setBatchLoading(true);
    try {
      await api.post('/approvals/batch-reject', { ids: Array.from(selected) });
      showToast.success(`${selected.size} items rejected`);
      setSelected(new Set());
      setShowBatchReject(false);
      refetch();
    } catch {
      showToast.error('Failed to reject items');
    } finally {
      setBatchLoading(false);
    }
  }, [selected, refetch]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in input fields
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === ' ' && items[focusIndex]) {
        e.preventDefault();
        const item = items[focusIndex]!;
        handleSelectChange(item.id, !selected.has(item.id));
      } else if (e.key === 'Enter' && items[focusIndex]) {
        e.preventDefault();
        handleConfirm(items[focusIndex]!.id);
      } else if (e.key === 'Delete' && items[focusIndex]) {
        e.preventDefault();
        handleReject(items[focusIndex]!.id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, focusIndex, selected, handleSelectChange, handleConfirm, handleReject]);

  // Focus management
  useEffect(() => {
    if (!listRef.current) return;
    const cards = listRef.current.querySelectorAll('[role="listitem"]');
    const card = cards[focusIndex];
    if (card instanceof HTMLElement) {
      card.focus();
    }
  }, [focusIndex]);

  const selectedCount = selected.size;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Approval Queue</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Review and approve pending documents
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search approvals..."
        statusOptions={STATUS_OPTIONS}
        statusValue={status}
        onStatusChange={setStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        confidenceZones={CONFIDENCE_ZONES}
        activeZone={zone}
        onZoneChange={setZone}
        resultCount={data?.total}
      />

      {/* Batch action bar */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-50)] px-4 py-2">
          <span className="text-sm font-medium text-[var(--color-foreground)]">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowBatchApprove(true)}
            >
              <Check className="h-3.5 w-3.5" />
              Approve Selected ({selectedCount})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBatchReject(true)}
            >
              <X className="h-3.5 w-3.5" />
              Reject Selected
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <SkeletonRow count={5} />
          </div>
          {/* Mobile */}
          <div className="lg:hidden">
            <SkeletonCard variant="approval" count={3} />
          </div>
        </>
      ) : items.length === 0 ? (
        <EmptyState context="approval-queue" />
      ) : (
        <>
          {/* Desktop list */}
          <div ref={listRef} role="list" className="hidden space-y-2 lg:block">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  'rounded-lg',
                  idx === focusIndex && 'ring-2 ring-[var(--color-ring)]',
                )}
              >
                <ApprovalCard
                  id={item.id}
                  documentRef={item.documentRef}
                  documentType={item.documentType}
                  amount={BigInt(item.amount)}
                  confidence={item.confidence}
                  description={item.description}
                  aiReasoning={item.aiReasoning}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                  onEdit={handleEdit}
                  selected={selected.has(item.id)}
                  onSelectChange={handleSelectChange}
                  variant="desktop"
                />
              </div>
            ))}
          </div>

          {/* Mobile list */}
          <div role="list" className="space-y-3 lg:hidden">
            {/* Mobile summary bar */}
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-muted)] px-3 py-2">
              <span className="text-sm font-medium text-[var(--color-foreground)]">
                {items.length} items
              </span>
              {selectedCount > 0 && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {selectedCount} selected
                </span>
              )}
            </div>

            {items.map((item) => (
              <ApprovalCard
                key={item.id}
                id={item.id}
                documentRef={item.documentRef}
                documentType={item.documentType}
                amount={BigInt(item.amount)}
                confidence={item.confidence}
                description={item.description}
                aiReasoning={item.aiReasoning}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onEdit={handleEdit}
                selected={selected.has(item.id)}
                onSelectChange={handleSelectChange}
                variant="mobile"
              />
            ))}

            {/* Fixed batch approve on mobile */}
            {selectedCount > 0 && (
              <div className="fixed bottom-[calc(44px+env(safe-area-inset-bottom)+0.5rem)] left-4 right-4 z-20">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setShowBatchApprove(true)}
                >
                  <Check className="h-4 w-4" />
                  Approve Selected ({selectedCount})
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Batch Approve Dialog */}
      <ConfirmDialog
        open={showBatchApprove}
        onOpenChange={setShowBatchApprove}
        title="Batch Approve"
        description={`Are you sure you want to approve ${selectedCount} selected items?`}
        confirmLabel="Approve All"
        confirmVariant="primary"
        onConfirm={handleBatchApprove}
        loading={batchLoading}
      />

      {/* Batch Reject Dialog */}
      <ConfirmDialog
        open={showBatchReject}
        onOpenChange={setShowBatchReject}
        title="Batch Reject"
        description={`Are you sure you want to reject ${selectedCount} selected items?`}
        confirmLabel="Reject All"
        confirmVariant="destructive"
        onConfirm={handleBatchReject}
        loading={batchLoading}
      />
    </div>
  );
}
