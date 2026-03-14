'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

interface TranslationMap {
  [key: string]: string;
}

/**
 * i18n hook that fetches translations from system_translations via TanStack Query.
 * Uses staleTime: Infinity since translations rarely change at runtime.
 */
export function useTranslation() {
  const tenantId = useAuthStore((s) => s.tenantId) ?? 'default';

  const { data: translations } = useQuery<TranslationMap>({
    queryKey: queryKeys.translations(tenantId),
    queryFn: () => api.get<TranslationMap>('/translations'),
    staleTime: Infinity,
    retry: 1,
  });

  function t(key: string, fallback?: string): string {
    const val = translations?.[key];
    return val ?? fallback ?? key;
  }

  return { t, translations };
}
