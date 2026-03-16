'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';

const INCOME_TYPES = [
  { value: '1', label: '1 — เงินเดือน ค่าจ้าง' },
  { value: '2', label: '2 — ค่าธรรมเนียม ค่านายหน้า' },
  { value: '3', label: '3 — ค่าแห่งลิขสิทธิ์' },
  { value: '4', label: '4 — ดอกเบี้ย' },
  { value: '5', label: '5 — เงินปันผล' },
  { value: '6', label: '6 — รางวัล การประกวด' },
  { value: '7', label: '7 — บัญชีลูกค้า' },
];

export default function NewWhtPage(): React.JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const [form, setForm] = useState({
    certificateType: 'pnd53',
    payerName: '',
    payerTaxId: '',
    payeeName: '',
    payeeTaxId: '',
    payeeAddress: '',
    incomeType: '2',
    incomeDescription: '',
    paymentDate: now.toISOString().slice(0, 10),
    incomeAmountThb: '',
    whtRatePercent: '3',
    taxMonth: String(now.getMonth() + 1),
    taxYear: String(now.getFullYear()),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

  const whtPreview = form.incomeAmountThb
    ? ((parseFloat(form.incomeAmountThb) * parseFloat(form.whtRatePercent)) / 100).toFixed(2)
    : '0.00';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const incomeSatang = String(Math.round(parseFloat(form.incomeAmountThb) * 100));
      const rateBp = Math.round(parseFloat(form.whtRatePercent) * 100);

      await api.post('/wht-certificates', {
        certificateType: form.certificateType,
        payerName: form.payerName,
        payerTaxId: form.payerTaxId.replace(/-/g, ''),
        payeeName: form.payeeName,
        payeeTaxId: form.payeeTaxId.replace(/-/g, ''),
        payeeAddress: form.payeeAddress,
        incomeType: form.incomeType,
        incomeDescription: form.incomeDescription,
        paymentDate: form.paymentDate,
        incomeAmountSatang: incomeSatang,
        whtRateBasisPoints: rateBp,
        taxMonth: parseInt(form.taxMonth, 10),
        taxYear: parseInt(form.taxYear, 10),
      });
      showToast.success('WHT certificate created');
      router.push('/wht');
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to create certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = 'block text-sm font-medium text-[var(--color-foreground)] mb-1';
  const inputClass = 'w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]';

  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      <div className="mb-6">
        <Link href="/wht" className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          <ChevronLeft className="h-4 w-4" />
          Back to WHT Certificates
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">New WHT Certificate (ใบหัก ณ ที่จ่าย)</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        {/* Certificate type */}
        <div>
          <label className={labelClass}>Certificate Type</label>
          <div className="flex gap-3">
            {['pnd3', 'pnd53'].map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="certType" value={t} checked={form.certificateType === t} onChange={set('certificateType')} />
                <span className="text-sm font-medium uppercase">{t === 'pnd3' ? 'ภ.ง.ด.3 (บุคคลธรรมดา)' : 'ภ.ง.ด.53 (นิติบุคคล)'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-muted-foreground)] uppercase">Payer (ผู้จ่ายเงิน)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Company Name *</label>
              <input className={inputClass} value={form.payerName} onChange={set('payerName')} required />
            </div>
            <div>
              <label className={labelClass}>Tax ID (13 digits) *</label>
              <input className={inputClass} value={form.payerTaxId} onChange={set('payerTaxId')} maxLength={13} required pattern="[0-9]{13}" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-muted-foreground)] uppercase">Payee (ผู้รับเงิน)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name *</label>
              <input className={inputClass} value={form.payeeName} onChange={set('payeeName')} required />
            </div>
            <div>
              <label className={labelClass}>Tax ID (13 digits) *</label>
              <input className={inputClass} value={form.payeeTaxId} onChange={set('payeeTaxId')} maxLength={13} required pattern="[0-9]{13}" />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelClass}>Address *</label>
            <textarea className={inputClass} rows={2} value={form.payeeAddress} onChange={set('payeeAddress')} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Income Type *</label>
            <select className={inputClass} value={form.incomeType} onChange={set('incomeType')}>
              {INCOME_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Payment Date *</label>
            <input type="date" className={inputClass} value={form.paymentDate} onChange={set('paymentDate')} required />
          </div>
        </div>

        <div>
          <label className={labelClass}>Income Description *</label>
          <input className={inputClass} value={form.incomeDescription} onChange={set('incomeDescription')} placeholder="e.g. Service fee for software development" required />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Income Amount (THB) *</label>
            <input type="number" step="0.01" min="0" className={inputClass} value={form.incomeAmountThb} onChange={set('incomeAmountThb')} required />
          </div>
          <div>
            <label className={labelClass}>WHT Rate (%) *</label>
            <input type="number" step="0.01" min="0" max="100" className={inputClass} value={form.whtRatePercent} onChange={set('whtRatePercent')} required />
          </div>
          <div>
            <label className={labelClass}>WHT Amount (preview)</label>
            <div className="flex h-9 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 text-sm font-medium">
              ฿{whtPreview}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tax Month *</label>
            <select className={inputClass} value={form.taxMonth} onChange={set('taxMonth')}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m)}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tax Year *</label>
            <input type="number" className={inputClass} value={form.taxYear} onChange={set('taxYear')} required />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/wht">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button variant="primary" type="submit" loading={submitting}>
            Create Certificate
          </Button>
        </div>
      </form>
    </div>
  );
}
