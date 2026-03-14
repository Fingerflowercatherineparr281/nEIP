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
