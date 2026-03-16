'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

interface DnLine {
  key: string;
  salesOrderLineId: string;
  description: string;
  quantityDelivered: string;
}

let lineKeyCounter = 0;
function nextKey(): string {
  lineKeyCounter += 1;
  return `dnl-${lineKeyCounter}`;
}

export default function NewDeliveryNotePage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [salesOrderId, setSalesOrderId] = useState(searchParams.get('soId') ?? '');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DnLine[]>([{ key: nextKey(), salesOrderLineId: '', description: '', quantityDelivered: '1' }]);
  const [submitting, setSubmitting] = useState(false);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { key: nextKey(), salesOrderLineId: '', description: '', quantityDelivered: '1' }]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const updateLine = useCallback((index: number, field: keyof Omit<DnLine, 'key'>, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!salesOrderId.trim() || !customerId.trim() || !customerName.trim() || !deliveryDate) {
      showToast.error('Sales order ID, customer, and delivery date are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/delivery-notes', {
        salesOrderId: salesOrderId.trim(),
        customerId: customerId.trim(),
        customerName: customerName.trim(),
        deliveryDate,
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          salesOrderLineId: line.salesOrderLineId.trim(),
          description: line.description.trim(),
          quantityDelivered: parseFloat(line.quantityDelivered),
        })),
      });
      showToast.success('Delivery note created');
      router.push('/delivery-notes');
    } catch {
      showToast.error('Failed to create delivery note');
    } finally {
      setSubmitting(false);
    }
  }, [salesOrderId, customerId, customerName, deliveryDate, notes, lines, router]);

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">New Delivery Note</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">ใบส่งของ — Create a delivery note from a sales order</p>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="space-y-1.5">
          <label htmlFor="soId" className="text-sm font-medium text-[var(--color-foreground)]">
            Sales Order ID <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input id="soId" type="text" value={salesOrderId} onChange={(e) => setSalesOrderId(e.target.value)} placeholder="SO-YYYYMMDD-NNN" className={inputClasses} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="customerId" className="text-sm font-medium text-[var(--color-foreground)]">
              Customer ID <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input id="customerId" type="text" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="CUST-001" className={inputClasses} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="customerName" className="text-sm font-medium text-[var(--color-foreground)]">
              Customer Name <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input id="customerName" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className={inputClasses} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="deliveryDate" className="text-sm font-medium text-[var(--color-foreground)]">
            Delivery Date <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <input id="deliveryDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputClasses} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-foreground)]">Delivery Lines</h2>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add Line
            </Button>
          </div>
          {lines.map((line, i) => (
            <div key={line.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_5rem_2.5rem]">
              <input type="text" value={line.salesOrderLineId} onChange={(e) => updateLine(i, 'salesOrderLineId', e.target.value)} placeholder="SO Line ID" className={inputClasses} />
              <input type="text" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description" className={inputClasses} />
              <input type="number" value={line.quantityDelivered} onChange={(e) => updateLine(i, 'quantityDelivered', e.target.value)} placeholder="Qty" min="0" step="1" className={inputClasses} />
              <div className="flex items-start pt-1">
                <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 1} aria-label="Remove line">
                  <Trash2 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-[var(--color-foreground)]">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(inputClasses, 'h-auto py-2')} />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>Create Delivery Note</Button>
        </div>
      </div>
    </div>
  );
}
