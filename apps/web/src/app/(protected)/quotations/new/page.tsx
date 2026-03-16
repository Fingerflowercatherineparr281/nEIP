'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
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
  customerName?: string;
  subject?: string;
  validUntil?: string;
  lines?: Record<number, { description?: string; quantity?: string; unitPrice?: string }>;
}

let lineKeyCounter = 0;
function nextLineKey(): string {
  lineKeyCounter += 1;
  return `line-${lineKeyCounter}`;
}

/** Return a date N days from today as YYYY-MM-DD */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewQuotationPage(): React.JSX.Element {
  const router = useRouter();

  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [subject, setSubject] = useState('');
  const [validUntil, setValidUntil] = useState(daysFromToday(30));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([
    { key: nextLineKey(), description: '', quantity: '1', unitPrice: '' },
  ]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const errors = useMemo((): FieldErrors => {
    const e: FieldErrors = {};
    if (touched['customerName'] && !customerName.trim()) {
      e.customerName = 'Customer name is required';
    }
    if (touched['subject'] && !subject.trim()) {
      e.subject = 'Subject is required';
    }
    if (touched['validUntil'] && !validUntil) {
      e.validUntil = 'Valid until date is required';
    }
    if (touched['validUntil'] && validUntil && validUntil < new Date().toISOString().slice(0, 10)) {
      e.validUntil = 'Valid until must be a future date';
    }

    const lineErrors: Record<number, { description?: string; quantity?: string; unitPrice?: string }> = {};
    lines.forEach((line, i) => {
      const le: { description?: string; quantity?: string; unitPrice?: string } = {};
      if (touched[`line-${i}-description`] && !line.description.trim()) le.description = 'Required';
      if (touched[`line-${i}-quantity`]) {
        const qty = parseInt(line.quantity, 10);
        if (isNaN(qty) || qty < 1) le.quantity = 'Must be >= 1';
      }
      if (touched[`line-${i}-unitPrice`]) {
        const price = parseFloat(line.unitPrice);
        if (isNaN(price) || price < 0) le.unitPrice = 'Must be >= 0';
      }
      if (Object.keys(le).length > 0) lineErrors[i] = le;
    });
    if (Object.keys(lineErrors).length > 0) e.lines = lineErrors;

    return e;
  }, [customerName, subject, validUntil, lines, touched]);

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // ---------------------------------------------------------------------------
  // Line helpers
  // ---------------------------------------------------------------------------

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { key: nextLineKey(), description: '', quantity: '1', unitPrice: '' },
    ]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  const updateLine = useCallback(
    (index: number, field: keyof Omit<LineItem, 'key'>, value: string) => {
      setLines((prev) =>
        prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Total
  // ---------------------------------------------------------------------------

  const totalSatang = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const qty = parseInt(line.quantity, 10) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      total += qty * price * 100; // baht → satang
    }
    return BigInt(Math.round(total));
  }, [lines]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    const allTouched: Record<string, boolean> = {
      customerName: true,
      subject: true,
      validUntil: true,
    };
    lines.forEach((_, i) => {
      allTouched[`line-${i}-description`] = true;
      allTouched[`line-${i}-quantity`] = true;
      allTouched[`line-${i}-unitPrice`] = true;
    });
    setTouched(allTouched);

    if (!customerName.trim() || !subject.trim() || !validUntil) return;
    const hasInvalidLines = lines.some((line) => {
      const qty = parseInt(line.quantity, 10);
      const price = parseFloat(line.unitPrice);
      return !line.description.trim() || isNaN(qty) || qty < 1 || isNaN(price) || price < 0;
    });
    if (hasInvalidLines) return;

    setSubmitting(true);
    try {
      await api.post('/api/v1/quotations', {
        customerId: customerId.trim() || crypto.randomUUID(),
        customerName: customerName.trim(),
        subject: subject.trim(),
        notes: notes.trim() || undefined,
        validUntil,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          quantity: parseInt(line.quantity, 10),
          unitPriceSatang: String(Math.round(parseFloat(line.unitPrice) * 100)),
        })),
      });
      showToast.success('Quotation created successfully');
      router.push('/quotations');
    } catch {
      showToast.error('Failed to create quotation');
    } finally {
      setSubmitting(false);
    }
  }, [customerName, customerId, subject, notes, validUntil, lines, router]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );
  const errorInputClasses = 'border-[var(--color-destructive)]';
  const textareaClasses = cn(
    'w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
    'min-h-[80px] resize-y',
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/quotations">
          <Button variant="ghost" size="icon" aria-label="Back to quotations">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            New Quotation
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            สร้างใบเสนอราคาใหม่
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Customer info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="customerName"
              className="text-sm font-medium text-[var(--color-foreground)]"
            >
              Customer Name <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={() => markTouched('customerName')}
              placeholder="e.g. บริษัท ABC จำกัด"
              className={cn(inputClasses, errors.customerName && errorInputClasses)}
            />
            {errors.customerName && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.customerName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="customerId"
              className="text-sm font-medium text-[var(--color-foreground)]"
            >
              Customer ID
            </label>
            <input
              id="customerId"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Customer ID (optional)"
              className={inputClasses}
            />
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label
            htmlFor="subject"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Subject <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => markTouched('subject')}
            placeholder="e.g. เสนอราคาโครงการพัฒนาระบบ"
            className={cn(inputClasses, errors.subject && errorInputClasses)}
          />
          {errors.subject && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.subject}</p>
          )}
        </div>

        {/* Valid Until */}
        <div className="space-y-1.5">
          <label
            htmlFor="validUntil"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Valid Until <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input
            id="validUntil"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            onBlur={() => markTouched('validUntil')}
            className={cn(inputClasses, 'max-w-xs', errors.validUntil && errorInputClasses)}
          />
          {errors.validUntil && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.validUntil}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label
            htmlFor="notes"
            className="text-sm font-medium text-[var(--color-foreground)]"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or terms..."
            className={textareaClasses}
          />
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

          {/* Column headers */}
          <div className="hidden grid-cols-[1fr_5rem_7rem_2.5rem] gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)] sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit Price (฿)</span>
            <span />
          </div>

          {lines.map((line, i) => {
            const lineErrors = errors.lines?.[i];
            return (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_7rem_2.5rem]"
              >
                <div>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-description`)}
                    placeholder="Item description"
                    className={cn(inputClasses, lineErrors?.description && errorInputClasses)}
                  />
                  {lineErrors?.description && (
                    <p className="text-xs text-[var(--color-destructive)]">
                      {lineErrors.description}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    onBlur={() => markTouched(`line-${i}-quantity`)}
                    placeholder="1"
                    min="1"
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
                    placeholder="0.00"
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

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}>
            Save as Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
