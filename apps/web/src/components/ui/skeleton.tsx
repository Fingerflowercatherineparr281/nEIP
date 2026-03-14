'use client';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  /** Additional className forwarded to the root element. */
  className?: string;
}

export interface SkeletonRowProps {
  /** Number of skeleton rows to render. */
  count?: number;
  /** Additional className forwarded to each row. */
  className?: string;
}

export type SkeletonCardVariant = 'approval' | 'invoice' | 'default';

export interface SkeletonCardProps {
  /** Card layout variant that matches the shape of the target content. */
  variant?: SkeletonCardVariant;
  /** Number of skeleton cards to render. */
  count?: number;
  /** Additional className forwarded to each card. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Base Skeleton
// ---------------------------------------------------------------------------

/**
 * Skeleton — a single animated placeholder block.
 *
 * Renders a pulsing rectangle. Use className to control width/height.
 * Respects prefers-reduced-motion.
 *
 * @example
 * <Skeleton className="h-4 w-32" />
 * <Skeleton className="h-10 w-full rounded-lg" />
 */
export function Skeleton({ className }: SkeletonProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-[var(--color-muted)] motion-reduce:animate-none',
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// SkeletonRow — table row placeholder
// ---------------------------------------------------------------------------

/**
 * SkeletonRow — renders skeleton placeholders mimicking a table row layout.
 *
 * @example
 * <SkeletonRow count={5} />
 */
export function SkeletonRow({
  count = 1,
  className,
}: SkeletonRowProps): React.JSX.Element {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading rows">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-4 rounded-lg border border-[var(--color-border)] p-4',
            className,
          )}
        >
          {/* Checkbox */}
          <Skeleton className="h-5 w-5 rounded" />
          {/* Document ref */}
          <Skeleton className="h-4 w-24" />
          {/* Type badge */}
          <Skeleton className="h-5 w-16 rounded-md" />
          {/* Amount */}
          <Skeleton className="h-4 w-28" />
          {/* Confidence */}
          <Skeleton className="h-5 w-20 rounded-md" />
          {/* Description */}
          <Skeleton className="hidden h-4 w-40 md:block" />
          {/* Actions */}
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCard — card-shaped placeholder
// ---------------------------------------------------------------------------

/**
 * SkeletonCard — renders skeleton placeholders matching common card layouts.
 *
 * Variants:
 * - `approval` — matches ApprovalCard mobile layout
 * - `invoice` — matches invoice list card
 * - `default` — generic card shape
 *
 * @example
 * <SkeletonCard variant="approval" count={3} />
 */
export function SkeletonCard({
  variant = 'default',
  count = 1,
  className,
}: SkeletonCardProps): React.JSX.Element {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading cards">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4',
            className,
          )}
        >
          {variant === 'approval' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Skeleton className="h-10 flex-1 rounded-md" />
              </div>
            </div>
          )}
          {variant === 'invoice' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <Skeleton className="h-5 w-40" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
          )}
          {variant === 'default' && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
