'use client';

import { useCallback, useState } from 'react';
import { ArrowLeft, Mail, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'invited' | 'disabled';
}

interface TeamListResponse {
  data: TeamMember[];
}

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Owner', value: 'owner' },
  { label: 'Admin', value: 'admin' },
  { label: 'Accountant', value: 'accountant' },
  { label: 'Viewer', value: 'viewer' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamSettingsPage(): React.JSX.Element {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.role === 'owner';

  const { data, loading, refetch } = useApi<TeamListResponse>('/settings/team');
  const members = data?.data ?? [];

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('accountant');
  const [inviting, setInviting] = useState(false);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post('/settings/team/invite', {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      showToast.success(`Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail('');
      refetch();
    } catch {
      showToast.error('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteRole, refetch]);

  const handleRoleChange = useCallback(
    async (memberId: string, newRole: UserRole) => {
      try {
        await api.patch(`/settings/team/${memberId}`, { role: newRole });
        showToast.success('Role updated');
        refetch();
      } catch {
        showToast.error('Failed to update role');
      }
    },
    [refetch],
  );

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  const selectClasses = cn(
    'h-9 rounded-md border border-[var(--color-input)] bg-transparent px-2 text-sm',
    'text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  const statusBadge = (status: TeamMember['status']): React.JSX.Element => {
    const colors = {
      active: 'bg-[var(--color-hitl-auto-bg)] text-[var(--color-hitl-auto-foreground)]',
      invited: 'bg-[var(--color-hitl-review-bg)] text-[var(--color-hitl-review-foreground)]',
      disabled: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
    };
    return (
      <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', colors[status])}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} aria-label="Back to settings">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Team Members</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Manage users and their roles
            </p>
          </div>
        </div>
        {isOwner && (
          <Button variant="primary" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members table */}
      {loading ? (
        <SkeletonRow count={4} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/30"
                >
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{member.email}</td>
                  <td className="px-4 py-3">
                    {isOwner && member.id !== currentUser?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                        className={selectClasses}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm capitalize">{member.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(member.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog
        open={showInvite}
        onOpenChange={setShowInvite}
        title="Invite Team Member"
        description="Send an invitation to join your organization"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="inviteEmail" className="text-sm font-medium text-[var(--color-foreground)]">
              Email
            </label>
            <input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inviteRole" className="text-sm font-medium text-[var(--color-foreground)]">
              Role
            </label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className={cn(inputClasses, 'w-full')}
            >
              {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInvite} loading={inviting}>
              <Mail className="h-4 w-4" />
              Send Invite
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
