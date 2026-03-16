'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface Employee {
  id: string; employeeCode: string; titleTh: string | null;
  firstNameTh: string; lastNameTh: string; email: string | null;
  position: string | null; departmentId: string | null;
  employmentType: string; status: string; hireDate: string;
}

interface EmployeeListResponse { items: Employee[]; total: number; }

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  resigned: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  terminated: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function EmployeesPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (statusFilter !== 'all') p['status'] = statusFilter;
    return p;
  }, [search, statusFilter]);

  const { data, isLoading } = useQuery<EmployeeListResponse>({
    queryKey: [tenantId, 'employees', params],
    queryFn: () => api.get<EmployeeListResponse>('/employees', params),
  });

  const employees = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Human resources — employee directory</p>
        </div>
        <Link href="/employees/new">
          <Button variant="primary"><Plus className="h-4 w-4" />Add Employee</Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="resigned">Resigned</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code, email..."
        resultCount={data?.total}
      />

      {isLoading ? (
        <SkeletonRow count={5} />
      ) : employees.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No employees found"
          description={search ? 'Try adjusting your search.' : 'Add your first employee.'}
          {...(!search ? { ctaLabel: 'Add Employee', onCtaClick: () => { window.location.href = '/employees/new'; } } : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Code</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Position</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Hire Date</th>
                <th className="px-4 py-3 text-center font-medium text-[var(--color-muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono text-xs">{emp.employeeCode}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{[emp.titleTh, emp.firstNameTh, emp.lastNameTh].filter(Boolean).join(' ')}</div>
                    {emp.email && <div className="text-xs text-[var(--color-muted-foreground)]">{emp.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{emp.position ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-[var(--color-muted-foreground)]">
                    {emp.employmentType.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{emp.hireDate}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[emp.status] ?? ''}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/employees/${emp.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
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
