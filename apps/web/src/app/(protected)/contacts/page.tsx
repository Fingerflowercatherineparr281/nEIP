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

interface Contact {
  id: string; contactType: string; code: string | null;
  companyName: string; contactPerson: string | null;
  email: string | null; phone: string | null; taxId: string | null;
  city: string | null; province: string | null; isActive: boolean;
}

interface ContactListResponse { items: Contact[]; total: number; }

const TYPE_TAB_OPTIONS = ['all', 'customer', 'vendor', 'both'] as const;
type TypeTab = typeof TYPE_TAB_OPTIONS[number];

const TYPE_BADGE: Record<string, string> = {
  customer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  vendor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  both: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export default function ContactsPage(): React.JSX.Element {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';
  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState<TypeTab>('all');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p['search'] = search;
    if (typeTab !== 'all') p['type'] = typeTab;
    return p;
  }, [search, typeTab]);

  const { data, isLoading } = useQuery<ContactListResponse>({
    queryKey: [tenantId, 'contacts', params],
    queryFn: () => api.get<ContactListResponse>('/contacts', params),
  });

  const contacts = data?.items ?? [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Contacts</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">Customers, vendors, and business partners</p>
        </div>
        <Link href="/contacts/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-1 w-fit">
        {TYPE_TAB_OPTIONS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTypeTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
              typeTab === tab
                ? 'bg-white text-foreground shadow-sm dark:bg-slate-800'
                : 'text-[var(--color-muted-foreground)] hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1) + 's'}
          </button>
        ))}
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, tax ID, email..."
        resultCount={data?.total}
      />

      {isLoading ? (
        <SkeletonRow count={5} />
      ) : contacts.length === 0 ? (
        <EmptyState
          context="search-results"
          message="No contacts found"
          description={search ? 'Try adjusting your search.' : 'Add your first contact.'}
          {...(!search ? { ctaLabel: 'Add Contact', onCtaClick: () => { window.location.href = '/contacts/new'; } } : {})}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Company</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Tax ID</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Location</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{contact.companyName}</div>
                    {contact.contactPerson && (
                      <div className="text-xs text-[var(--color-muted-foreground)]">{contact.contactPerson}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[contact.contactType] ?? ''}`}>
                      {contact.contactType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{contact.taxId ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    <div>{contact.email ?? '—'}</div>
                    <div className="text-xs">{contact.phone ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {[contact.city, contact.province].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/contacts/${contact.id}`}>
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
