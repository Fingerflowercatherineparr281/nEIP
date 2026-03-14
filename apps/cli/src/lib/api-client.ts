/**
 * HTTP client for nEIP API calls.
 *
 * Wraps the native `fetch` API with:
 *   - Base URL resolution from the config store
 *   - Automatic Bearer token attachment
 *   - Transparent access-token refresh when a 401 is received
 *   - Typed response parsing that surfaces RFC 7807 errors as ApiError
 */

import { getConfigValue, patchConfig } from './config-store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Discriminated union for API responses from the client. */
export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError; status: number };

/** Runtime error produced by non-2xx API responses. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly type: string;

  constructor(params: { status: number; title: string; detail: string; type: string }) {
    super(params.detail);
    this.name = 'ApiError';
    this.status = params.status;
    this.title = params.title;
    this.detail = params.detail;
    this.type = params.type;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Minimal shape of a login response from the API. */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/** Minimal shape of a refresh response from the API. */
interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveBaseUrl(): string {
  return getConfigValue('apiUrl') ?? DEFAULT_BASE_URL;
}

function buildAuthHeaders(): Record<string, string> {
  const token = getConfigValue('accessToken');
  if (token !== undefined && token !== '') {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

function isTokenExpired(): boolean {
  const expiresAt = getConfigValue('tokenExpiresAt');
  if (expiresAt === undefined) return false;
  // Add 30-second buffer so we refresh slightly before actual expiry
  return new Date(expiresAt).getTime() < Date.now() + 30_000;
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getConfigValue('refreshToken');
  if (refreshToken === undefined || refreshToken === '') return false;

  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as RefreshResponse;
    const expiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
    patchConfig({ accessToken: data.accessToken, tokenExpiresAt: expiresAt });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

/**
 * Perform an authenticated HTTP request against the configured API server.
 *
 * Handles:
 *   - Base URL resolution
 *   - Bearer token attachment
 *   - Proactive token refresh before expiry
 *   - Re-try once after a 401 with a refreshed token
 *   - RFC 7807 error body parsing
 */
export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  pathname: string,
  options: {
    body?: unknown;
    params?: Record<string, string>;
    skipAuth?: boolean;
  } = {},
): Promise<ApiResult<T>> {
  // Proactively refresh if the token is about to expire
  if (!options.skipAuth && isTokenExpired()) {
    await attemptRefresh();
  }

  const baseUrl = resolveBaseUrl();
  const url = new URL(pathname, baseUrl);

  if (options.params !== undefined) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.skipAuth ? {} : buildAuthHeaders()),
  };

  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const baseInit: RequestInit = bodyStr !== undefined
    ? { method, headers, body: bodyStr }
    : { method, headers };

  let response = await fetch(url.toString(), baseInit);

  // Retry once after refreshing on 401
  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const retryHeaders = { ...headers, ...buildAuthHeaders() };
      const retryInit: RequestInit = bodyStr !== undefined
        ? { method, headers: retryHeaders, body: bodyStr }
        : { method, headers: retryHeaders };
      response = await fetch(url.toString(), retryInit);
    }
  }

  if (response.ok) {
    const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
    return { ok: true, data, status: response.status };
  }

  // Attempt to parse RFC 7807 problem detail
  let errorBody: { type?: string; title?: string; detail?: string; status?: number } = {};
  try {
    errorBody = (await response.json()) as typeof errorBody;
  } catch {
    // Ignore parse failures — use defaults below
  }

  return {
    ok: false,
    status: response.status,
    error: new ApiError({
      status: response.status,
      type: errorBody.type ?? 'about:blank',
      title: errorBody.title ?? response.statusText,
      detail: errorBody.detail ?? `Request failed with status ${response.status}`,
    }),
  };
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    params !== undefined
      ? request<T>('GET', path, { params })
      : request<T>('GET', path),

  post: <T>(path: string, body?: unknown, skipAuth = false) =>
    request<T>('POST', path, { body, skipAuth }),

  put: <T>(path: string, body?: unknown) =>
    request<T>('PUT', path, { body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>('PATCH', path, { body }),

  delete: <T>(path: string) =>
    request<T>('DELETE', path),
} as const;
