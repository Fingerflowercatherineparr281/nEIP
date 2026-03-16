'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'promptpay' | 'credit_card';

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'PromptPay', value: 'promptpay' },
  { label: 'Credit Card', value: 'credit_card' },
];

export default function NewReceiptPage(): React.JSX.Element {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amountBaht, setAmountBaht] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const amount = parseFloat(amountBaht);
    if (!customerId.trim() || !customerName.trim() || isNaN(amount) || amount <= 0 || !receiptDate) {
      showToast.error('Customer, amount, and date are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/receipts', {
        customerId: customerId.trim(),
        customerName: customerName.trim(),
        amountSatang: String(Math.round(amount * 100)),
        receiptDate,
        paymentMethod,
        reference: reference.trim() || undefined,
        invoiceId: invoiceId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast.success('Receipt issued successfully');
      router.push('/receipts');
    } catch {
      showToast.error('Failed to issue receipt');
    } finally {
      setSubmitting(false);
    }
  }, [customerId, customerName, amountBaht, receiptDate, paymentMethod, reference, invoiceId, notes, router]);

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Issue Receipt</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">ใบเสร็จรับเงิน — Issue an official payment receipt</p>
      </div>

      <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="amount" className="text-sm font-medium text-[var(--color-foreground)]">
              Amount (THB) <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input id="amount" type="number" min="0.01" step="0.01" value={amountBaht} onChange={(e) => setAmountBaht(e.target.value)} placeholder="0.00" className={inputClasses} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="receiptDate" className="text-sm font-medium text-[var(--color-foreground)]">
              Receipt Date <span className="text-[var(--color-destructive)]">*</span>
            </label>
            <input id="receiptDate" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="paymentMethod" className="text-sm font-medium text-[var(--color-foreground)]">
            Payment Method <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={inputClasses}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="reference" className="text-sm font-medium text-[var(--color-foreground)]">Reference</label>
            <input id="reference" type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. TRF-2026-001" className={inputClasses} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invoiceId" className="text-sm font-medium text-[var(--color-foreground)]">Invoice ID (optional)</label>
            <input id="invoiceId" type="text" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Invoice ID" className={inputClasses} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-[var(--color-foreground)]">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(inputClasses, 'h-auto py-2')} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>Issue Receipt</Button>
        </div>
      </div>
    </div>
  );
}
