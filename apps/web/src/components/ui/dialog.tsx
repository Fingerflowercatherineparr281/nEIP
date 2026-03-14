'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from './button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback fired when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title displayed in the header. */
  title: string;
  /** Optional description below the title. */
  description?: string;
  /** The dialog body content. */
  children: ReactNode;
  /** Additional className forwarded to the dialog panel. */
  className?: string;
}

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback fired when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title. */
  title: string;
  /** Descriptive message explaining the action. */
  description: string;
  /** Label for the confirm button. */
  confirmLabel?: string;
  /** Button variant for the confirm action (typically "destructive"). */
  confirmVariant?: 'primary' | 'destructive';
  /** Callback fired on confirm. */
  onConfirm: () => void;
  /** Whether the confirm action is in progress. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Dialog Component
// ---------------------------------------------------------------------------

/**
 * Dialog — a modal dialog with focus trap and backdrop.
 *
 * Used for destructive action confirmations and other modal workflows.
 * Closes on Escape key and backdrop click.
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen} title="Delete Item">
 *   <p>Are you sure?</p>
 * </Dialog>
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps): React.JSX.Element {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  // Focus trap — focus the dialog when opened
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity motion-reduce:transition-none"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-50 mx-4 w-full max-w-md rounded-xl border border-[var(--color-border)]',
          'bg-[var(--color-card)] p-6 shadow-lg',
          'focus:outline-none',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--color-foreground)]"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="mt-1 text-sm text-[var(--color-muted-foreground)]"
              >
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="shrink-0"
          >
            <X />
          </Button>
        </div>
        {/* Content */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — pre-built confirmation dialog for destructive actions
// ---------------------------------------------------------------------------

/**
 * ConfirmDialog — a convenience wrapper around Dialog for destructive action
 * confirmations. Renders Cancel + Confirm buttons with loading state.
 *
 * @example
 * <ConfirmDialog
 *   open={showDelete}
 *   onOpenChange={setShowDelete}
 *   title="Reject Invoice"
 *   description="This action cannot be undone."
 *   confirmLabel="Reject"
 *   confirmVariant="destructive"
 *   onConfirm={handleReject}
 *   loading={isRejecting}
 * />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  onConfirm,
  loading = false,
}: ConfirmDialogProps): React.JSX.Element | null {
  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          onClick={handleConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
