'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface EmployeeDetail {
  id: string; employeeCode: string; titleTh: string | null;
  firstNameTh: string; lastNameTh: string;
  firstNameEn: string | null; lastNameEn: string | null;
  nickname: string | null; email: string | null; phone: string | null;
  nationalId: string | null; hireDate: string; position: string | null;
  departmentId: string | null; employmentType: string; status: string;
  salarySatang: number; bankAccountNumber: string | null; bankName: string | null;
  providentFundPercent: number; resignationDate: string | null;
  notes: string | null;
}

function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

function Field({ label, value }: { label: string; value: string | null | undefined }): React.JSX.Element {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="text-sm font-medium">{value ?? '—'}</p>
    </div>
  );
}

export default function EmployeeDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();

  const { data: employee, isLoading } = useQuery<EmployeeDetail>({
    queryKey: [tenantId, 'employees', id],
    queryFn: () => api.get<EmployeeDetail>(`/employees/${id}`),
  });

  const resignMutation = useMutation({
    mutationFn: () => api.post(`/employees/${id}/resign`, {
      resignationDate: new Date().toISOString().split('T')[0],
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'employees', id] });
      showToast.success('Employee resigned');
    },
    onError: (err: Error) => {
      showToast.error(err instanceof AppError ? err.message : 'Failed to process resignation');
    },
  });

  if (isLoading) return <div className="p-6"><SkeletonRow count={8} /></div>;
  if (!employee) return <div className="p-6 text-[var(--color-muted-foreground)]">Employee not found.</div>;

  const fullNameTh = [employee.titleTh, employee.firstNameTh, employee.lastNameTh].filter(Boolean).join(' ');
  const fullNameEn = [employee.firstNameEn, employee.lastNameEn].filter(Boolean).join(' ') || null;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{fullNameTh}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">{employee.employeeCode} — {employee.position ?? 'No position'}</p>
        </div>
        {employee.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Mark this employee as resigned?')) {
                resignMutation.mutate();
              }
            }}
            loading={resignMutation.isPending}
          >
            Process Resignation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="mb-4 font-semibold">Personal Information</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name (EN)" value={fullNameEn} />
            <Field label="Nickname" value={employee.nickname} />
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="National ID" value={employee.nationalId} />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="mb-4 font-semibold">Employment Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employment Type" value={employee.employmentType.replace('_', ' ')} />
            <Field label="Status" value={employee.status} />
            <Field label="Hire Date" value={employee.hireDate} />
            {employee.resignationDate && <Field label="Resignation Date" value={employee.resignationDate} />}
            <Field label="Monthly Salary" value={`฿${formatBaht(employee.salarySatang)}`} />
            <Field label="Provident Fund" value={`${String(employee.providentFundPercent)}%`} />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <h2 className="mb-4 font-semibold">Banking Information</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank" value={employee.bankName} />
            <Field label="Account Number" value={employee.bankAccountNumber} />
          </div>
        </div>

        {employee.notes && (
          <div className="rounded-lg border border-[var(--color-border)] p-5">
            <h2 className="mb-2 font-semibold">Notes</h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">{employee.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
