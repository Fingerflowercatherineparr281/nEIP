'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { HitlZone } from '@/components/domain/confidence-indicator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  /** Current search text. */
  searchValue: string;
  /** Callback when search text changes (debounced internally). */
  onSearchChange: (value: string) => void;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;

  /** Status filter options. */
  statusOptions?: FilterOption[];
  /** Currently selected status value. */
  statusValue?: string;
  /** Callback when status filter changes. */
  onStatusChange?: (value: string) => void;

  /** Date range — start date ISO string. */
  dateFrom?: string;
  /** Callback when start date changes. */
  onDateFromChange?: (value: string) => void;
  /** Date range — end date ISO string. */
  dateTo?: string;
  /** Callback when end date changes. */
  onDateToChange?: (value: string) => void;

  /** Amount range — minimum (in satang display units). */
  amountMin?: string;
  /** Callback when min amount changes. */
  onAmountMinChange?: (value: string) => void;
  /** Amount range — maximum. */
  amountMax?: string;
  /** Callback when max amount changes. */
  onAmountMaxChange?: (value: string) => void;

  /** Quick filter badges for confidence zones. */
  confidenceZones?: HitlZone[];
  /** Currently active confidence zone filter (empty string = all). */
  activeZone?: string;
  /** Callback when confidence zone changes (empty string = all). */
  onZoneChange?: (zone: string) => void;

  /** Total result count — always visible. */
  resultCount?: number | undefined;

  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebouncedCallback(
  callback: (value: string) => void,
  delay: number,
): (value: string) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (value: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(value), delay);
    },
    [callback, delay],
  );
}

// ---------------------------------------------------------------------------
// Zone badge colors
// ---------------------------------------------------------------------------

const zoneBadgeClasses: Record<HitlZone, string> = {
  auto: 'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)] border-[var(--color-hitl-auto)]',
  suggest:
    'bg-[var(--color-hitl-suggest-bg)] text-[var(--color-hitl-suggest-foreground)] border-[var(--color-hitl-suggest)]',
  review:
    'bg-[var(--color-hitl-review-bg)] text-[var(--color-hitl-review-foreground)] border-[var(--color-hitl-review)]',
  manual:
    'bg-[var(--color-hitl-manual-bg)] text-[var(--color-hitl-manual-foreground)] border-[var(--color-hitl-manual)]',
  blocked:
    'bg-[var(--color-hitl-blocked-bg)] text-[var(--color-hitl-blocked)] border-[var(--color-hitl-blocked)]',
};

const zoneLabels: Record<HitlZone, string> = {
  auto: 'Auto',
  suggest: 'Suggest',
  review: 'Review',
  manual: 'Manual',
  blocked: 'Blocked',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FilterBar — table filter bar with search, dropdowns, date/amount ranges,
 * and quick filter badges for confidence zones.
 *
 * Features:
 * - Debounce 300ms on text input
 * - Filter state preserved in URL query params (managed by parent)
 * - Result count always visible
 * - Quick filter badges/tabs per confidence zone
 *
 * @example
 * <FilterBar
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   statusOptions={[{ label: "Pending", value: "pending" }]}
 *   statusValue={status}
 *   onStatusChange={setStatus}
 *   confidenceZones={['auto','suggest','review','manual','blocked']}
 *   activeZone={zone}
 *   onZoneChange={setZone}
 *   resultCount={42}
 * />
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  statusOptions,
  statusValue,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  amountMin,
  onAmountMinChange,
  amountMax,
  onAmountMaxChange,
  confidenceZones,
  activeZone,
  onZoneChange,
  resultCount,
  className,
}: FilterBarProps): React.JSX.Element {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debouncedSearch = useDebouncedCallback(onSearchChange, 300);

  // Sync external searchValue to local state
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalSearch(val);
      debouncedSearch(val);
    },
    [debouncedSearch],
  );

  const handleClearSearch = useCallback(() => {
    setLocalSearch('');
    onSearchChange('');
  }, [onSearchChange]);

  const inputClasses = useMemo(
    () =>
      cn(
        'h-9 rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
        'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
        'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
      ),
    [],
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Row 1: search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative min-w-[12rem] flex-1">
          <Search
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          />
          <input
            type="search"
            value={localSearch}
            onChange={handleSearchInput}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className={cn(inputClasses, 'pl-8 pr-8')}
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status dropdown */}
        {statusOptions && statusOptions.length > 0 && onStatusChange && (
          <select
            value={statusValue ?? ''}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by status"
            className={cn(inputClasses, 'w-auto min-w-[8rem]')}
          >
            <option value="">All statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Date range */}
        {onDateFromChange && (
          <input
            type="date"
            value={dateFrom ?? ''}
            onChange={(e) => onDateFromChange(e.target.value)}
            aria-label="Date from"
            className={cn(inputClasses, 'w-auto')}
          />
        )}
        {onDateToChange && (
          <input
            type="date"
            value={dateTo ?? ''}
            onChange={(e) => onDateToChange(e.target.value)}
            aria-label="Date to"
            className={cn(inputClasses, 'w-auto')}
          />
        )}

        {/* Amount range */}
        {onAmountMinChange && (
          <input
            type="number"
            value={amountMin ?? ''}
            onChange={(e) => onAmountMinChange(e.target.value)}
            placeholder="Min amount"
            aria-label="Minimum amount"
            className={cn(inputClasses, 'w-28')}
          />
        )}
        {onAmountMaxChange && (
          <input
            type="number"
            value={amountMax ?? ''}
            onChange={(e) => onAmountMaxChange(e.target.value)}
            placeholder="Max amount"
            aria-label="Maximum amount"
            className={cn(inputClasses, 'w-28')}
          />
        )}
      </div>

      {/* Row 2: confidence zone badges + result count */}
      {(confidenceZones || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Zone quick filters */}
          {confidenceZones && onZoneChange && (
            <>
              <button
                type="button"
                onClick={() => onZoneChange('')}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  (!activeZone || activeZone === '')
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]',
                )}
                aria-pressed={!activeZone || activeZone === ''}
              >
                All
              </button>
              {confidenceZones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => onZoneChange(zone)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    activeZone === zone
                      ? zoneBadgeClasses[zone]
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]',
                  )}
                  aria-pressed={activeZone === zone}
                >
                  {zoneLabels[zone]}
                </button>
              ))}
            </>
          )}

          {/* Result count */}
          {resultCount !== undefined && (
            <span
              className="ml-auto text-sm text-[var(--color-muted-foreground)]"
              aria-live="polite"
            >
              {resultCount} {resultCount === 1 ? 'result' : 'results'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
