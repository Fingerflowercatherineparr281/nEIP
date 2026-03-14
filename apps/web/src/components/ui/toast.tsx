'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToasterProps {
  /** Additional className forwarded to the Sonner container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Toaster Provider
// ---------------------------------------------------------------------------

/**
 * Toaster — Sonner-based toast notification provider.
 *
 * Desktop: top-right. Mobile: top-center.
 * Place once in your root layout.
 *
 * Toast conventions:
 * - Success: 3s auto-dismiss
 * - Error: 5s, destructive style
 * - Warning: amber alert style
 *
 * @example
 * // In layout.tsx:
 * <Toaster />
 *
 * // To show a toast:
 * import { showToast } from '@/components/ui/toast';
 * showToast.success("Invoice approved");
 * showToast.error("Failed to save");
 */
export function Toaster({ className }: ToasterProps): React.JSX.Element {
  return (
    <SonnerToaster
      className={cn(className)}
      position="top-right"
      toastOptions={{
        classNames: {
          toast: cn(
            'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]',
            'rounded-lg shadow-lg',
          ),
          title: 'text-sm font-medium',
          description: 'text-xs text-[var(--color-muted-foreground)]',
          success: 'border-[var(--color-hitl-auto)] bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)]',
          error: 'border-[var(--color-destructive)] bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]',
          warning: 'border-[var(--color-warning)] bg-[var(--color-warning)] text-[var(--color-warning-foreground)]',
        },
      }}
      aria-live="polite"
    />
  );
}

// ---------------------------------------------------------------------------
// Toast helper functions
// ---------------------------------------------------------------------------

/**
 * Convenience wrappers around Sonner's `toast` with nEIP duration conventions.
 *
 * - `success`: 3s auto-dismiss
 * - `error`: 5s auto-dismiss (destructive styling)
 * - `warning`: 5s auto-dismiss (amber styling)
 * - `info`: 3s auto-dismiss (default styling)
 */
export const showToast = {
  success(message: string, description?: string) {
    return toast.success(message, { description, duration: 3000 });
  },
  error(message: string, description?: string) {
    return toast.error(message, { description, duration: 5000 });
  },
  warning(message: string, description?: string) {
    return toast.warning(message, { description, duration: 5000 });
  },
  info(message: string, description?: string) {
    return toast.info(message, { description, duration: 3000 });
  },
} as const;

// ---------------------------------------------------------------------------
// InlineAlert — for non-toast inline feedback
// ---------------------------------------------------------------------------

export type InlineAlertVariant = 'error' | 'warning' | 'info' | 'success';

export interface InlineAlertProps {
  /** Visual variant. */
  variant: InlineAlertVariant;
  /** Alert message. */
  message: string;
  /** Optional description text. */
  description?: string;
  /** Additional className forwarded to the root element. */
  className?: string;
}

const alertVariantClasses: Record<InlineAlertVariant, string> = {
  error:
    'border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]',
  warning:
    'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning-foreground)]',
  info:
    'border-[var(--color-info)] bg-[var(--color-info)]/10 text-[var(--color-info-foreground)]',
  success:
    'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success-foreground)]',
};

/**
 * InlineAlert — inline feedback for errors / warnings that should remain
 * visible in the page content (not as a toast).
 *
 * @example
 * <InlineAlert variant="error" message="Amount exceeds budget limit" />
 * <InlineAlert variant="warning" message="This vendor has overdue invoices" />
 */
export function InlineAlert({
  variant,
  message,
  description,
  className,
}: InlineAlertProps): React.JSX.Element {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-lg border px-4 py-3',
        alertVariantClasses[variant],
        className,
      )}
    >
      <p className="text-sm font-medium">{message}</p>
      {description && (
        <p className="mt-1 text-xs opacity-80">{description}</p>
      )}
    </div>
  );
}
