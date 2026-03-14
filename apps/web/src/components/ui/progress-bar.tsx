'use client';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressBarProps {
  /** Current value (0–100 or raw count). */
  value: number;
  /** Maximum value (default 100). */
  max?: number;
  /** Optional label shown above the bar. */
  label?: string;
  /** Show the numeric value/max text. */
  showValue?: boolean;
  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProgressBar — a linear progress indicator.
 *
 * Designed for AI processing progress feedback:
 * "Processing... 73/100 items"
 *
 * @example
 * <ProgressBar value={73} max={100} label="Processing..." showValue />
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  className,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.min(max, Math.max(0, value));
  const percentage = max > 0 ? (clamped / max) * 100 : 0;

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          {label && (
            <span className="text-[var(--color-muted-foreground)]">
              {label}
            </span>
          )}
          {showValue && (
            <span className="font-mono-figures text-xs text-[var(--color-muted-foreground)]">
              {clamped}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={
          label
            ? `${label} ${clamped} of ${max}`
            : `${clamped} of ${max}`
        }
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
