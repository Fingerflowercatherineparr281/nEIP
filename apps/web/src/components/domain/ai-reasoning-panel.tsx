'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Brain, ChevronDown, Database } from 'lucide-react';

import { cn } from '@/lib/cn';
import { ConfidenceIndicator } from './confidence-indicator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfidenceBreakdown {
  /** Label for this score dimension (e.g. "OCR clarity", "Vendor match"). */
  label: string;
  /** Score 0–100 for this dimension. */
  score: number;
}

export interface AIReasoningPanelProps {
  /** Bullet-point reasoning lines. Supports basic markdown-like formatting:
   *  leading `**bold**` is rendered as <strong>. */
  reasoningBullets: string[];
  /** Data sources the AI used (e.g. "Invoice #INV-001", "Vendor DB"). */
  dataSources?: string[];
  /** Per-dimension confidence breakdown. */
  confidenceBreakdown?: ConfidenceBreakdown[];
  /** Overall confidence score (0–100). */
  confidence?: number;
  /** AI model version string (e.g. "nEIP-v2.1"). */
  modelVersion?: string;
  /** Whether the panel starts expanded. */
  defaultExpanded?: boolean;
  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render basic **bold** markdown in a reasoning bullet. */
function renderBulletText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AIReasoningPanel — an accordion panel that shows AI reasoning details.
 *
 * Collapsed by default, expands to show:
 * - Reasoning bullets (with basic markdown bold support)
 * - Data sources used
 * - Confidence score breakdown
 * - Model version
 *
 * Accessibility:
 * - aria-expanded / aria-controls pattern
 * - Animation respects prefers-reduced-motion
 * - Scrollable when content exceeds viewport
 *
 * @example
 * <AIReasoningPanel
 *   reasoningBullets={["**High confidence** match on vendor name", "Amount matches PO"]}
 *   dataSources={["Invoice #INV-001", "Vendor DB"]}
 *   confidence={92}
 *   confidenceBreakdown={[{ label: "OCR", score: 95 }, { label: "Vendor", score: 89 }]}
 *   modelVersion="nEIP-v2.1"
 * />
 */
export function AIReasoningPanel({
  reasoningBullets,
  dataSources,
  confidenceBreakdown,
  confidence,
  modelVersion,
  defaultExpanded = false,
  className,
}: AIReasoningPanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const triggerId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]',
        className,
      )}
    >
      {/* Trigger */}
      <button
        id={triggerId}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-3 text-sm font-medium',
          'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
          'transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
          'rounded-lg',
        )}
      >
        <Brain aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">AI Reasoning</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Panel content */}
      <div
        id={panelId}
        ref={panelRef}
        role="region"
        aria-labelledby={triggerId}
        className={cn(
          'overflow-hidden transition-all motion-reduce:transition-none',
          expanded
            ? 'max-h-[80vh] overflow-y-auto opacity-100'
            : 'max-h-0 opacity-0',
        )}
      >
        <div className="space-y-4 border-t border-[var(--color-border)] px-4 py-3">
          {/* Reasoning bullets */}
          {reasoningBullets.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Reasoning
              </h4>
              <ul className="space-y-1.5" role="list">
                {reasoningBullets.map((bullet, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-[var(--color-foreground)]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                    />
                    <span>{renderBulletText(bullet)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data sources */}
          {dataSources && dataSources.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <Database aria-hidden="true" className="h-3 w-3" />
                Data Sources
              </h4>
              <ul className="flex flex-wrap gap-1.5" role="list">
                {dataSources.map((source, i) => (
                  <li
                    key={i}
                    className="rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]"
                  >
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence breakdown */}
          {confidenceBreakdown && confidenceBreakdown.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Confidence Breakdown
              </h4>
              <div className="space-y-2">
                {confidenceBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="min-w-[6rem] text-xs text-[var(--color-muted-foreground)]">
                      {item.label}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary)] transition-all motion-reduce:transition-none"
                          style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }}
                          role="progressbar"
                          aria-valuenow={item.score}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.label}: ${item.score}%`}
                        />
                      </div>
                    </div>
                    <span className="min-w-[2.5rem] text-right font-mono-figures text-xs">
                      {item.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall confidence + model version footer */}
          {(confidence !== undefined || modelVersion !== undefined) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
              {confidence !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    Overall:
                  </span>
                  <ConfidenceIndicator
                    confidence={confidence}
                    size="sm"
                    showLabel
                    showPercentage
                  />
                </div>
              )}
              {modelVersion !== undefined && (
                <span className="font-mono-figures text-xs text-[var(--color-muted-foreground)]">
                  Model: {modelVersion}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
