'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface LeaveRequest {
  id: string; employeeId: string; leaveTypeId: string;
  startDate: string; endDate: string; days: number;
  reason: string | null; status: string;
  approvedBy: string | null; approvedAt: string | null;
  createdAt: string;
}

interface LeaveListResponse { items: LeaveRequest[]; total: number; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function LeavePage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (statusFilter !== 'all') p['status'] = statusFilter;
    return p;
  }, [statusFilter]);

  const { data, isLoading } = useQuery<LeaveListResponse>({
    queryKey: [tenantId, 'leave-requests', params],
    queryFn: () => api.get<LeaveListResponse>('/leave-requests', params),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leave-requests/${id}/approve`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'leave-requests'] });
      showToast.success('Leave request approved');
    },
    onError: (err: Error) => showToast.error(err instanceof AppError ? err.message : 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leave-requests/${id}/reject`, { reason: 'Rejected by manager' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [tenantId, 'leave-requests'] });
      showToast.success('Leave request rejected');
    },
    onError: (err: Error) => showToast.error(err instanceof AppError ? err.message : 'Failed'),
  });

  const requests = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leave Requests</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Employee leave management</p>
        </div>
        <Link href="/leave/new">
          <Button variant="primary"><Plus className="h-4 w-4" />New Request</Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonRow count={5} />
      ) : requests.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No leave requests"
          description="No leave requests match the current filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Period</th>
                <th className="px-4 py-3 text-center font-medium text-[var(--color-muted-foreground)]">Days</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Reason</th>
                <th className="px-4 py-3 text-center font-medium text-[var(--color-muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3 font-mono text-xs">{req.employeeId}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {req.startDate} — {req.endDate}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{req.days}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)] max-w-xs truncate">{req.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[req.status] ?? ''}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {req.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => approveMutation.mutate(req.id)}
                          loading={approveMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rejectMutation.mutate(req.id)}
                          loading={rejectMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
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
