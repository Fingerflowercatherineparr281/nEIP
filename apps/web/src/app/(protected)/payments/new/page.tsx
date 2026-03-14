'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { ConfidenceIndicator } from '@/components/domain/confidence-indicator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchSuggestion {
  invoiceId: string;
  invoiceRef: string;
  /** Invoice total in satang */
  invoiceAmount: number;
  /** Outstanding balance in satang */
  outstandingAmount: number;
  confidence: number;
  reason: string;
}

interface PaymentCreateResponse {
  id: string;
  matchSuggestions: MatchSuggestion[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewPaymentPage(): React.JSX.Element {
  const router = useRouter();

  // Form
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [payer, setPayer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Post-save state
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [matchingId, setMatchingId] = useState<string | null>(null);

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (touched['amount']) {
      const v = parseFloat(amount);
      if (isNaN(v) || v <= 0) e['amount'] = 'Amount must be greater than 0';
    }
    if (touched['reference'] && !reference.trim()) e['reference'] = 'Reference is required';
    if (touched['payer'] && !payer.trim()) e['payer'] = 'Payer is required';
    if (touched['date'] && !date) e['date'] = 'Date is required';
    return e;
  }, [amount, reference, payer, date, touched]);

  const handleSubmit = useCallback(async () => {
    const allTouched = { amount: true, reference: true, payer: true, date: true };
    setTouched(allTouched);

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0 || !reference.trim() || !payer.trim() || !date) return;

    setSubmitting(true);
    try {
      const result = await api.post<PaymentCreateResponse>('/payments', {
        amount: Math.round(amtNum * 100), // to satang
        reference: reference.trim(),
        payerName: payer.trim(),
        date,
      });
      showToast.success('Payment recorded successfully');
      setPaymentId(result.id);
      setSuggestions(result.matchSuggestions ?? []);
    } catch {
      showToast.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }, [amount, reference, payer, date]);

  const handleAcceptMatch = useCallback(
    async (suggestion: MatchSuggestion) => {
      if (!paymentId) return;
      setMatchingId(suggestion.invoiceId);
      try {
        await api.post(`/payments/${paymentId}/match`, {
          invoiceId: suggestion.invoiceId,
        });
        showToast.success(`Payment matched to ${suggestion.invoiceRef}`);
        router.push('/payments');
      } catch {
        showToast.error('Failed to match payment');
      } finally {
        setMatchingId(null);
      }
    },
    [paymentId, router],
  );

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );
  const errorInputClasses = 'border-[var(--color-destructive)]';

  // Post-save: show match suggestions
  if (paymentId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            AI Invoice Match Suggestions
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Payment recorded. Select an invoice to match with this payment.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No matching invoices found. You can match manually later.
            </p>
            <Button variant="primary" className="mt-4" onClick={() => router.push('/payments')}>
              Go to Payments
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.invoiceId}
                className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-accent)]/30"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-figures text-sm font-medium">
                      {s.invoiceRef}
                    </span>
                    <ConfidenceIndicator confidence={s.confidence} size="sm" showLabel showPercentage />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[var(--color-muted-foreground)]">
                    <span>
                      Invoice: <MoneyDisplay amount={BigInt(s.invoiceAmount)} size="sm" />
                    </span>
                    <span>
                      Outstanding: <MoneyDisplay amount={BigInt(s.outstandingAmount)} size="sm" />
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{s.reason}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAcceptMatch(s)}
                  loading={matchingId === s.invoiceId}
                  disabled={matchingId !== null}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Match
                </Button>
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => router.push('/payments')}>
                Skip Matching
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Record Payment</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Record a new payment received
        </p>
      </div>

      {/* Form */}
      <div className="space-y-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Amount */}
        <div className="space-y-1.5">
          <label htmlFor="amount" className="text-sm font-medium text-[var(--color-foreground)]">
            Amount (THB) <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => markTouched('amount')}
            placeholder="0.00"
            className={cn(inputClasses, errors['amount'] && errorInputClasses)}
          />
          {errors['amount'] && (
            <p className="text-xs text-[var(--color-destructive)]">{errors['amount']}</p>
          )}
        </div>

        {/* Reference */}
        <div className="space-y-1.5">
          <label htmlFor="reference" className="text-sm font-medium text-[var(--color-foreground)]">
            Reference <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onBlur={() => markTouched('reference')}
            placeholder="Transfer reference or check number"
            className={cn(inputClasses, errors['reference'] && errorInputClasses)}
          />
          {errors['reference'] && (
            <p className="text-xs text-[var(--color-destructive)]">{errors['reference']}</p>
          )}
        </div>

        {/* Payer */}
        <div className="space-y-1.5">
          <label htmlFor="payer" className="text-sm font-medium text-[var(--color-foreground)]">
            Payer <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="payer"
            type="text"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            onBlur={() => markTouched('payer')}
            placeholder="Payer name"
            className={cn(inputClasses, errors['payer'] && errorInputClasses)}
          />
          {errors['payer'] && (
            <p className="text-xs text-[var(--color-destructive)]">{errors['payer']}</p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label htmlFor="payDate" className="text-sm font-medium text-[var(--color-foreground)]">
            Date <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="payDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => markTouched('date')}
            className={cn(inputClasses, errors['date'] && errorInputClasses)}
          />
          {errors['date'] && (
            <p className="text-xs text-[var(--color-destructive)]">{errors['date']}</p>
          )}
        </div>

        {/* Preview */}
        {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <span className="text-sm text-[var(--color-muted-foreground)]">Amount:</span>
            <MoneyDisplay amount={BigInt(Math.round(parseFloat(amount) * 100))} size="lg" />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            <Check className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
