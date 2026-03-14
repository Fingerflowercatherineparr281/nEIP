'use client';

/**
 * Firm Admin Dashboard — shows all client organizations managed by the firm.
 *
 * Features:
 *   1. Lists all client orgs with name, status, and key metrics
 *   2. Click into client org to switch tenant context
 *   3. Add/remove client assignments
 *
 * Story: 12.2
 */

import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Trash2, ArrowRight, Users } from 'lucide-react';

import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOrg {
  id: string;
  clientTenantId: string;
  clientName: string;
  label: string | null;
  status: string;
  createdAt: string;
}

interface ClientListResponse {
  clients: ClientOrg[];
  total: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FirmDashboardPage(): React.JSX.Element {
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newClientTenantId, setNewClientTenantId] = useState('');
  const [newClientLabel, setNewClientLabel] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const setTenantId = useAuthStore((s) => s.setTenantId);

  // Fetch client list
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<ClientListResponse>('/firm/clients');
      setClients(data.clients);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  // Add client
  async function handleAddClient(): Promise<void> {
    if (!newClientTenantId.trim()) return;

    try {
      setAddLoading(true);
      await api.post('/firm/clients', {
        clientTenantId: newClientTenantId.trim(),
        label: newClientLabel.trim() || undefined,
      });
      setShowAddDialog(false);
      setNewClientTenantId('');
      setNewClientLabel('');
      await fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add client');
    } finally {
      setAddLoading(false);
    }
  }

  // Remove client
  async function handleRemoveClient(assignmentId: string): Promise<void> {
    if (!window.confirm('Are you sure you want to unassign this client?')) return;

    try {
      await api.delete(`/firm/clients/${assignmentId}`);
      await fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove client');
    }
  }

  // Switch to client org
  function handleSwitchToClient(clientTenantId: string): void {
    setTenantId(clientTenantId);
    window.location.href = '/';
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Firm Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your client organizations ({total} client{total !== 1 ? 's' : ''})
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Client
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add client dialog */}
      {showAddDialog && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Add Client Organization
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label
                htmlFor="clientTenantId"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Client Organization ID
              </label>
              <input
                id="clientTenantId"
                type="text"
                value={newClientTenantId}
                onChange={(e) => setNewClientTenantId(e.target.value)}
                placeholder="Enter organization ID..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex-1">
              <label
                htmlFor="clientLabel"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Label (optional)
              </label>
              <input
                id="clientLabel"
                type="text"
                value={newClientLabel}
                onChange={(e) => setNewClientLabel(e.target.value)}
                placeholder="Display label..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddClient()}
              disabled={addLoading || !newClientTenantId.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {addLoading ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && clients.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            No clients yet
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Add your first client organization to get started.
          </p>
        </div>
      )}

      {/* Client list */}
      {!loading && clients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <Building2
                      className="h-5 w-5 text-slate-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {client.clientName}
                    </h3>
                    {client.label && (
                      <p className="text-xs text-slate-500">{client.label}</p>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    client.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {client.status}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Added {new Date(client.createdAt).toLocaleDateString()}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => void handleRemoveClient(client.id)}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-red-600"
                  aria-label={`Remove ${client.clientName}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchToClient(client.clientTenantId)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  aria-label={`Switch to ${client.clientName}`}
                >
                  Switch to
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
