'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Printer } from 'lucide-react';
import Link from 'next/link';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { DocumentStatus } from '@/components/domain/document-status';
import type { DocumentStatusValue } from '@/components/domain/document-status';

// ---------------------------------------------------------------------------
// Types — matched to actual API response
// ---------------------------------------------------------------------------

interface InvoiceLine {
  id?: string;
  description?: string;
  quantity?: number;
  /** Unit price in satang */
  unitPriceSatang?: number | string;
  /** Line total in satang */
  amountSatang?: number | string;
}

interface InvoiceDetail {
  id: string;
  /** API field name */
  invoiceNumber: string;
  customerId: string;
  createdAt: string;
  dueDate: string;
  status: DocumentStatusValue;
  /** Total in satang (may be string from API) */
  totalSatang: number | string;
  subTotalSatang?: number | string;
  vatAmountSatang?: number | string;
  grandTotalSatang?: number | string;
  paidSatang?: number | string;
  lines: InvoiceLine[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const { data: invoice, loading, refetch } = useApi<InvoiceDetail>(`/invoices/${id}`);
  const [showVoid, setShowVoid] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const handleVoid = useCallback(async () => {
    setVoiding(true);
    try {
      await api.post(`/invoices/${id}/void`);
      showToast.success(`Invoice ${invoice?.invoiceNumber ?? ''} voided`);
      setShowVoid(false);
      refetch();
    } catch {
      showToast.error('Failed to void invoice');
    } finally {
      setVoiding(false);
    }
  }, [id, invoice?.invoiceNumber, refetch]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 lg:p-6">
        <SkeletonCard variant="invoice" count={1} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 lg:p-6">
        <p className="text-[var(--color-muted-foreground)]">Invoice not found.</p>
        <Link href="/invoices">
          <Button variant="link" className="mt-2">Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  // Use grandTotalSatang if available, otherwise totalSatang
  const displayTotal = invoice.grandTotalSatang ?? invoice.totalSatang;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Invoice Detail
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          {invoice.status !== 'voided' && (
            <Button variant="destructive" size="sm" onClick={() => setShowVoid(true)}>
              <Ban className="h-3.5 w-3.5" />
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Invoice card */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Meta */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Customer ID
            </span>
            <p className="mt-1 text-sm font-mono font-medium text-[var(--color-foreground)]">
              {invoice.customerId}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Created
            </span>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">
              {new Date(invoice.createdAt).toLocaleDateString('th-TH')}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Due Date
            </span>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">
              {new Date(invoice.dueDate).toLocaleDateString('th-TH')}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Status
            </span>
            <div className="mt-1">
              <DocumentStatus status={invoice.status} size="md" />
            </div>
          </div>
        </div>

        {/* Summary amounts */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {invoice.subTotalSatang !== undefined && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Sub Total
              </span>
              <div className="mt-1">
                <MoneyDisplay amount={BigInt(invoice.subTotalSatang)} size="sm" />
              </div>
            </div>
          )}
          {invoice.vatAmountSatang !== undefined && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                VAT
              </span>
              <div className="mt-1">
                <MoneyDisplay amount={BigInt(invoice.vatAmountSatang)} size="sm" />
              </div>
            </div>
          )}
          {invoice.paidSatang !== undefined && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Paid
              </span>
              <div className="mt-1">
                <MoneyDisplay amount={BigInt(invoice.paidSatang)} size="sm" />
              </div>
            </div>
          )}
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-[var(--color-muted-foreground)]">
                    No line items
                  </td>
                </tr>
              ) : (
                invoice.lines.map((line, idx) => (
                  <tr key={line.id ?? idx} className="border-b border-[var(--color-border)]">
                    <td className="px-3 py-2">{line.description ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono-figures">{line.quantity ?? 1}</td>
                    <td className="px-3 py-2 text-right">
                      {line.unitPriceSatang !== undefined ? (
                        <MoneyDisplay amount={BigInt(line.unitPriceSatang)} size="sm" />
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {line.amountSatang !== undefined ? (
                        <MoneyDisplay amount={BigInt(line.amountSatang)} size="sm" />
                      ) : (
                        <span className="text-[var(--color-muted-foreground)]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td colSpan={3} className="px-3 py-3 text-right text-[var(--color-foreground)]">
                  Grand Total
                </td>
                <td className="px-3 py-3 text-right">
                  <MoneyDisplay amount={BigInt(displayTotal)} size="md" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-4 rounded-md bg-[var(--color-muted)] p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Notes
            </span>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Void Confirm Dialog */}
      <ConfirmDialog
        open={showVoid}
        onOpenChange={setShowVoid}
        title="Void Invoice"
        description={`Are you sure you want to void ${invoice.invoiceNumber}? This action cannot be undone.`}
        confirmLabel="Void Invoice"
        confirmVariant="destructive"
        onConfirm={handleVoid}
        loading={voiding}
      />
    </div>
  );
}
