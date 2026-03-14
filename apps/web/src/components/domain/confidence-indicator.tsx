'use client';

import {
  AlertTriangle,
  Ban,
  BotMessageSquare,
  CircleUserRound,
  Sparkles,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfidenceSize = 'sm' | 'md' | 'lg';

export interface ConfidenceIndicatorProps {
  /** Confidence score in the range 0–100 (inclusive). */
  confidence: number;
  /** Visual size scale. */
  size?: ConfidenceSize;
  /** When true, renders the zone label text (e.g. "Auto"). */
  showLabel?: boolean;
  /** When true, renders the numeric percentage (e.g. "92%"). */
  showPercentage?: boolean;
  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// HITL Zone definitions
// UX-DR1: 5 zones mapped to the CSS custom properties in globals.css
// ---------------------------------------------------------------------------

export type HitlZone = 'auto' | 'suggest' | 'review' | 'manual' | 'blocked';

interface ZoneConfig {
  /** Zone identifier — drives CSS class selection and label text. */
  zone: HitlZone;
  /** Human-readable label. */
  label: string;
  /** Lucide icon that represents this confidence level. */
  Icon: React.ComponentType<LucideProps>;
  /** Tailwind utility classes that set the background + text colors from
   *  the --color-hitl-* CSS variables declared in globals.css @theme. */
  colorClasses: string;
}

const ZONE_CONFIGS: ZoneConfig[] = [
  {
    zone: 'auto',
    label: 'Auto',
    Icon: Sparkles,
    colorClasses:
      'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)]',
  },
  {
    zone: 'suggest',
    label: 'Suggest',
    Icon: BotMessageSquare,
    colorClasses:
      'bg-[var(--color-hitl-suggest-bg)] text-[var(--color-hitl-suggest-foreground)]',
  },
  {
    zone: 'review',
    label: 'Review',
    Icon: AlertTriangle,
    colorClasses:
      'bg-[var(--color-hitl-review-bg)] text-[var(--color-hitl-review-foreground)]',
  },
  {
    zone: 'manual',
    label: 'Manual',
    Icon: CircleUserRound,
    colorClasses:
      'bg-[var(--color-hitl-manual-bg)] text-[var(--color-hitl-manual-foreground)]',
  },
  {
    zone: 'blocked',
    label: 'Blocked',
    Icon: Ban,
    colorClasses:
      'bg-[var(--color-hitl-blocked)] text-[var(--color-hitl-blocked-foreground)]',
  },
];

// ---------------------------------------------------------------------------
// Zone thresholds
// Ranges: auto ≥90, suggest 75–89, review 50–74, manual 25–49, blocked <25
// ---------------------------------------------------------------------------

function getZoneConfig(confidence: number): ZoneConfig {
  // Guard: clamp to [0, 100].
  const clamped = Math.min(100, Math.max(0, confidence));

  if (clamped >= 90) return ZONE_CONFIGS[0]!; // auto
  if (clamped >= 75) return ZONE_CONFIGS[1]!; // suggest
  if (clamped >= 50) return ZONE_CONFIGS[2]!; // review
  if (clamped >= 25) return ZONE_CONFIGS[3]!; // manual
  return ZONE_CONFIGS[4]!;                     // blocked
}

// ---------------------------------------------------------------------------
// Size maps
// ---------------------------------------------------------------------------

const containerSizeClasses: Record<ConfidenceSize, string> = {
  sm: 'gap-1 rounded px-1.5 py-0.5 text-xs',
  md: 'gap-1.5 rounded-md px-2 py-1 text-sm',
  lg: 'gap-2 rounded-md px-3 py-1.5 text-base',
};

const iconSizeClasses: Record<ConfidenceSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ConfidenceIndicator — visualises an AI/OCR confidence score (0–100) using
 * the nEIP HITL (Human-in-the-Loop) five-zone colour system.
 *
 * Triple redundancy: icon + optional percentage + optional zone label.
 *
 * Zone thresholds (UX-DR1):
 *  - Auto    ≥ 90 — fully automated, no review needed (green)
 *  - Suggest 75–89 — AI suggestion, user confirms (yellow-green)
 *  - Review  50–74 — needs human review (orange)
 *  - Manual  25–49 — must be done manually (red)
 *  - Blocked  0–24 — blocked, cannot proceed (dark)
 *
 * @example
 * <ConfidenceIndicator confidence={92} showLabel showPercentage />
 * // → Sparkles icon + "92%" + "Auto" badge in green
 */
export function ConfidenceIndicator({
  confidence,
  size = 'md',
  showLabel = true,
  showPercentage = true,
  className,
}: ConfidenceIndicatorProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, confidence));
  const { label, Icon, colorClasses } = getZoneConfig(clamped);

  const ariaLabel = `Confidence: ${clamped}% — ${label}`;

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center font-medium',
        containerSizeClasses[size],
        colorClasses,
        className,
      )}
    >
      {/* 1 of 3 — Icon (zone-specific visual cue) */}
      <Icon
        aria-hidden="true"
        className={cn('shrink-0', iconSizeClasses[size])}
      />

      {/* 2 of 3 — Numeric percentage */}
      {showPercentage && (
        <span className="tabular-nums">{clamped}%</span>
      )}

      {/* 3 of 3 — Zone label */}
      {showLabel && (
        <span>{label}</span>
      )}
    </span>
  );
}
