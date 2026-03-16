'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const inputClasses = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';

interface LeaveType { id: string; code: string; nameTh: string; nameEn: string; annualQuotaDays: number; }
interface LeaveTypesResponse { items: LeaveType[]; }

export default function NewLeaveRequestPage(): React.JSX.Element {
  const router = useRouter();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const [form, setForm] = useState({
    employeeId: '', leaveTypeId: '', startDate: '', endDate: '', days: '1', reason: '',
  });

  const { data: leaveTypesData } = useQuery<LeaveTypesResponse>({
    queryKey: [tenantId, 'leave-types'],
    queryFn: () => api.get<LeaveTypesResponse>('/leave-types'),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/leave-requests', {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        days: parseInt(data.days, 10),
        reason: data.reason || undefined,
      }),
    onSuccess: () => {
      showToast.success('Leave request submitted');
      router.push('/leave');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to submit leave request');
    },
  });

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.leaveTypeId || !form.startDate || !form.endDate) {
      showToast.error('Please fill all required fields');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <div className="max-w-lg space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Leave Request</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">Submit a leave request for an employee</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Employee ID *</label>
          <input type="text" value={form.employeeId} onChange={set('employeeId')} placeholder="Employee ID" className={inputClasses} required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Leave Type *</label>
          <select value={form.leaveTypeId} onChange={set('leaveTypeId')} className={inputClasses} required>
            <option value="">Select leave type...</option>
            {(leaveTypesData?.items ?? []).map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.nameTh} ({lt.nameEn}) — {lt.annualQuotaDays} days/year
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Start Date *</label>
            <input type="date" value={form.startDate} onChange={set('startDate')} className={inputClasses} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">End Date *</label>
            <input type="date" value={form.endDate} onChange={set('endDate')} className={inputClasses} required />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Number of Days</label>
          <input type="number" min="1" value={form.days} onChange={set('days')} className={inputClasses} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Reason</label>
          <textarea value={form.reason} onChange={set('reason')} rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primary" type="submit" loading={mutation.isPending}>Submit Request</Button>
        </div>
      </form>
    </div>
  );
}
