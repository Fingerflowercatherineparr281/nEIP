'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface ContactDetail {
  id: string; contactType: string; code: string | null;
  companyName: string; contactPerson: string | null;
  email: string | null; phone: string | null; taxId: string | null;
  branchNumber: string | null;
  addressLine1: string | null; addressLine2: string | null;
  city: string | null; province: string | null; postalCode: string | null;
  country: string; paymentTermsDays: number; notes: string | null;
  isActive: boolean;
  summary: {
    totalInvoices: number; totalInvoicesSatang: string;
    totalBills: number; totalBillsSatang: string;
  };
}

interface Transaction {
  type: string; id: string; documentNumber: string;
  status: string; totalSatang: string; date: string;
}

interface TransactionsResponse { invoices: Transaction[]; bills: Transaction[]; }

function formatBaht(satang: string): string {
  return (parseInt(satang, 10) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

export default function ContactDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';

  const { data: contact, isLoading } = useQuery<ContactDetail>({
    queryKey: [tenantId, 'contacts', id],
    queryFn: () => api.get<ContactDetail>(`/contacts/${id}`),
  });

  const { data: txData } = useQuery<TransactionsResponse>({
    queryKey: [tenantId, 'contacts', id, 'transactions'],
    queryFn: () => api.get<TransactionsResponse>(`/contacts/${id}/transactions`),
    enabled: !!contact,
  });

  if (isLoading) return <div className="p-6"><SkeletonRow count={6} /></div>;
  if (!contact) return <div className="p-6 text-[var(--color-muted-foreground)]">Contact not found.</div>;

  const transactions = [...(txData?.invoices ?? []), ...(txData?.bills ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Link href="/contacts">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{contact.companyName}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] capitalize">{contact.contactType}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Contact info */}
        <div className="rounded-lg border border-[var(--color-border)] p-5 space-y-3">
          <h2 className="font-semibold">Contact Information</h2>
          {contact.taxId && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span className="font-mono">{contact.taxId}</span>
              {contact.branchNumber && <span className="text-[var(--color-muted-foreground)]">Branch: {contact.branchNumber}</span>}
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <span>{contact.phone}</span>
            </div>
          )}
          {(contact.addressLine1 ?? contact.city) && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-[var(--color-muted-foreground)]" />
              <div>
                {contact.addressLine1 && <div>{contact.addressLine1}</div>}
                {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                <div>{[contact.city, contact.province, contact.postalCode].filter(Boolean).join(', ')}</div>
              </div>
            </div>
          )}
          <div className="text-sm text-[var(--color-muted-foreground)]">
            Payment terms: {contact.paymentTermsDays} days
          </div>
        </div>

        {/* Transaction summary */}
        <div className="rounded-lg border border-[var(--color-border)] p-5 space-y-3">
          <h2 className="font-semibold">Transaction Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/30">
              <p className="text-xs text-[var(--color-muted-foreground)]">Total Invoices</p>
              <p className="text-lg font-semibold">{contact.summary.totalInvoices}</p>
              <p className="text-sm font-mono">฿{formatBaht(contact.summary.totalInvoicesSatang)}</p>
            </div>
            <div className="rounded-md bg-purple-50 p-3 dark:bg-purple-950/30">
              <p className="text-xs text-[var(--color-muted-foreground)]">Total Bills</p>
              <p className="text-lg font-semibold">{contact.summary.totalBills}</p>
              <p className="text-sm font-mono">฿{formatBaht(contact.summary.totalBillsSatang)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)]">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="font-semibold">Transaction History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Document</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted-foreground)]">Amount (฿)</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={`${tx.type}-${tx.id}`} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs">{tx.documentNumber}</td>
                  <td className="px-4 py-3 capitalize">{tx.type}</td>
                  <td className="px-4 py-3 capitalize">{tx.status}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBaht(tx.totalSatang)}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {new Date(tx.date).toLocaleDateString('th-TH')}
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
