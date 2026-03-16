'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new client if we don't already have one
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// ---------------------------------------------------------------------------
// Query key factory — all keys include tenantId for cache isolation
// ---------------------------------------------------------------------------

export const queryKeys = {
  all: (tenantId: string) => [tenantId] as const,

  // Auth
  translations: (tenantId: string) => [tenantId, 'translations'] as const,

  // Accounts
  accounts: (tenantId: string) => [tenantId, 'accounts'] as const,
  accountList: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'accounts', 'list', filters] as const,
  account: (tenantId: string, id: string) =>
    [tenantId, 'accounts', id] as const,

  // Journal entries
  journalEntries: (tenantId: string) => [tenantId, 'journal-entries'] as const,
  journalEntryList: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'journal-entries', 'list', filters] as const,
  journalEntry: (tenantId: string, id: string) =>
    [tenantId, 'journal-entries', id] as const,

  // Dashboard
  dashboardMetrics: (tenantId: string) =>
    [tenantId, 'dashboard', 'metrics'] as const,
  executiveDashboard: (tenantId: string, period: string) =>
    [tenantId, 'dashboard', 'executive', period] as const,
  consolidatedDashboard: (tenantId: string) =>
    [tenantId, 'dashboard', 'consolidated'] as const,

  // Notifications
  notificationSettings: (tenantId: string) =>
    [tenantId, 'notifications', 'settings'] as const,
  notificationHistory: (tenantId: string) =>
    [tenantId, 'notifications', 'history'] as const,

  // Reports
  reports: (tenantId: string, type: string) =>
    [tenantId, 'reports', type] as const,
  pnlComparison: (
    tenantId: string,
    mode: string,
    fiscalYear: number,
    fiscalPeriod?: number,
    compareYear?: number,
  ) =>
    [tenantId, 'reports', 'pnl-comparison', mode, fiscalYear, fiscalPeriod, compareYear] as const,

  // Budgets
  budgets: (tenantId: string, fiscalYear?: number) =>
    fiscalYear !== undefined
      ? [tenantId, 'budgets', fiscalYear] as const
      : [tenantId, 'budgets'] as const,

  // Quotations (ใบเสนอราคา)
  quotations: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'quotations', filters] as const,
  quotation: (tenantId: string, id: string) =>
    [tenantId, 'quotations', id] as const,

  // Bills (detail + payments)
  bill: (tenantId: string, id: string) =>
    [tenantId, 'bills', id] as const,
  billPayments: (tenantId: string, billId: string) =>
    [tenantId, 'bill-payments', billId] as const,

  // Vendors
  vendors: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'vendors', filters] as const,
  vendor: (tenantId: string, id: string) =>
    [tenantId, 'vendors', id] as const,

  // Tax rates
  taxRates: (tenantId: string) =>
    [tenantId, 'tax-rates'] as const,

  // Fiscal years + month-end
  fiscalYears: (tenantId: string) =>
    [tenantId, 'fiscal-years'] as const,
  monthEndJob: (tenantId: string, jobId: string) =>
    [tenantId, 'month-end', jobId] as const,

  // Audit logs
  auditLogs: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'audit-logs', filters] as const,

  // Fixed Assets (FI-AA)
  fixedAssets: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'fixed-assets', filters] as const,
  fixedAsset: (tenantId: string, id: string) =>
    [tenantId, 'fixed-assets', id] as const,
  fixedAssetReport: (tenantId: string) =>
    [tenantId, 'fixed-assets', 'report'] as const,

  // Bank Reconciliation (FI-BL)
  bankAccounts: (tenantId: string) =>
    [tenantId, 'bank-accounts'] as const,
  bankAccount: (tenantId: string, id: string) =>
    [tenantId, 'bank-accounts', id] as const,
  bankReconciliation: (tenantId: string, accountId: string) =>
    [tenantId, 'bank-accounts', accountId, 'reconciliation'] as const,

  // WHT Certificates
  whtCertificates: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'wht-certificates', filters] as const,
  whtCertificate: (tenantId: string, id: string) =>
    [tenantId, 'wht-certificates', id] as const,
  whtSummary: (tenantId: string, taxYear?: number, taxMonth?: number) =>
    [tenantId, 'wht-certificates', 'summary', taxYear, taxMonth] as const,

  // Cost Centers (CO)
  costCenters: (tenantId: string) =>
    [tenantId, 'cost-centers'] as const,
  costCenter: (tenantId: string, id: string) =>
    [tenantId, 'cost-centers', id] as const,
  costCenterReport: (tenantId: string, id: string) =>
    [tenantId, 'cost-centers', id, 'report'] as const,

  // Profit Centers (CO)
  profitCenters: (tenantId: string) =>
    [tenantId, 'profit-centers'] as const,
  profitCenter: (tenantId: string, id: string) =>
    [tenantId, 'profit-centers', id] as const,
  profitCenterReport: (tenantId: string, id: string) =>
    [tenantId, 'profit-centers', id, 'report'] as const,

  // Inventory
  products: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'products', filters] as const,
  product: (tenantId: string, id: string) =>
    [tenantId, 'products', id] as const,
  warehouses: (tenantId: string) =>
    [tenantId, 'warehouses'] as const,
  stockLevels: (tenantId: string) =>
    [tenantId, 'stock-levels'] as const,
  stockMovements: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'stock-movements', filters] as const,

  // CRM — Contacts
  contacts: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'contacts', filters] as const,
  contact: (tenantId: string, id: string) =>
    [tenantId, 'contacts', id] as const,

  // HR
  departments: (tenantId: string) =>
    [tenantId, 'departments'] as const,
  employees: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'employees', filters] as const,
  employee: (tenantId: string, id: string) =>
    [tenantId, 'employees', id] as const,
  payrollRuns: (tenantId: string) =>
    [tenantId, 'payroll'] as const,
  payrollRun: (tenantId: string, id: string) =>
    [tenantId, 'payroll', id] as const,
  leaveTypes: (tenantId: string) =>
    [tenantId, 'leave-types'] as const,
  leaveRequests: (tenantId: string, filters?: Record<string, string>) =>
    [tenantId, 'leave-requests', filters] as const,
} as const;

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps): React.JSX.Element {
  const [client] = useState(getQueryClient);

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
