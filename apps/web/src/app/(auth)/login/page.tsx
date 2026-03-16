'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/toast';
import { api, AppError } from '@/lib/api-client';
import { useAuthStore, type AuthUser } from '@/stores/auth-store';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export default function LoginPage(): React.JSX.Element {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const data = await api.post<LoginResponse>('/auth/login', {
          email,
          password,
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('neip-auth-token', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('neip-refresh-token', data.refreshToken);
          }
        }

        // Decode JWT payload to extract user info
        const payload = JSON.parse(atob(data.accessToken.split('.')[1] ?? '')) as {
          sub: string;
          email: string;
          tenantId: string;
        };
        const user: AuthUser = {
          id: payload.sub,
          email: payload.email,
          name: email.split('@')[0] ?? '',
          role: 'owner',
          orgId: payload.tenantId,
          orgName: '',
        };
        setAuth(user, data.accessToken);
        // Small delay to let zustand persist sync to localStorage
        await new Promise((r) => setTimeout(r, 100));
        // If user already has an org (not 'default'), go to dashboard
        // Otherwise go to onboarding
        if (payload.tenantId && payload.tenantId !== 'default') {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/onboarding';
        }
      } catch (err) {
        if (err instanceof AppError) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, setAuth],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            nE
          </span>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Welcome to nEIP
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <InlineAlert variant="error" message={error} />
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
