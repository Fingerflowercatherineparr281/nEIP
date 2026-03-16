'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { cn } from '@/lib/cn';

interface LineItem {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

let lineKeyCounter = 0;
function nextKey(): string {
  lineKeyCounter += 1;
  return `cnl-${lineKeyCounter}`;
}

export default function NewCreditNotePage(): React.JSX.Element {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ key: nextKey(), description: '', quantity: '1', unitPrice: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const totalSatang = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      total += qty * price * 100;
    }
    return BigInt(Math.round(total));
  }, [lines]);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { key: nextKey(), description: '', quantity: '1', unitPrice: '' }]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const updateLine = useCallback((index: number, field: keyof Omit<LineItem, 'key'>, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!invoiceId.trim() || !customerId.trim() || !customerName.trim() || !reason.trim()) {
      showToast.error('Invoice ID, customer, and reason are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/credit-notes', {
        invoiceId: invoiceId.trim(),
        customerId: customerId.trim(),
        customerName: customerName.trim(),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          quantity: parseFloat(line.quantity),
          unitPriceSatang: String(Math.round(parseFloat(line.unitPrice) * 100)),
        })),
      });
      showToast.success('Credit note created');
      router.push('/credit-notes');
    } catch {
      showToast.error('Failed to create credit note');
    } finally {
      setSubmitting(false);
    }
  }, [invoiceId, customerId, customerName, reason, notes, lines, router]);

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">New Credit Note</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">ใบลดหนี้ — Create a credit note against an invoice</p>
      </div>

      <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="space-y-1.5">
          <label htmlFor="invoiceId" className="text-sm font-medium text-[var(--color-foreground)]">
            Original Invoice ID <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input id="invoiceId" type="text" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Invoice ID" className={inputClasses} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="customerId" className="text-sm font-medium text-[var(--color-foreground)]">
              Customer ID <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input id="customerId" type="text" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClasses} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="customerName" className="text-sm font-medium text-[var(--color-foreground)]">
              Customer Name <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input id="customerName" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reason" className="text-sm font-medium text-[var(--color-foreground)]">
            Reason <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Return goods, price correction, discount" className={inputClasses} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-foreground)]">Credit Lines</h2>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add Line
            </Button>
          </div>
          <div className="hidden grid-cols-[1fr_5rem_7rem_2.5rem] gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)] sm:grid">
            <span>Description</span><span>Qty</span><span>Unit Price (THB)</span><span />
          </div>
          {lines.map((line, i) => (
            <div key={line.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_7rem_2.5rem]">
              <input type="text" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description" className={inputClasses} />
              <input type="number" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} min="0" step="1" className={inputClasses} />
              <input type="number" value={line.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} min="0" step="0.01" className={inputClasses} />
              <div className="flex items-start pt-1">
                <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 1} aria-label="Remove line">
                  <Trash2 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-[var(--color-border)] pt-4">
          <span className="text-sm font-medium text-[var(--color-foreground)]">Total Credit:</span>
          <MoneyDisplay amount={totalSatang} size="lg" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-[var(--color-foreground)]">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(inputClasses, 'h-auto py-2')} />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>Create Credit Note</Button>
        </div>
      </div>
    </div>
  );
}
