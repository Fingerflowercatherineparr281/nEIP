'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api-client';

// ---------------------------------------------------------------------------
// Generic fetch hook (no TanStack Query dependency)
// ---------------------------------------------------------------------------

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(path: string, params?: Record<string, string>): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = params ? JSON.stringify(params) : '';

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<T>(path, params)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : 'Unknown error';
        setError(message);
        setLoading(false);
      });
  }, [path, paramsKey]); // params intentionally excluded — paramsKey is the serialized version

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ---------------------------------------------------------------------------
// Debounced value hook
// ---------------------------------------------------------------------------

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Keyboard shortcut hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcut(
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {},
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (options.meta && !e.metaKey) return;
      if (options.ctrl && !e.ctrlKey) return;
      if (options.shift && !e.shiftKey) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        callbackRef.current(e);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, options.meta, options.ctrl, options.shift]);
}
