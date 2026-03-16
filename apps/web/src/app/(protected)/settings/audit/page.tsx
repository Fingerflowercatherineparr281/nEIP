'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface AuditLogEntry {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: AuditChanges | null;
  requestId: string;
  timestamp: string;
}

interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface FilterState {
  resourceType: string;
  userId: string;
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_BADGE_CLASSES: Readonly<Record<string, string>> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function actionBadgeClasses(action: string): string {
  return (
    ACTION_BADGE_CLASSES[action] ??
    'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DetailsExpanderProps {
  changes: AuditChanges | null;
}

function DetailsExpander({ changes }: DetailsExpanderProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  if (changes === null || (changes.before === undefined && changes.after === undefined)) {
    return <span className="text-[var(--color-muted-foreground)] text-xs">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
          'border border-[var(--color-border)] text-[var(--color-foreground)]',
          'hover:bg-[var(--color-accent)]/40 transition-colors',
        )}
        aria-expanded={expanded}
      >
        Details
        {expanded ? (
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-xs font-mono text-[var(--color-foreground)]">
          {JSON.stringify(changes, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogPage(): React.JSX.Element {
  const router = useRouter();

  const [filters, setFilters] = useState<FilterState>({
    resourceType: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);

  const limit = 50;

  // Build query params — only include non-empty values
  const queryParams: Record<string, string> = {
    limit: String(limit),
    offset: String(page * limit),
  };
  if (filters.resourceType) queryParams['resourceType'] = filters.resourceType;
  if (filters.userId) queryParams['userId'] = filters.userId;
  if (filters.startDate) queryParams['startDate'] = new Date(filters.startDate).toISOString();
  if (filters.endDate) queryParams['endDate'] = new Date(filters.endDate).toISOString();

  const { data, loading, error, refetch } = useApi<AuditLogListResponse>(
    '/audit-logs',
    queryParams,
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(0);
    },
    [],
  );

  const handleApplyFilters = useCallback(() => {
    setPage(0);
    refetch();
  }, [refetch]);

  const handleClearFilters = useCallback(() => {
    setFilters({ resourceType: '', userId: '', startDate: '', endDate: '' });
    setPage(0);
  }, []);

  const inputClasses = cn(
    'h-9 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            aria-label="Back to settings"
          >
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
              Audit Log
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Immutable record of all system mutations
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <Filter className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Filters'}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label
                htmlFor="filter-resource"
                className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide"
              >
                Resource Type
              </label>
              <input
                id="filter-resource"
                type="text"
                value={filters.resourceType}
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                placeholder="e.g. invoice"
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="filter-user"
                className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide"
              >
                User ID
              </label>
              <input
                id="filter-user"
                type="text"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                placeholder="User UUID"
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="filter-start"
                className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide"
              >
                From
              </label>
              <input
                id="filter-start"
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="filter-end"
                className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-wide"
              >
                To
              </label>
              <input
                id="filter-end"
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={handleApplyFilters}>
              Apply
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error !== null && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          Failed to load audit logs: {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonRow count={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 whitespace-nowrap">User</th>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 whitespace-nowrap">Resource Type</th>
                <th className="px-4 py-3 whitespace-nowrap">Resource ID</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[var(--color-muted-foreground)]"
                  >
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                items.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-accent)]/20 align-top"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted-foreground)] text-xs font-mono">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate font-mono text-xs" title={entry.userId}>
                      {entry.userId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                          actionBadgeClasses(entry.action),
                        )}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium capitalize">
                      {entry.resourceType}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate font-mono text-xs" title={entry.resourceId}>
                      {entry.resourceId}
                    </td>
                    <td className="px-4 py-3">
                      <DetailsExpander changes={entry.changes} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-muted-foreground)]">
          <span>
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total} entries
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
