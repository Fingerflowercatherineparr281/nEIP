'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Button variant definitions (6 levels)
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  // Base styles shared by every button variant.
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'text-sm font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Level 1 — Primary action (max 1 per visible area). */
        primary: [
          'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
          'hover:bg-[var(--color-primary-600)]',
          'active:bg-[var(--color-primary-700)]',
        ].join(' '),
        /** Level 2 — Secondary action. */
        secondary: [
          'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
          'hover:bg-[var(--color-accent)]',
        ].join(' '),
        /** Level 3 — Outline action. */
        outline: [
          'border border-[var(--color-input)] bg-transparent text-[var(--color-foreground)]',
          'hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]',
        ].join(' '),
        /** Level 4 — Destructive action (requires Dialog confirmation). */
        destructive: [
          'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]',
          'hover:opacity-90',
        ].join(' '),
        /** Level 5 — Ghost (minimal). */
        ghost: [
          'text-[var(--color-foreground)]',
          'hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]',
        ].join(' '),
        /** Level 6 — Link style. */
        link: [
          'text-[var(--color-primary)] underline-offset-4',
          'hover:underline',
        ].join(' '),
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5',
        md: 'h-10 px-4 text-sm [&_svg]:h-4 [&_svg]:w-4',
        lg: 'h-12 px-6 text-base [&_svg]:h-5 [&_svg]:w-5',
        icon: 'h-10 w-10 [&_svg]:h-4 [&_svg]:w-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a loading spinner and disable the button. */
  loading?: boolean;
  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Button — 6-level button hierarchy for nEIP.
 *
 * Levels: Primary, Secondary, Outline, Destructive, Ghost, Link.
 * Convention: max 1 primary button per visible area.
 *
 * Features:
 * - Loading state with spinner + disabled
 * - Mobile financial action buttons always have labels (use size="md" or larger, not "icon")
 * - aria-disabled and aria-busy for loading state
 *
 * @example
 * <Button variant="primary" loading={isSubmitting}>Confirm</Button>
 * <Button variant="destructive">Reject</Button>
 * <Button variant="ghost" size="icon"><X /></Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, loading = false, disabled, children, ...props },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2
            aria-hidden="true"
            className="animate-spin"
          />
        )}
        {children}
      </button>
    );
  },
);

export { buttonVariants };
