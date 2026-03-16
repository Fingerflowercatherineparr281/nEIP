'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';

export default function NewFixedAssetPage(): React.JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    assetCode: '',
    nameTh: '',
    nameEn: '',
    category: 'equipment',
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCostSatang: '',
    salvageValueSatang: '0',
    usefulLifeMonths: '60',
    depreciationMethod: 'straight_line',
    glAccountId: '',
    depreciationAccountId: '',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!form.assetCode || !form.nameTh || !form.nameEn || !form.purchaseCostSatang) {
      showToast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const costSatang = String(Math.round(parseFloat(form.purchaseCostSatang) * 100));
      const salvageSatang = String(Math.round(parseFloat(form.salvageValueSatang || '0') * 100));

      await api.post('/fixed-assets', {
        assetCode: form.assetCode,
        nameTh: form.nameTh,
        nameEn: form.nameEn,
        category: form.category,
        purchaseDate: form.purchaseDate,
        purchaseCostSatang: costSatang,
        salvageValueSatang: salvageSatang,
        usefulLifeMonths: parseInt(form.usefulLifeMonths, 10),
        depreciationMethod: form.depreciationMethod,
        glAccountId: form.glAccountId || undefined,
        depreciationAccountId: form.depreciationAccountId || undefined,
      });
      showToast.success('Fixed asset registered successfully');
      router.push('/fixed-assets');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register asset';
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = 'block text-sm font-medium text-[var(--color-foreground)] mb-1';
  const inputClass = 'w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]';

  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/fixed-assets" className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          <ChevronLeft className="h-4 w-4" />
          Back to Fixed Assets
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Register New Fixed Asset</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">Add a new asset to the fixed asset register</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Asset Code *</label>
            <input className={inputClass} value={form.assetCode} onChange={handleChange('assetCode')} placeholder="FA-2026-001" required />
          </div>
          <div>
            <label className={labelClass}>Category *</label>
            <select className={inputClass} value={form.category} onChange={handleChange('category')}>
              <option value="land">Land</option>
              <option value="building">Building</option>
              <option value="equipment">Equipment</option>
              <option value="vehicle">Vehicle</option>
              <option value="furniture">Furniture</option>
              <option value="it_equipment">IT Equipment</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Name (Thai) *</label>
          <input className={inputClass} value={form.nameTh} onChange={handleChange('nameTh')} placeholder="ชื่อสินทรัพย์ภาษาไทย" required />
        </div>
        <div>
          <label className={labelClass}>Name (English) *</label>
          <input className={inputClass} value={form.nameEn} onChange={handleChange('nameEn')} placeholder="Asset name in English" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Purchase Date *</label>
            <input type="date" className={inputClass} value={form.purchaseDate} onChange={handleChange('purchaseDate')} required />
          </div>
          <div>
            <label className={labelClass}>Purchase Cost (THB) *</label>
            <input type="number" step="0.01" min="0" className={inputClass} value={form.purchaseCostSatang} onChange={handleChange('purchaseCostSatang')} placeholder="0.00" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Salvage Value (THB)</label>
            <input type="number" step="0.01" min="0" className={inputClass} value={form.salvageValueSatang} onChange={handleChange('salvageValueSatang')} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Useful Life (months) *</label>
            <input type="number" min="1" className={inputClass} value={form.usefulLifeMonths} onChange={handleChange('usefulLifeMonths')} required />
          </div>
        </div>

        <div>
          <label className={labelClass}>Depreciation Method</label>
          <select className={inputClass} value={form.depreciationMethod} onChange={handleChange('depreciationMethod')}>
            <option value="straight_line">Straight Line (เส้นตรง)</option>
            <option value="declining_balance">Declining Balance (ลดยอดคงเหลือ)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>GL Asset Account ID</label>
            <input className={inputClass} value={form.glAccountId} onChange={handleChange('glAccountId')} placeholder="Account UUID" />
          </div>
          <div>
            <label className={labelClass}>Depreciation Account ID</label>
            <input className={inputClass} value={form.depreciationAccountId} onChange={handleChange('depreciationAccountId')} placeholder="Account UUID" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/fixed-assets">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button variant="primary" type="submit" loading={submitting}>
            Register Asset
          </Button>
        </div>
      </form>
    </div>
  );
}
