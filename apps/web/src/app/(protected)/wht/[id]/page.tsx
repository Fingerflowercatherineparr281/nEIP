'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Printer } from 'lucide-react';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';

interface WhtCertificate {
  id: string;
  documentNumber: string;
  certificateType: string;
  payerName: string;
  payerTaxId: string;
  payeeName: string;
  payeeTaxId: string;
  payeeAddress: string;
  incomeType: string;
  incomeDescription: string;
  paymentDate: string;
  incomeAmountSatang: string;
  whtRateBasisPoints: number;
  whtAmountSatang: string;
  taxMonth: number;
  taxYear: number;
  status: string;
  issuedAt: string | null;
  filedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-600 bg-gray-100',
  issued: 'text-blue-600 bg-blue-50',
  filed: 'text-green-600 bg-green-50',
  voided: 'text-red-600 bg-red-50',
};

export default function WhtCertificateDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: cert, loading, refetch } = useApi<WhtCertificate>(`/wht-certificates/${id}`);
  const [acting, setActing] = useState(false);

  const handleAction = async (action: 'issue' | 'void' | 'file'): Promise<void> => {
    setActing(true);
    try {
      await api.post(`/wht-certificates/${id}/${action}`);
      showToast.success(`Certificate ${action}d`);
      refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : `Failed to ${action} certificate`);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="p-4 lg:p-6"><SkeletonCard count={3} /></div>;
  if (!cert) return <div className="p-4 lg:p-6"><p>Certificate not found.</p></div>;

  const incomeThb = (parseInt(cert.incomeAmountSatang, 10) / 100).toFixed(2);
  const whtThb = (parseInt(cert.whtAmountSatang, 10) / 100).toFixed(2);
  const rate = (cert.whtRateBasisPoints / 100).toFixed(0);

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-6">
      <div className="mb-6">
        <Link href="/wht" className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          <ChevronLeft className="h-4 w-4" />
          Back to WHT Certificates
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{cert.documentNumber}</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {cert.certificateType.toUpperCase()} — {cert.taxMonth}/{cert.taxYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[cert.status] ?? ''}`}>
              {cert.status}
            </span>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Certificate body (print-friendly layout) */}
      <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-6">
        <div className="grid grid-cols-2 gap-4 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Payer (ผู้จ่ายเงิน)</p>
            <p className="mt-1 font-medium">{cert.payerName}</p>
            <p className="font-mono text-sm text-[var(--color-muted-foreground)]">{cert.payerTaxId}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Payee (ผู้รับเงิน)</p>
            <p className="mt-1 font-medium">{cert.payeeName}</p>
            <p className="font-mono text-sm text-[var(--color-muted-foreground)]">{cert.payeeTaxId}</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{cert.payeeAddress}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Income Type</p>
            <p className="mt-1">{cert.incomeType} — {cert.incomeDescription}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Payment Date</p>
            <p className="mt-1">{cert.paymentDate}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">WHT Rate</p>
            <p className="mt-1">{rate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-[var(--color-muted)]/20 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Income Amount</p>
            <p className="mt-1 text-xl font-semibold">฿{incomeThb}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">WHT Withheld</p>
            <p className="mt-1 text-xl font-semibold text-red-600">฿{whtThb}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-3">
        {cert.status === 'draft' && (
          <Button variant="primary" loading={acting} onClick={() => void handleAction('issue')}>
            Issue Certificate
          </Button>
        )}
        {cert.status === 'issued' && (
          <Button variant="outline" loading={acting} onClick={() => void handleAction('file')}>
            Mark as Filed
          </Button>
        )}
        {(cert.status === 'draft' || cert.status === 'issued') && (
          <Button variant="destructive" loading={acting} onClick={() => void handleAction('void')}>
            Void Certificate
          </Button>
        )}
      </div>
    </div>
  );
}
