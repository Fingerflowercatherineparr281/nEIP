'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Eye, FileCheck } from 'lucide-react';

import { useApi } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { MoneyDisplay } from '@/components/domain/money-display';

interface WhtCertificate {
  id: string;
  documentNumber: string;
  certificateType: string;
  payeeName: string;
  payeeTaxId: string;
  paymentDate: string;
  incomeAmountSatang: string;
  whtRateBasisPoints: number;
  whtAmountSatang: string;
  taxMonth: number;
  taxYear: number;
  status: string;
}

interface WhtListResponse {
  items: WhtCertificate[];
  total: number;
  hasMore: boolean;
}

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Issued', value: 'issued' },
  { label: 'Filed', value: 'filed' },
  { label: 'Voided', value: 'voided' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-600 bg-gray-100',
  issued: 'text-blue-600 bg-blue-50',
  filed: 'text-green-600 bg-green-50',
  voided: 'text-red-600 bg-red-50',
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function WhtPage(): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [taxYear, setTaxYear] = useState(String(currentYear));
  const [taxMonth, setTaxMonth] = useState(String(currentMonth));

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (status) p['status'] = status;
    if (taxYear) p['taxYear'] = taxYear;
    if (taxMonth) p['taxMonth'] = taxMonth;
    return p;
  }, [status, taxYear, taxMonth]);

  const { data, loading, refetch } = useApi<WhtListResponse>('/wht-certificates', params);
  const certs = data?.items ?? [];

  const handleIssue = async (cert: WhtCertificate): Promise<void> => {
    setIssuingId(cert.id);
    try {
      await api.post(`/wht-certificates/${cert.id}/issue`);
      showToast.success(`Certificate ${cert.documentNumber} issued`);
      refetch();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to issue certificate');
    } finally {
      setIssuingId(null);
    }
  };

  const inputClass = 'rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-1.5 text-sm';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
            WHT Certificates (ใบหัก ณ ที่จ่าย)
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            ภ.ง.ด.3 (บุคคลธรรมดา) และ ภ.ง.ด.53 (นิติบุคคล)
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/wht/summary">
            <Button variant="outline" size="sm">
              <FileCheck className="h-4 w-4" />
              Filing Summary
            </Button>
          </Link>
          <Link href="/wht/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              New Certificate
            </Button>
          </Link>
        </div>
      </div>

      {/* Period filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-muted-foreground)]">Year</label>
          <select className={inputClass} value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={String(y)}>{y + 543} (BE)</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-muted-foreground)]">Month</label>
          <select className={inputClass} value={taxMonth} onChange={(e) => setTaxMonth(e.target.value)}>
            <option value="">All months</option>
            {THAI_MONTHS.map((m, i) => (
              <option key={i + 1} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </div>
        <FilterBar
          searchValue=""
          onSearchChange={() => undefined}
          searchPlaceholder=""
          statusOptions={STATUS_OPTIONS}
          statusValue={status}
          onStatusChange={setStatus}
          resultCount={data?.total}
        />
      </div>

      {loading ? (
        <SkeletonRow count={5} />
      ) : certs.length === 0 ? (
        <EmptyState
          context="wht-list"
          ctaLabel="Create First Certificate"
          onCtaClick={() => router.push('/wht/new')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)]/30">
              <tr className="border-b border-[var(--color-border)] text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3 text-left">Document No.</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Payee</th>
                <th className="px-4 py-3 text-left">Payment Date</th>
                <th className="px-4 py-3 text-right">Income</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">WHT Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => (
                <tr key={cert.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/20">
                  <td className="px-4 py-3 font-mono text-xs">{cert.documentNumber}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 uppercase">
                      {cert.certificateType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{cert.payeeName}</div>
                    <div className="font-mono text-xs text-[var(--color-muted-foreground)]">{cert.payeeTaxId}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{cert.paymentDate}</td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={BigInt(cert.incomeAmountSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--color-muted-foreground)]">
                    {(cert.whtRateBasisPoints / 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    <MoneyDisplay amount={BigInt(cert.whtAmountSatang || 0)} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[cert.status] ?? ''}`}>
                      {cert.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/wht/${cert.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                      {cert.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={issuingId === cert.id}
                          onClick={() => void handleIssue(cert)}
                        >
                          Issue
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
