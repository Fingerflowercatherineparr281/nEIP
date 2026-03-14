'use client';

import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoneyFormat = 'inline' | 'accounting';
export type MoneySize = 'sm' | 'md' | 'lg';

export interface MoneyDisplayProps {
  /** Amount in satang (1/100 of a Thai Baht). Use bigint to avoid float drift. */
  amount: bigint;
  /** Display format.
   *  - `inline`     → ฿1,234.56 / -฿1,234.56
   *  - `accounting` → ฿1,234.56 / (฿1,234.56) — standard accounting notation */
  format?: MoneyFormat;
  /** When true, prepend an explicit + sign for positive amounts. */
  showSign?: boolean;
  /** Visual size scale applied to font-size. */
  size?: MoneySize;
  /** Additional className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert satang bigint to a formatted Thai Baht string (no sign, no symbol). */
function satangToFormattedBaht(satang: bigint): string {
  // Work in absolute value; the caller handles sign rendering.
  const abs = satang < 0n ? -satang : satang;

  const bahtPart = abs / 100n;
  const satangPart = abs % 100n;

  // Format the baht integer with thousand separators.
  const bahtStr = bahtPart.toLocaleString('en-US');
  // Always render two decimal places.
  const satangStr = satangPart.toString().padStart(2, '0');

  return `${bahtStr}.${satangStr}`;
}

type AmountPolarity = 'positive' | 'negative' | 'zero';

function getPolarity(amount: bigint): AmountPolarity {
  if (amount > 0n) return 'positive';
  if (amount < 0n) return 'negative';
  return 'zero';
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const sizeClasses: Record<MoneySize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MoneyDisplay — renders a Thai Baht amount stored as satang (bigint).
 *
 * - Converts bigint satang → ฿#,##0.00
 * - Green for positive, red for negative, muted neutral for zero
 * - Monospace + tabular-nums for column alignment
 * - Accessible aria-label with spoken amount
 *
 * @example
 * // ฿1,234.56 in green
 * <MoneyDisplay amount={123456n} />
 *
 * @example
 * // (฿500.00) in red, accounting style
 * <MoneyDisplay amount={-50000n} format="accounting" />
 */
export function MoneyDisplay({
  amount,
  format = 'inline',
  showSign = false,
  size = 'md',
  className,
}: MoneyDisplayProps): React.JSX.Element {
  const polarity = getPolarity(amount);
  const formattedNumber = satangToFormattedBaht(amount);

  // Build the human-readable display string.
  let displayText: string;

  if (format === 'accounting') {
    if (polarity === 'negative') {
      displayText = `(฿${formattedNumber})`;
    } else if (polarity === 'positive' && showSign) {
      displayText = `+฿${formattedNumber}`;
    } else {
      displayText = `฿${formattedNumber}`;
    }
  } else {
    // inline format
    if (polarity === 'negative') {
      displayText = `-฿${formattedNumber}`;
    } else if (polarity === 'positive' && showSign) {
      displayText = `+฿${formattedNumber}`;
    } else {
      displayText = `฿${formattedNumber}`;
    }
  }

  // Build the spoken aria-label in plain language.
  const bahtFloat = Number(amount) / 100;
  const spokenAmount = Math.abs(bahtFloat).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signLabel =
    polarity === 'negative'
      ? 'ติดลบ '
      : polarity === 'positive' && showSign
        ? 'บวก '
        : '';
  const ariaLabel = `${signLabel}${spokenAmount} บาท`;

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        // Monospace + tabular-nums so digits align in table columns.
        'font-mono-figures',
        // Size variant.
        sizeClasses[size],
        // Polarity color — uses CSS custom properties defined in globals.css.
        polarity === 'positive' && 'text-[var(--color-money-positive)]',
        polarity === 'negative' && 'text-[var(--color-money-negative)]',
        polarity === 'zero' && 'text-[var(--color-money-neutral)]',
        className,
      )}
    >
      {displayText}
    </span>
  );
}
