'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Copy,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'converted' | 'expired';

interface QuotationLine {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPriceSatang: string;
  amountSatang: string;
}

interface QuotationDetail {
  id: string;
  documentNumber: string;
  customerId: string;
  customerName: string;
  subject: string;
  notes: string | null;
  status: QuotationStatus;
  validUntil: string;
  totalSatang: string;
  convertedInvoiceId: string | null;
  lines: QuotationLine[];
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft (กำลังร่าง)',
  sent: 'Sent (ส่งแล้ว)',
  approved: 'Approved (อนุมัติแล้ว)',
  rejected: 'Rejected (ปฏิเสธ)',
  converted: 'Converted (แปลงเป็น Invoice)',
  expired: 'Expired (หมดอายุ)',
};

const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  converted: 'bg-purple-50 text-purple-700 border-purple-200',
  expired: 'bg-orange-50 text-orange-700 border-orange-200',
};

// ---------------------------------------------------------------------------
// Timeline step component
// ---------------------------------------------------------------------------

interface TimelineStep {
  label: string;
  date: string | null;
  active: boolean;
  completed: boolean;
}

function StatusTimeline({ status, q }: { status: QuotationStatus; q: QuotationDetail }): React.JSX.Element {
  const steps: TimelineStep[] = [
    {
      label: 'Draft',
      date: q.createdAt,
      active: status === 'draft',
      completed: status !== 'draft',
    },
    {
      label: 'Sent',
      date: q.sentAt,
      active: status === 'sent',
      completed: ['approved', 'rejected', 'converted'].includes(status),
    },
    {
      label: 'Approved',
      date: q.approvedAt,
      active: status === 'approved',
      completed: status === 'converted',
    },
    {
      label: 'Converted',
      date: null,
      active: status === 'converted',
      completed: false,
    },
  ];

  // For rejected/expired show different path
  if (status === 'rejected' || status === 'expired') {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium',
            STATUS_COLORS[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
        {q.rejectedAt && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            on {new Date(q.rejectedAt).toLocaleDateString('th-TH')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div
            className={cn(
              'flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors',
              step.active
                ? 'bg-blue-600 text-white'
                : step.completed
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-400',
            )}
          >
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-6',
                step.completed ? 'bg-green-400' : 'bg-slate-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QuotationDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const { data: quotation, loading, refetch } = useApi<QuotationDetail>(
    `/quotations/${id}`,
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleAction = useCallback(
    async (action: string, body?: Record<string, string>) => {
      setActionLoading(action);
      try {
        if (action === 'convert') {
          const result = await api.post<{ invoiceId: string; invoiceNumber: string }>(
            `/quotations/${id}/convert`,
          );
          if ('invoiceId' in result) {
            const r = result as { invoiceId: string; invoiceNumber: string };
            showToast.success(`Invoice ${r.invoiceNumber} created successfully`);
            refetch();
          }
        } else {
          await api.post(`/quotations/${id}/${action}`, body);
          showToast.success(`Quotation ${action}ed successfully`);
          refetch();
        }
      } catch {
        showToast.error(`Failed to ${action} quotation`);
      } finally {
        setActionLoading(null);
      }
    },
    [id, refetch],
  );

  const handleDuplicate = useCallback(async () => {
    setActionLoading('duplicate');
    try {
      const result = await api.post<{ documentNumber: string }>(
        `/quotations/${id}/duplicate`,
      );
      if ('documentNumber' in result) {
        showToast.success(`Duplicated as ${String((result as { documentNumber: string }).documentNumber)}`);
        router.push('/quotations');
      }
    } catch {
      showToast.error('Failed to duplicate quotation');
    } finally {
      setActionLoading(null);
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 lg:p-6">
        <SkeletonCard variant="invoice" count={1} />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-4 lg:p-6">
        <p className="text-[var(--color-muted-foreground)]">Quotation not found.</p>
        <Link href="/quotations">
          <Button variant="link" className="mt-2">
            Back to Quotations
          </Button>
        </Link>
      </div>
    );
  }

  const isExpired =
    quotation.status !== 'converted' &&
    quotation.status !== 'rejected' &&
    new Date(quotation.validUntil) < new Date();

  const displayStatus: QuotationStatus =
    isExpired && quotation.status === 'sent' ? 'expired' : quotation.status;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
              {quotation.documentNumber}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              ใบเสนอราคา — {quotation.subject}
            </p>
          </div>
        </div>

        {/* Action buttons by status */}
        <div className="flex flex-wrap gap-2">
          {quotation.status === 'draft' && (
            <>
              <Link href={`/quotations/${id}/edit`}>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading === 'send'}
                onClick={() => void handleAction('send')}
              >
                <Send className="h-3.5 w-3.5" />
                Send to Customer
              </Button>
            </>
          )}

          {quotation.status === 'sent' && !isExpired && (
            <>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading === 'approve'}
                onClick={() => void handleAction('approve')}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </Button>
              {!showRejectInput ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowRejectInput(true)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              ) : null}
            </>
          )}

          {quotation.status === 'approved' && (
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading === 'convert'}
              onClick={() => void handleAction('convert')}
            >
              <FileText className="h-3.5 w-3.5" />
              Convert to Invoice
            </Button>
          )}

          {quotation.status === 'converted' && quotation.convertedInvoiceId && (
            <Link href={`/invoices/${quotation.convertedInvoiceId}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                View Invoice
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            loading={actionLoading === 'duplicate'}
            onClick={() => void handleDuplicate()}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
        </div>
      </div>

      {/* Reject inline form */}
      {showRejectInput && quotation.status === 'sent' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">
            Rejection Reason (optional)
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-red-400"
            rows={2}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              loading={actionLoading === 'reject'}
              onClick={() =>
                void handleAction('reject', rejectReason ? { reason: rejectReason } : undefined)
              }
            >
              Confirm Rejection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRejectInput(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Status timeline */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Status Progress
        </p>
        <StatusTimeline status={displayStatus} q={quotation} />
      </div>

      {/* Quotation card */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Meta grid */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Customer
            </span>
            <p className="mt-1 text-sm font-medium text-[var(--color-foreground)]">
              {quotation.customerName}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Subject
            </span>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">{quotation.subject}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Valid Until
            </span>
            <p
              className={cn(
                'mt-1 text-sm',
                isExpired
                  ? 'font-medium text-orange-600'
                  : 'text-[var(--color-foreground)]',
              )}
            >
              {new Date(quotation.validUntil).toLocaleDateString('th-TH')}
              {isExpired && ' (Expired)'}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Status
            </span>
            <div className="mt-1">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  STATUS_COLORS[displayStatus],
                )}
              >
                {STATUS_LABELS[displayStatus]}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Created
            </span>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">
              {new Date(quotation.createdAt).toLocaleDateString('th-TH')}
            </p>
          </div>
          {quotation.convertedInvoiceId && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Invoice
              </span>
              <Link href={`/invoices/${quotation.convertedInvoiceId}`}>
                <p className="mt-1 flex items-center gap-1 text-sm text-purple-600 underline">
                  View Invoice
                  <ExternalLink className="h-3 w-3" />
                </p>
              </Link>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--color-border)]">
                  <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                    {line.lineNumber}
                  </td>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <MoneyDisplay amount={BigInt(line.unitPriceSatang)} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyDisplay amount={BigInt(line.amountSatang)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={4} className="px-3 py-3 text-right text-[var(--color-foreground)]">
                  Total
                </td>
                <td className="px-3 py-3 text-right">
                  <MoneyDisplay amount={BigInt(quotation.totalSatang)} size="md" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {quotation.notes && (
          <div className="mt-4 rounded-md bg-[var(--color-muted)] p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Notes
            </span>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-foreground)]">
              {quotation.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
