'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';

const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

interface ContactForm {
  contactType: string; code: string; companyName: string;
  contactPerson: string; email: string; phone: string;
  taxId: string; branchNumber: string;
  addressLine1: string; addressLine2: string;
  city: string; province: string; postalCode: string; country: string;
  paymentTermsDays: string; notes: string;
}

export default function NewContactPage(): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<ContactForm>({
    contactType: 'customer', code: '', companyName: '',
    contactPerson: '', email: '', phone: '',
    taxId: '', branchNumber: '',
    addressLine1: '', addressLine2: '',
    city: '', province: '', postalCode: '', country: 'TH',
    paymentTermsDays: '30', notes: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (data: ContactForm) =>
      api.post('/contacts', {
        contactType: data.contactType,
        code: data.code || undefined,
        companyName: data.companyName,
        contactPerson: data.contactPerson || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        taxId: data.taxId || undefined,
        branchNumber: data.branchNumber || undefined,
        addressLine1: data.addressLine1 || undefined,
        addressLine2: data.addressLine2 || undefined,
        city: data.city || undefined,
        province: data.province || undefined,
        postalCode: data.postalCode || undefined,
        country: data.country,
        paymentTermsDays: parseInt(data.paymentTermsDays, 10),
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      showToast.success('Contact created');
      router.push('/contacts');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create contact');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!form.companyName.trim()) errs.push('Company name is required');
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    mutation.mutate(form);
  };

  const set = (field: keyof ContactForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="max-w-2xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Add Contact</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">Create a new customer, vendor, or business partner</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-[var(--color-border)] p-6">
        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Type *</label>
            <select value={form.contactType} onChange={set('contactType')} className={inputClasses}>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Code</label>
            <input type="text" value={form.code} onChange={set('code')} placeholder="e.g. CUST-001" className={inputClasses} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Company Name *</label>
          <input type="text" value={form.companyName} onChange={set('companyName')} placeholder="Company name" className={inputClasses} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Contact Person</label>
            <input type="text" value={form.contactPerson} onChange={set('contactPerson')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={inputClasses} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone</label>
            <input type="tel" value={form.phone} onChange={set('phone')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tax ID (เลขนิติบุคคล)</label>
            <input type="text" value={form.taxId} onChange={set('taxId')} placeholder="13-digit tax ID" className={inputClasses} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Address Line 1</label>
          <input type="text" value={form.addressLine1} onChange={set('addressLine1')} className={inputClasses} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">City</label>
            <input type="text" value={form.city} onChange={set('city')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Province</label>
            <input type="text" value={form.province} onChange={set('province')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Postal Code</label>
            <input type="text" value={form.postalCode} onChange={set('postalCode')} className={inputClasses} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Payment Terms (days)</label>
          <input type="number" min="0" value={form.paymentTermsDays} onChange={set('paymentTermsDays')} className={inputClasses} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>Create Contact</Button>
        </div>
      </form>
    </div>
  );
}
