'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';

const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

export default function NewEmployeePage(): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeCode: '', titleTh: '', firstNameTh: '', lastNameTh: '',
    firstNameEn: '', lastNameEn: '', nickname: '',
    email: '', phone: '', nationalId: '', hireDate: '',
    position: '', employmentType: 'full_time', salarySatang: '0',
    bankAccountNumber: '', bankName: '', providentFundPercent: '0', notes: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/employees', {
        employeeCode: data.employeeCode,
        titleTh: data.titleTh || undefined,
        firstNameTh: data.firstNameTh,
        lastNameTh: data.lastNameTh,
        firstNameEn: data.firstNameEn || undefined,
        lastNameEn: data.lastNameEn || undefined,
        nickname: data.nickname || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        nationalId: data.nationalId || undefined,
        hireDate: data.hireDate,
        position: data.position || undefined,
        employmentType: data.employmentType,
        salarySatang: Math.round(parseFloat(data.salarySatang) * 100),
        bankAccountNumber: data.bankAccountNumber || undefined,
        bankName: data.bankName || undefined,
        providentFundPercent: parseInt(data.providentFundPercent, 10),
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      showToast.success('Employee created');
      router.push('/employees');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to create employee');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!form.employeeCode.trim()) errs.push('Employee code is required');
    if (!form.firstNameTh.trim()) errs.push('Thai first name is required');
    if (!form.lastNameTh.trim()) errs.push('Thai last name is required');
    if (!form.hireDate) errs.push('Hire date is required');
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    mutation.mutate(form);
  };

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="max-w-2xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Add Employee</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">Create a new employee record</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-[var(--color-border)] p-6">
        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Employee Code *</label>
            <input type="text" value={form.employeeCode} onChange={set('employeeCode')} placeholder="EMP-001" className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Title (คำนำหน้า)</label>
            <select value={form.titleTh} onChange={set('titleTh')} className={inputClasses}>
              <option value="">—</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Type *</label>
            <select value={form.employmentType} onChange={set('employmentType')} className={inputClasses}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">First Name (TH) *</label>
            <input type="text" value={form.firstNameTh} onChange={set('firstNameTh')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Last Name (TH) *</label>
            <input type="text" value={form.lastNameTh} onChange={set('lastNameTh')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">First Name (EN)</label>
            <input type="text" value={form.firstNameEn} onChange={set('firstNameEn')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Last Name (EN)</label>
            <input type="text" value={form.lastNameEn} onChange={set('lastNameEn')} className={inputClasses} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone</label>
            <input type="tel" value={form.phone} onChange={set('phone')} className={inputClasses} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">National ID (บัตรประชาชน)</label>
            <input type="text" value={form.nationalId} onChange={set('nationalId')} placeholder="13 digits" maxLength={13} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Hire Date *</label>
            <input type="date" value={form.hireDate} onChange={set('hireDate')} className={inputClasses} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Position</label>
          <input type="text" value={form.position} onChange={set('position')} className={inputClasses} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Salary (฿/month)</label>
            <input type="number" step="0.01" min="0" value={form.salarySatang} onChange={set('salarySatang')} className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bank</label>
            <input type="text" value={form.bankName} onChange={set('bankName')} placeholder="e.g. SCB" className={inputClasses} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Account Number</label>
            <input type="text" value={form.bankAccountNumber} onChange={set('bankAccountNumber')} className={inputClasses} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Provident Fund %</label>
          <input type="number" min="0" max="15" value={form.providentFundPercent} onChange={set('providentFundPercent')} className={inputClasses} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>Create Employee</Button>
        </div>
      </form>
    </div>
  );
}
