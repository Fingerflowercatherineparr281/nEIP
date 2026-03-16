/**
 * API Client — fetch wrapper with auth header injection, automatic token
 * refresh on 401, and error mapping to AppError types.
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5400';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('neip-auth-token');
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('neip-auth-token', token);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('neip-refresh-token');
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('neip-auth-token');
  localStorage.removeItem('neip-refresh-token');
}

// ---------------------------------------------------------------------------
// Token refresh (deduplicated)
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data = (await res.json()) as { accessToken: string; refreshToken?: string };
      setToken(data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('neip-refresh-token', data.refreshToken);
      }
      return data.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Response handler
// ---------------------------------------------------------------------------

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorBody: Record<string, unknown> = {};
    try {
      errorBody = (await res.json()) as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }

    const message = (errorBody['detail'] as string | undefined)
      ?? (errorBody['message'] as string | undefined)
      ?? res.statusText;
    const code = (errorBody['code'] as string | undefined)
      ?? (errorBody['type'] as string | undefined)
      ?? 'API_ERROR';

    throw new AppError(message, code, res.status, errorBody);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

// ---------------------------------------------------------------------------
// Core fetch with auto-retry on 401
// ---------------------------------------------------------------------------

async function fetchWithAuth<T>(
  url: string,
  init: RequestInit,
  skipAuth?: boolean,
): Promise<T> {
  let res = await fetch(url, init);

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers });
    } else {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new AppError('Authentication required', 'UNAUTHORIZED', 401);
    }
  }

  return handleResponse<T>(res);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const api = {
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}/api/v1${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    return fetchWithAuth<T>(url.toString(), {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetchWithAuth<T>(`${API_BASE}/api/v1${path}`, init);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetchWithAuth<T>(`${API_BASE}/api/v1${path}`, init);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetchWithAuth<T>(`${API_BASE}/api/v1${path}`, init);
  },

  async delete<T>(path: string): Promise<T> {
    return fetchWithAuth<T>(`${API_BASE}/api/v1${path}`, {
      method: 'DELETE',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
  },
} as const;
