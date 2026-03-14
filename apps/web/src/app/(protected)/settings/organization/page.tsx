'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgProfile {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrganizationSettingsPage(): React.JSX.Element {
  const router = useRouter();
  const { data, loading: fetching } = useApi<OrgProfile>('/settings/organization');

  const [form, setForm] = useState<OrgProfile>({
    name: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleChange = useCallback((field: keyof OrgProfile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put('/settings/organization', form);
      showToast.success('Organization profile saved');
    } catch {
      showToast.error('Failed to save organization profile');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  if (fetching) {
    return (
      <div className="mx-auto max-w-2xl p-4 lg:p-6">
        <SkeletonCard count={1} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} aria-label="Back to settings">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Organization</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Company profile and contact details
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="space-y-1.5">
          <label htmlFor="orgName" className="text-sm font-medium text-[var(--color-foreground)]">
            Company Name
          </label>
          <input
            id="orgName"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={inputClasses}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="taxId" className="text-sm font-medium text-[var(--color-foreground)]">
            Tax ID
          </label>
          <input
            id="taxId"
            type="text"
            value={form.taxId}
            onChange={(e) => handleChange('taxId', e.target.value)}
            placeholder="13-digit Tax ID"
            className={inputClasses}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="address" className="text-sm font-medium text-[var(--color-foreground)]">
            Address
          </label>
          <textarea
            id="address"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            rows={3}
            className={cn(inputClasses, 'h-auto py-2')}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-[var(--color-foreground)]">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="orgEmail" className="text-sm font-medium text-[var(--color-foreground)]">
              Email
            </label>
            <input
              id="orgEmail"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="website" className="text-sm font-medium text-[var(--color-foreground)]">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={form.website}
            onChange={(e) => handleChange('website', e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
