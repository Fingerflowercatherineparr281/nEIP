'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { InlineAlert } from '@/components/ui/toast';
import { showToast } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgSetupPayload {
  name: string;
  businessType: string;
}

interface InviteMember {
  email: string;
  role: string;
}

const BUSINESS_TYPES = [
  { value: 'retail', label: 'ค้าปลีก (Retail)' },
  { value: 'wholesale', label: 'ค้าส่ง (Wholesale)' },
  { value: 'service', label: 'บริการ (Service)' },
  { value: 'manufacturing', label: 'ผลิต (Manufacturing)' },
  { value: 'restaurant', label: 'ร้านอาหาร (Restaurant)' },
  { value: 'construction', label: 'รับเหมาก่อสร้าง (Construction)' },
  { value: 'other', label: 'อื่นๆ (Other)' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [orgName, setOrgName] = useState('');
  const [businessType, setBusinessType] = useState('');

  // Step 3 state
  const [invites, setInvites] = useState<InviteMember[]>([
    { email: '', role: 'accountant' },
  ]);

  // Mutations
  const orgMutation = useMutation({
    mutationFn: (data: OrgSetupPayload) =>
      api.post('/organizations/setup', data),
    onError: (err: Error) => {
      setError(err instanceof AppError ? err.message : 'Failed to set up organization');
    },
  });

  const coaMutation = useMutation({
    mutationFn: () => api.post('/accounts/seed-tfac'),
    onError: (err: Error) => {
      setError(err instanceof AppError ? err.message : 'Failed to seed chart of accounts');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (members: InviteMember[]) =>
      api.post('/organizations/invite', { members }),
  });

  const handleNext = useCallback(async () => {
    setError(null);

    if (step === 1) {
      if (!orgName.trim() || !businessType) {
        setError('Please fill in all required fields.');
        return;
      }
      await orgMutation.mutateAsync({ name: orgName.trim(), businessType });
      setStep(2);
    } else if (step === 2) {
      await coaMutation.mutateAsync();
      setStep(3);
    } else if (step === 3) {
      const validInvites = invites.filter((inv) => inv.email.trim());
      if (validInvites.length > 0) {
        try {
          await inviteMutation.mutateAsync(validInvites);
          showToast.success('Invitations sent!');
        } catch {
          // Non-blocking — continue even if invites fail
          showToast.warning('Some invitations could not be sent.');
        }
      }
      setOnboardingComplete();
      router.push('/dashboard');
    }
  }, [step, orgName, businessType, invites, orgMutation, coaMutation, inviteMutation, setOnboardingComplete, router]);

  const handleSkip = useCallback(() => {
    if (step === 3) {
      setOnboardingComplete();
      router.push('/dashboard');
    } else {
      setStep((prev) => prev + 1);
    }
  }, [step, setOnboardingComplete, router]);

  const addInviteRow = useCallback(() => {
    setInvites((prev) => [...prev, { email: '', role: 'accountant' }]);
  }, []);

  const updateInvite = useCallback(
    (index: number, field: keyof InviteMember, value: string) => {
      setInvites((prev) =>
        prev.map((inv, i) => (i === index ? { ...inv, [field]: value } : inv)),
      );
    },
    [],
  );

  const removeInvite = useCallback((index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const progressPercent = Math.round((step / 3) * 100);
  const isLoading = orgMutation.isPending || coaMutation.isPending || inviteMutation.isPending;

  const inputClasses =
    'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-foreground">
        {'สวัสดีคุณ'}
        {user?.name ?? ''} 👋
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Let&apos;s set up your organization in a few quick steps.
      </p>

      {/* Progress */}
      <div className="mt-6">
        <ProgressBar value={progressPercent} />
        <p className="mt-2 text-xs text-muted-foreground">
          Step {step} of 3
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4">
          <InlineAlert variant="error" message={error} />
        </div>
      )}

      {/* Step content */}
      <div className="mt-6 space-y-4">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Organization Details
            </h2>
            <div>
              <label
                htmlFor="org-name"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Organization Name *
              </label>
              <input
                id="org-name"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className={inputClasses}
              />
            </div>
            <div>
              <label
                htmlFor="business-type"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Business Type *
              </label>
              <select
                id="business-type"
                required
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className={inputClasses}
              >
                <option value="">Select business type</option>
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>
                    {bt.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Chart of Accounts
            </h2>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-foreground">
                We will automatically seed your Chart of Accounts using the
                <strong> Thai Federation of Accounting Professions (TFAC)</strong> standard template.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This includes standard account codes for assets, liabilities, equity, revenue,
                and expenses. You can customize them later.
              </p>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Invite Team Members
            </h2>
            <p className="text-sm text-muted-foreground">
              Add team members to your organization. You can skip this and do it later.
            </p>
            <div className="space-y-3">
              {invites.map((invite, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={invite.email}
                    onChange={(e) => updateInvite(idx, 'email', e.target.value)}
                    placeholder="email@company.com"
                    className={`${inputClasses} flex-1`}
                  />
                  <select
                    value={invite.role}
                    onChange={(e) => updateInvite(idx, 'role', e.target.value)}
                    className="h-10 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {invites.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInvite(idx)}
                      aria-label="Remove invite"
                    >
                      &times;
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addInviteRow}>
              + Add another
            </Button>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-between">
        {step === 3 ? (
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
        ) : (
          <div />
        )}
        <Button
          variant="primary"
          onClick={handleNext}
          loading={isLoading}
        >
          {step === 3 ? 'Finish' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
