'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { InlineAlert } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  key: string;
  description: string;
  amount: string;
  accountId: string;
}

interface FieldErrors {
  vendor?: string;
  dueDate?: string;
  lines?: Record<number, { description?: string; amount?: string; accountId?: string }>;
}

let lineKeyCounter = 0;
function nextLineKey(): string {
  lineKeyCounter += 1;
  return `line-${lineKeyCounter}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewBillPage(): React.JSX.Element {
  const router = useRouter();

  // Form state
  const [vendor, setVendor] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([
    { key: nextLineKey(), description: '', amount: '', accountId: '' },
  ]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Validation
  const errors = useMemo((): FieldErrors => {
    const e: FieldErrors = {};
    if (touched['vendor'] && !vendor.trim()) e.vendor = 'Vendor is required';
    if (touched['dueDate'] && !dueDate) e.dueDate = 'Due date is required';

    const lineErrors: Record<number, { description?: string; amount?: string; accountId?: string }> = {};
    lines.forEach((line, i) => {
      const le: { description?: string; amount?: string; accountId?: string } = {};
      if (touched[`line-${i}-description`] && !line.description.trim()) le.description = 'Required';
      if (touched[`line-${i}-amount`]) {
        const amt = parseFloat(line.amount);
        if (isNaN(amt) || amt <= 0) le.amount = 'Must be > 0';
      }
      if (touched[`line-${i}-accountId`] && !line.accountId.trim()) le.accountId = 'Required';
      if (Object.keys(le).length > 0) lineErrors[i] = le;
    });
    if (Object.keys(lineErrors).length > 0) e.lines = lineErrors;
    return e;
  }, [vendor, dueDate, lines, touched]);

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Line item helpers
  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { key: nextLineKey(), description: '', amount: '', accountId: '' }]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const updateLine = useCallback((index: number, field: keyof Omit<LineItem, 'key'>, value: string) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  }, []);

  // Calculate total in satang
  const totalSatang = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const amt = parseFloat(line.amount) || 0;
      total += amt * 100; // convert to satang
    }
    return BigInt(Math.round(total));
  }, [lines]);

  // Submit
  const handleSubmit = useCallback(async () => {
    // Touch all fields
    const allTouched: Record<string, boolean> = {
      vendor: true,
      dueDate: true,
    };
    lines.forEach((_, i) => {
      allTouched[`line-${i}-description`] = true;
      allTouched[`line-${i}-amount`] = true;
      allTouched[`line-${i}-accountId`] = true;
    });
    setTouched(allTouched);

    // Check validity
    if (!vendor.trim() || !dueDate) return;
    const hasInvalidLines = lines.some((line) => {
      const amt = parseFloat(line.amount);
      return !line.description.trim() || isNaN(amt) || amt <= 0 || !line.accountId.trim();
    });
    if (hasInvalidLines) return;

    setSubmitting(true);
    try {
      await api.post('/bills', {
        vendorId: vendor.trim(),
        dueDate,
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          amountSatang: Math.round(parseFloat(line.amount) * 100).toString(),
          accountId: line.accountId.trim(),
        })),
      });
      showToast.success('Bill created successfully');
      router.push('/bills');
    } catch {
      showToast.error('Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  }, [vendor, dueDate, notes, lines, router]);

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  const errorInputClasses = 'border-[var(--color-destructive)]';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">New Bill</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Create a new vendor bill / expense
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Vendor */}
        <div className="space-y-1.5">
          <label htmlFor="vendor" className="text-sm font-medium text-[var(--color-foreground)]">
            Vendor <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="vendor"
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            onBlur={() => markTouched('vendor')}
            placeholder="Vendor name or ID"
            className={cn(inputClasses, errors.vendor && errorInputClasses)}
          />
          {errors.vendor && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.vendor}</p>
          )}
        </div>

        {/* Due Date + Notes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="dueDate" className="text-sm font-medium text-[var(--color-foreground)]">
              Due Date <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => markTouched('dueDate')}
              className={cn(inputClasses, errors.dueDate && errorInputClasses)}
            />
            {errors.dueDate && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.dueDate}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-[var(--color-foreground)]">
              Notes
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className={inputClasses}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-foreground)]">Line Items</h2>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              Add Line
            </Button>
          </div>

          {/* Line item header */}
          <div className="hidden grid-cols-[1fr_7rem_8rem_2.5rem] gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)] sm:grid">
            <span>Description</span>
            <span>Amount</span>
            <span>Account ID</span>
            <span />
          </div>

          {lines.map((line, i) => {
            const lineErrors = errors.lines?.[i];
            return (
              <div key={line.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_8rem_2.5rem]">
                <div>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-description`)}
                    placeholder="Description"
                    className={cn(inputClasses, lineErrors?.description && errorInputClasses)}
                  />
                  {lineErrors?.description && (
                    <p className="text-xs text-[var(--color-destructive)]">{lineErrors.description}</p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    value={line.amount}
                    onChange={(e) => updateLine(i, 'amount', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-amount`)}
                    placeholder="Amount"
                    min="0"
                    step="0.01"
                    className={cn(inputClasses, lineErrors?.amount && errorInputClasses)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={line.accountId}
                    onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-accountId`)}
                    placeholder="Account"
                    className={cn(inputClasses, lineErrors?.accountId && errorInputClasses)}
                  />
                </div>
                <div className="flex items-start pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="flex items-center justify-end gap-4 border-t border-[var(--color-border)] pt-4">
          <span className="text-sm font-medium text-[var(--color-foreground)]">Total:</span>
          <MoneyDisplay amount={totalSatang} size="lg" />
        </div>

        {/* Validation summary */}
        {Object.keys(errors).length > 0 && Object.keys(touched).length > 3 && (
          <InlineAlert variant="error" message="Please fix the errors above before submitting." />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            Create Bill
          </Button>
        </div>
      </div>
    </div>
  );
}
