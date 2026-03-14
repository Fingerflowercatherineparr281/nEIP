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
  quantity: string;
  unitPrice: string;
}

interface FieldErrors {
  customer?: string;
  issueDate?: string;
  dueDate?: string;
  lines?: Record<number, { description?: string; quantity?: string; unitPrice?: string }>;
}

let lineKeyCounter = 0;
function nextLineKey(): string {
  lineKeyCounter += 1;
  return `line-${lineKeyCounter}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewInvoicePage(): React.JSX.Element {
  const router = useRouter();

  // Form state
  const [customer, setCustomer] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<LineItem[]>([
    { key: nextLineKey(), description: '', quantity: '1', unitPrice: '' },
  ]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Validation
  const errors = useMemo((): FieldErrors => {
    const e: FieldErrors = {};
    if (touched['customer'] && !customer.trim()) e.customer = 'Customer is required';
    if (touched['issueDate'] && !issueDate) e.issueDate = 'Issue date is required';
    if (touched['dueDate'] && !dueDate) e.dueDate = 'Due date is required';
    if (touched['dueDate'] && dueDate && issueDate && dueDate < issueDate) {
      e.dueDate = 'Due date must be after issue date';
    }

    const lineErrors: Record<number, { description?: string; quantity?: string; unitPrice?: string }> = {};
    lines.forEach((line, i) => {
      const le: { description?: string; quantity?: string; unitPrice?: string } = {};
      if (touched[`line-${i}-description`] && !line.description.trim()) le.description = 'Required';
      if (touched[`line-${i}-quantity`]) {
        const qty = parseFloat(line.quantity);
        if (isNaN(qty) || qty <= 0) le.quantity = 'Must be > 0';
      }
      if (touched[`line-${i}-unitPrice`]) {
        const price = parseFloat(line.unitPrice);
        if (isNaN(price) || price < 0) le.unitPrice = 'Must be >= 0';
      }
      if (Object.keys(le).length > 0) lineErrors[i] = le;
    });
    if (Object.keys(lineErrors).length > 0) e.lines = lineErrors;
    return e;
  }, [customer, issueDate, dueDate, lines, touched]);

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Line item helpers
  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { key: nextLineKey(), description: '', quantity: '1', unitPrice: '' }]);
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
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      total += qty * price * 100; // convert to satang
    }
    return BigInt(Math.round(total));
  }, [lines]);

  // Submit
  const handleSubmit = useCallback(async () => {
    // Touch all fields
    const allTouched: Record<string, boolean> = {
      customer: true,
      issueDate: true,
      dueDate: true,
    };
    lines.forEach((_, i) => {
      allTouched[`line-${i}-description`] = true;
      allTouched[`line-${i}-quantity`] = true;
      allTouched[`line-${i}-unitPrice`] = true;
    });
    setTouched(allTouched);

    // Check validity
    if (!customer.trim() || !issueDate || !dueDate) return;
    const hasInvalidLines = lines.some((line) => {
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      return !line.description.trim() || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0;
    });
    if (hasInvalidLines) return;

    setSubmitting(true);
    try {
      await api.post('/invoices', {
        customerName: customer.trim(),
        issueDate,
        dueDate,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          quantity: parseFloat(line.quantity),
          unitPrice: Math.round(parseFloat(line.unitPrice) * 100), // satang
        })),
      });
      showToast.success('Invoice created successfully');
      router.push('/invoices');
    } catch {
      showToast.error('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }, [customer, issueDate, dueDate, lines, router]);

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
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">New Invoice</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Create a new customer invoice
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Customer */}
        <div className="space-y-1.5">
          <label htmlFor="customer" className="text-sm font-medium text-[var(--color-foreground)]">
            Customer <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="customer"
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            onBlur={() => markTouched('customer')}
            placeholder="Customer name"
            className={cn(inputClasses, errors.customer && errorInputClasses)}
          />
          {errors.customer && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.customer}</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="issueDate" className="text-sm font-medium text-[var(--color-foreground)]">
              Issue Date <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              onBlur={() => markTouched('issueDate')}
              className={cn(inputClasses, errors.issueDate && errorInputClasses)}
            />
            {errors.issueDate && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.issueDate}</p>
            )}
          </div>
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
          <div className="hidden grid-cols-[1fr_5rem_7rem_2.5rem] gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)] sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit Price</span>
            <span />
          </div>

          {lines.map((line, i) => {
            const lineErrors = errors.lines?.[i];
            return (
              <div key={line.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_7rem_2.5rem]">
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
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-quantity`)}
                    placeholder="Qty"
                    min="0"
                    step="1"
                    className={cn(inputClasses, lineErrors?.quantity && errorInputClasses)}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-unitPrice`)}
                    placeholder="Price"
                    min="0"
                    step="0.01"
                    className={cn(inputClasses, lineErrors?.unitPrice && errorInputClasses)}
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
        {Object.keys(errors).length > 0 && Object.keys(touched).length > 5 && (
          <InlineAlert variant="error" message="Please fix the errors above before submitting." />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            Create Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
