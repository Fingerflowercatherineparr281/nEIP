'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';

interface ProductForm {
  sku: string; nameTh: string; nameEn: string;
  description: string; category: string; unit: string;
  costPriceSatang: string; sellingPriceSatang: string; minStockLevel: string;
}

const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

export default function NewProductPage(): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>({
    sku: '', nameTh: '', nameEn: '', description: '',
    category: '', unit: 'ชิ้น', costPriceSatang: '0',
    sellingPriceSatang: '0', minStockLevel: '0',
  });
  const [errors, setErrors] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (data: ProductForm) =>
      api.post('/products', {
        sku: data.sku,
        nameTh: data.nameTh,
        nameEn: data.nameEn,
        description: data.description || undefined,
        category: data.category || undefined,
        unit: data.unit,
        costPriceSatang: Math.round(parseFloat(data.costPriceSatang) * 100),
        sellingPriceSatang: Math.round(parseFloat(data.sellingPriceSatang) * 100),
        minStockLevel: parseInt(data.minStockLevel, 10),
      }),
    onSuccess: () => {
      showToast.success('Product created');
      router.push('/products');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create product');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!form.sku.trim()) errs.push('SKU is required');
    if (!form.nameTh.trim()) errs.push('Thai name is required');
    if (!form.nameEn.trim()) errs.push('English name is required');
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    mutation.mutate(form);
  };

  const set = (field: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="max-w-2xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Add Product</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">Create a new product in the catalog</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] p-6">
        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">SKU *</label>
            <input type="text" value={form.sku} onChange={set('sku')} placeholder="e.g. PRD-001" className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Unit *</label>
            <select value={form.unit} onChange={set('unit')} className={inputClasses}>
              <option value="ชิ้น">ชิ้น</option>
              <option value="กล่อง">กล่อง</option>
              <option value="kg">kg</option>
              <option value="ลิตร">ลิตร</option>
              <option value="เมตร">เมตร</option>
              <option value="ชุด">ชุด</option>
              <option value="อัน">อัน</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Name (Thai) *</label>
          <input type="text" value={form.nameTh} onChange={set('nameTh')} placeholder="ชื่อสินค้า" className={inputClasses} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Name (English) *</label>
          <input type="text" value={form.nameEn} onChange={set('nameEn')} placeholder="Product Name" className={inputClasses} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Category</label>
          <input type="text" value={form.category} onChange={set('category')} placeholder="e.g. Electronics" className={inputClasses} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Description</label>
          <textarea value={form.description} onChange={set('description')} rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Cost Price (฿)</label>
            <input type="number" step="0.01" min="0" value={form.costPriceSatang} onChange={set('costPriceSatang')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Selling Price (฿)</label>
            <input type="number" step="0.01" min="0" value={form.sellingPriceSatang} onChange={set('sellingPriceSatang')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Min Stock Level</label>
            <input type="number" min="0" value={form.minStockLevel} onChange={set('minStockLevel')} className={inputClasses} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>Create Product</Button>
        </div>
      </form>
    </div>
  );
}
