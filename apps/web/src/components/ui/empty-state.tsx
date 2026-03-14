'use client';

import {
  FileSearch,
  Inbox,
  type LucideProps,
  PackageOpen,
  Search,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button, type ButtonProps } from './button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmptyStateContext =
  | 'approval-queue'
  | 'bill-list'
  | 'invoice-list'
  | 'search-results'
  | 'first-time';

export interface EmptyStateProps {
  /** Predefined context — sets default icon, message, and description. */
  context?: EmptyStateContext;
  /** Custom icon component (overrides context default). */
  icon?: React.ComponentType<LucideProps>;
  /** Main message (overrides context default). */
  message?: string;
  /** Secondary description (overrides context default). */
  description?: string;
  /** CTA button label. */
  ctaLabel?: string | undefined;
  /** CTA button click handler. */
  onCtaClick?: (() => void) | undefined;
  /** CTA button variant. */
  ctaVariant?: ButtonProps['variant'] | undefined;
  /** Additional className forwarded to the root element. */
  className?: string | undefined;
}

// ---------------------------------------------------------------------------
// Context defaults
// ---------------------------------------------------------------------------

interface ContextConfig {
  Icon: React.ComponentType<LucideProps>;
  message: string;
  description: string;
}

const CONTEXT_CONFIGS: Record<EmptyStateContext, ContextConfig> = {
  'approval-queue': {
    Icon: Sparkles,
    message: 'All caught up!',
    description: 'There are no items waiting for your approval.',
  },
  'bill-list': {
    Icon: Inbox,
    message: 'No bills found',
    description: 'No bills match the current filters.',
  },
  'invoice-list': {
    Icon: Inbox,
    message: 'No invoices found',
    description: 'No invoices match the current filters.',
  },
  'search-results': {
    Icon: Search,
    message: 'No results found',
    description: 'Try adjusting your search terms or filters.',
  },
  'first-time': {
    Icon: PackageOpen,
    message: 'Welcome to nEIP!',
    description: 'Get started by creating your first document or importing data.',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EmptyState — a placeholder component for empty views.
 *
 * Shows an icon, message, description, and optional CTA button.
 * Pre-configured contexts: approval-queue, invoice-list, search-results, first-time.
 *
 * @example
 * <EmptyState context="approval-queue" />
 * <EmptyState
 *   icon={FileSearch}
 *   message="No documents"
 *   description="Upload your first invoice to get started."
 *   ctaLabel="Upload Invoice"
 *   onCtaClick={() => router.push('/upload')}
 * />
 */
export function EmptyState({
  context,
  icon,
  message,
  description,
  ctaLabel,
  onCtaClick,
  ctaVariant = 'primary',
  className,
}: EmptyStateProps): React.JSX.Element {
  // Resolve context defaults, allow overrides.
  const contextConfig = context ? CONTEXT_CONFIGS[context] : undefined;
  const Icon = icon ?? contextConfig?.Icon ?? FileSearch;
  const displayMessage = message ?? contextConfig?.message ?? 'Nothing here yet';
  const displayDescription =
    description ?? contextConfig?.description ?? '';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-[var(--color-muted)] p-4">
        <Icon
          aria-hidden="true"
          className="h-8 w-8 text-[var(--color-muted-foreground)]"
        />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
        {displayMessage}
      </h3>
      {displayDescription && (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted-foreground)]">
          {displayDescription}
        </p>
      )}
      {ctaLabel && onCtaClick && (
        <Button
          variant={ctaVariant}
          onClick={onCtaClick}
          className="mt-6"
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
