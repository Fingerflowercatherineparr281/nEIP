'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Edit, Trash2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { MoneyDisplay } from './money-display';
import { ConfidenceIndicator } from './confidence-indicator';
import { AIReasoningPanel } from './ai-reasoning-panel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalCardVariant = 'desktop' | 'mobile';

export type ApprovalCardState =
  | 'default'
  | 'selected'
  | 'expanded'
  | 'confirming'
  | 'confirmed'
  | 'rejected';

export interface ApprovalCardProps {
  /** Unique identifier for this approval item. */
  id: string;
  /** Document reference number (e.g. "INV-2024-001"). */
  documentRef: string;
  /** Type of document (e.g. "Invoice", "Purchase Order"). */
  documentType: string;
  /** Amount in satang (bigint). */
  amount: bigint;
  /** AI confidence score 0–100. */
  confidence: number;
  /** Short description of the document. */
  description: string;
  /** AI reasoning text — shown in expanded panel. */
  aiReasoning: string;
  /** Callback when user confirms this item. */
  onConfirm: (id: string) => void;
  /** Callback when user rejects this item. */
  onReject: (id: string) => void;
  /** Callback when user wants to edit this item. */
  onEdit: (id: string) => void;
  /** Whether the card is selected (checkbox checked). */
  selected: boolean;
  /** Callback when selection state changes. */
  onSelectChange?: (id: string, selected: boolean) => void;
  /** Layout variant. */
  variant: ApprovalCardVariant;
  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalCard — a domain component for the approval queue.
 *
 * Desktop: table row layout with inline fields.
 * Mobile: full-width stacked card.
 *
 * States: Default -> Selected -> Expanded -> Confirming -> Confirmed (slide-out 300ms) -> Rejected
 *
 * Keyboard:
 * - Space: toggle select
 * - Enter: confirm
 * - Delete/Backspace: reject
 * - ArrowUp/ArrowDown: navigate (managed by parent list)
 *
 * Accessibility:
 * - role="listitem"
 * - aria-label with document ref and amount
 * - focus trap in expanded reasoning panel
 *
 * @example
 * <ApprovalCard
 *   id="1"
 *   documentRef="INV-2024-001"
 *   documentType="Invoice"
 *   amount={123456n}
 *   confidence={92}
 *   description="Office supplies from Vendor A"
 *   aiReasoning="**High confidence** match..."
 *   onConfirm={handleConfirm}
 *   onReject={handleReject}
 *   onEdit={handleEdit}
 *   selected={false}
 *   variant="desktop"
 * />
 */
export function ApprovalCard({
  id,
  documentRef,
  documentType,
  amount,
  confidence,
  description,
  aiReasoning,
  onConfirm,
  onReject,
  onEdit,
  selected,
  onSelectChange,
  variant,
  className,
}: ApprovalCardProps): React.JSX.Element {
  const [cardState, setCardState] = useState<ApprovalCardState>(
    selected ? 'selected' : 'default',
  );
  const [expanded, setExpanded] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const checkboxId = useId();

  // Sync external selected prop
  const isSelected = selected || cardState === 'selected';
  const isConfirmed = cardState === 'confirmed';
  const isRejected = cardState === 'rejected';

  // Handlers
  const handleSelectToggle = useCallback(() => {
    const newSelected = !isSelected;
    onSelectChange?.(id, newSelected);
    setCardState(newSelected ? 'selected' : 'default');
  }, [id, isSelected, onSelectChange]);

  const handleExpandToggle = useCallback(() => {
    setExpanded((prev) => !prev);
    setCardState((prev) => (prev === 'expanded' ? 'default' : 'expanded'));
  }, []);

  const handleConfirmClick = useCallback(() => {
    setShowConfirmDialog(true);
    setCardState('confirming');
  }, []);

  const handleConfirmAction = useCallback(() => {
    setShowConfirmDialog(false);
    setCardState('confirmed');
    // Slide-out animation completes in 300ms, then notify parent
    setTimeout(() => {
      onConfirm(id);
    }, 300);
  }, [id, onConfirm]);

  const handleRejectClick = useCallback(() => {
    setShowRejectDialog(true);
  }, []);

  const handleRejectAction = useCallback(() => {
    setShowRejectDialog(false);
    setCardState('rejected');
    setTimeout(() => {
      onReject(id);
    }, 300);
  }, [id, onReject]);

  const handleEditClick = useCallback(() => {
    onEdit(id);
  }, [id, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handleSelectToggle();
          break;
        case 'Enter':
          e.preventDefault();
          handleConfirmClick();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          handleRejectClick();
          break;
        default:
          break;
      }
    },
    [handleSelectToggle, handleConfirmClick, handleRejectClick],
  );

  // Build aria label
  const bahtAmount = (Number(amount) / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const ariaLabel = `${documentType} ${documentRef}, ${bahtAmount} Baht, confidence ${confidence}%`;

  // Parse reasoning into bullets
  const reasoningBullets = aiReasoning
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (variant === 'mobile') {
    return (
      <>
        <div
          ref={cardRef}
          role="listitem"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full rounded-lg border bg-[var(--color-card)] transition-all motion-reduce:transition-none',
            isSelected && 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]',
            !isSelected && 'border-[var(--color-border)]',
            isConfirmed && 'translate-x-full opacity-0 transition-all duration-300',
            isRejected && '-translate-x-full opacity-0 transition-all duration-300',
            className,
          )}
        >
          {/* Card header */}
          <div className="flex items-start gap-3 p-4 pb-2">
            {/* Checkbox */}
            <div className="pt-0.5">
              <input
                id={checkboxId}
                type="checkbox"
                checked={isSelected}
                onChange={handleSelectToggle}
                aria-label={`Select ${documentRef}`}
                className="h-4 w-4 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
              />
            </div>

            <div className="flex-1 space-y-2">
              {/* Ref + type */}
              <div className="flex items-center justify-between">
                <span className="font-mono-figures text-sm font-medium text-[var(--color-foreground)]">
                  {documentRef}
                </span>
                <span className="rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {documentType}
                </span>
              </div>

              {/* Amount + confidence */}
              <div className="flex items-center justify-between">
                <MoneyDisplay amount={amount} size="lg" />
                <ConfidenceIndicator confidence={confidence} size="sm" showLabel showPercentage />
              </div>

              {/* Description */}
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {description}
              </p>
            </div>
          </div>

          {/* Expand reasoning toggle */}
          <button
            type="button"
            onClick={handleExpandToggle}
            aria-expanded={expanded}
            className="flex w-full items-center justify-center gap-1 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <span>{expanded ? 'Hide' : 'Show'} AI Reasoning</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'h-3.5 w-3.5 transition-transform motion-reduce:transition-none',
                expanded && 'rotate-180',
              )}
            />
          </button>

          {/* Reasoning panel */}
          {expanded && (
            <div className="border-t border-[var(--color-border)] px-4 py-3">
              <AIReasoningPanel
                reasoningBullets={reasoningBullets}
                confidence={confidence}
                defaultExpanded
                className="border-0 p-0"
              />
            </div>
          )}

          {/* Mobile action buttons — always with labels */}
          <div className="flex gap-2 border-t border-[var(--color-border)] p-4">
            <Button
              variant="outline"
              size="md"
              onClick={handleEditClick}
              className="flex-1"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleRejectClick}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmClick}
              className="flex-1"
            >
              <Check className="h-4 w-4" />
              Confirm
            </Button>
          </div>
        </div>

        {/* Confirm dialog */}
        <ConfirmDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title="Confirm Approval"
          description={`Are you sure you want to approve ${documentRef} for ${bahtAmount} Baht?`}
          confirmLabel="Approve"
          confirmVariant="primary"
          onConfirm={handleConfirmAction}
        />

        {/* Reject dialog */}
        <ConfirmDialog
          open={showRejectDialog}
          onOpenChange={setShowRejectDialog}
          title="Reject Document"
          description={`Are you sure you want to reject ${documentRef}? This action may require re-submission.`}
          confirmLabel="Reject"
          confirmVariant="destructive"
          onConfirm={handleRejectAction}
        />
      </>
    );
  }

  // Desktop variant — table row layout
  return (
    <>
      <div
        ref={cardRef}
        role="listitem"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-4 rounded-lg border bg-[var(--color-card)] px-4 py-3',
          'transition-all motion-reduce:transition-none',
          isSelected && 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]',
          !isSelected && 'border-[var(--color-border)]',
          isConfirmed && 'translate-x-full opacity-0 transition-all duration-300',
          isRejected && '-translate-x-full opacity-0 transition-all duration-300',
          'hover:bg-[var(--color-accent)]/30',
          className,
        )}
      >
        {/* Checkbox */}
        <input
          id={checkboxId}
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectToggle}
          aria-label={`Select ${documentRef}`}
          className="h-4 w-4 shrink-0 rounded border-[var(--color-input)] accent-[var(--color-primary)]"
        />

        {/* Document ref */}
        <span className="min-w-[7rem] font-mono-figures text-sm font-medium text-[var(--color-foreground)]">
          {documentRef}
        </span>

        {/* Document type badge */}
        <span className="shrink-0 rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
          {documentType}
        </span>

        {/* Amount */}
        <div className="min-w-[8rem] text-right">
          <MoneyDisplay amount={amount} size="md" />
        </div>

        {/* Confidence */}
        <ConfidenceIndicator confidence={confidence} size="sm" showLabel showPercentage />

        {/* Description */}
        <span className="hidden flex-1 truncate text-sm text-[var(--color-muted-foreground)] lg:block">
          {description}
        </span>

        {/* Expand reasoning */}
        <button
          type="button"
          onClick={handleExpandToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} AI reasoning for ${documentRef}`}
          className={cn(
            'shrink-0 rounded-md p-1.5 text-[var(--color-muted-foreground)]',
            'hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]',
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 transition-transform motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
          />
        </button>

        {/* Action buttons */}
        <div className="flex shrink-0 gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleEditClick} aria-label={`Edit ${documentRef}`}>
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRejectClick} aria-label={`Reject ${documentRef}`}>
            <Trash2 className="h-3.5 w-3.5" />
            Reject
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmClick}>
            <Check className="h-3.5 w-3.5" />
            Confirm
          </Button>
        </div>
      </div>

      {/* Expanded reasoning row */}
      {expanded && (
        <div className="mt-1 ml-9 rounded-lg">
          <AIReasoningPanel
            reasoningBullets={reasoningBullets}
            confidence={confidence}
            defaultExpanded
          />
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Approval"
        description={`Are you sure you want to approve ${documentRef} for ${bahtAmount} Baht?`}
        confirmLabel="Approve"
        confirmVariant="primary"
        onConfirm={handleConfirmAction}
      />

      {/* Reject dialog */}
      <ConfirmDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        title="Reject Document"
        description={`Are you sure you want to reject ${documentRef}? This action may require re-submission.`}
        confirmLabel="Reject"
        confirmVariant="destructive"
        onConfirm={handleRejectAction}
      />
    </>
  );
}
