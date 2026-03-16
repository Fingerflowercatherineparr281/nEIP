'use client';

import {
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  FileEdit,
  Send,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentStatusValue =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'voided'
  | 'paid'
  | 'partial'
  | 'sent'
  | 'confirmed'
  | 'partial_received'
  | 'received'
  | 'cancelled'
  | 'issued';

export type DocumentStatusSize = 'sm' | 'md' | 'lg';

export interface DocumentStatusProps {
  /** The workflow state of the document. */
  status: DocumentStatusValue;
  /** Visual size scale. */
  size?: DocumentStatusSize;
  /** Additional className forwarded to the badge root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Status configuration map
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  /** Tailwind utility classes for background, text, and border colours.
   *  These reference the theme tokens defined in globals.css via @theme. */
  colorClasses: string;
  /** Lucide icon component. */
  Icon: React.ComponentType<LucideProps>;
}

const STATUS_CONFIG: Record<DocumentStatusValue, StatusConfig> = {
  draft: {
    label: 'Draft',
    colorClasses:
      'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
    Icon: FileEdit,
  },
  pending: {
    label: 'Pending',
    colorClasses:
      'bg-[var(--color-hitl-review-bg)] text-[var(--color-hitl-review-foreground)] border-[var(--color-hitl-review)]',
    Icon: Clock,
  },
  approved: {
    label: 'Approved',
    colorClasses:
      'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)] border-[var(--color-hitl-auto)]',
    Icon: CheckCircle2,
  },
  posted: {
    label: 'Posted',
    colorClasses:
      'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)]',
    Icon: Send,
  },
  rejected: {
    label: 'Rejected',
    colorClasses:
      'bg-[var(--color-hitl-manual-bg)] text-[var(--color-hitl-manual-foreground)] border-[var(--color-hitl-manual)]',
    Icon: XCircle,
  },
  voided: {
    label: 'Voided',
    colorClasses:
      'bg-[var(--color-hitl-blocked-bg)] text-[var(--color-hitl-blocked)] border-[var(--color-hitl-blocked)]',
    Icon: Ban,
  },
  paid: {
    label: 'Paid',
    colorClasses:
      'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)] border-[var(--color-hitl-auto)]',
    Icon: Wallet,
  },
  partial: {
    label: 'Partial',
    colorClasses:
      'bg-[var(--color-hitl-review-bg)] text-[var(--color-hitl-review-foreground)] border-[var(--color-hitl-review)]',
    Icon: CircleDot,
  },
  sent: {
    label: 'Sent',
    colorClasses:
      'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)]',
    Icon: Send,
  },
  confirmed: {
    label: 'Confirmed',
    colorClasses:
      'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)] border-[var(--color-hitl-auto)]',
    Icon: CheckCircle2,
  },
  partial_received: {
    label: 'Partial Received',
    colorClasses:
      'bg-[var(--color-hitl-review-bg)] text-[var(--color-hitl-review-foreground)] border-[var(--color-hitl-review)]',
    Icon: CircleDot,
  },
  received: {
    label: 'Received',
    colorClasses:
      'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)] border-[var(--color-hitl-auto)]',
    Icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    colorClasses:
      'bg-[var(--color-hitl-blocked-bg)] text-[var(--color-hitl-blocked)] border-[var(--color-hitl-blocked)]',
    Icon: Ban,
  },
  issued: {
    label: 'Issued',
    colorClasses:
      'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)]',
    Icon: Send,
  },
};

// ---------------------------------------------------------------------------
// Size maps
// ---------------------------------------------------------------------------

const badgeSizeClasses: Record<DocumentStatusSize, string> = {
  sm: 'gap-1 rounded px-1.5 py-0.5 text-xs',
  md: 'gap-1.5 rounded-md px-2 py-1 text-sm',
  lg: 'gap-2 rounded-md px-3 py-1.5 text-base',
};

const iconSizeClasses: Record<DocumentStatusSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DocumentStatus — displays the workflow state of a document as a coloured
 * badge with a Lucide icon and a human-readable label.
 *
 * Six states: draft, pending, approved, posted, rejected, voided.
 * Each maps to distinct semantic colours from the global theme token set.
 *
 * @example
 * <DocumentStatus status="approved" size="md" />
 */
export function DocumentStatus({
  status,
  size = 'md',
  className,
}: DocumentStatusProps): React.JSX.Element {
  const { label, colorClasses, Icon } = STATUS_CONFIG[status];

  return (
    <span
      role="status"
      aria-label={`Document status: ${label}`}
      className={cn(
        'inline-flex shrink-0 items-center border font-medium',
        badgeSizeClasses[size],
        colorClasses,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('shrink-0', iconSizeClasses[size])}
      />
      <span>{label}</span>
    </span>
  );
}
