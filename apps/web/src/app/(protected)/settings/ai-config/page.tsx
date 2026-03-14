'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { ProgressBar } from '@/components/ui/progress-bar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIConfig {
  llmApiKey: string;
  llmProvider: string;
  confidenceThreshold: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AIConfigPage(): React.JSX.Element {
  const router = useRouter();
  const { data, loading: fetching } = useApi<AIConfig>('/settings/ai-config');

  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openai');
  const [threshold, setThreshold] = useState(75);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setApiKey(data.llmApiKey);
      setProvider(data.llmProvider);
      setThreshold(data.confidenceThreshold);
    }
  }, [data]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.put('/settings/ai-config', {
        llmApiKey: apiKey,
        llmProvider: provider,
        confidenceThreshold: threshold,
      });
      showToast.success('AI configuration saved');
    } catch {
      showToast.error('Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  }, [apiKey, provider, threshold]);

  const maskedKey = apiKey
    ? apiKey.slice(0, 4) + '*'.repeat(Math.max(0, apiKey.length - 8)) + apiKey.slice(-4)
    : '';

  const inputClasses = cn(
    'h-10 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 text-sm',
    'text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]',
    'focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]',
  );

  // Threshold zone label
  const zoneLabel =
    threshold >= 90 ? 'Auto' :
    threshold >= 75 ? 'Suggest' :
    threshold >= 50 ? 'Review' :
    threshold >= 25 ? 'Manual' :
    'Blocked';

  if (fetching) {
    return (
      <div className="mx-auto max-w-2xl p-4 lg:p-6">
        <SkeletonCard count={1} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} aria-label="Back to settings">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">AI Configuration</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Manage LLM API key and HITL confidence threshold
          </p>
        </div>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* LLM Provider */}
        <div className="space-y-1.5">
          <label htmlFor="provider" className="text-sm font-medium text-[var(--color-foreground)]">
            LLM Provider
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={inputClasses}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google AI</option>
            <option value="azure">Azure OpenAI</option>
          </select>
        </div>

        {/* API Key (BYOK) */}
        <div className="space-y-1.5">
          <label htmlFor="apiKey" className="text-sm font-medium text-[var(--color-foreground)]">
            API Key (BYOK)
          </label>
          <div className="relative">
            <input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              value={showKey ? apiKey : maskedKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className={cn(inputClasses, 'pr-10 font-mono-figures')}
              onFocus={() => setShowKey(true)}
            />
            <button
              type="button"
              onClick={() => setShowKey((p) => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Your API key is stored encrypted and never sent to our servers.
          </p>
        </div>

        {/* Confidence Threshold */}
        <div className="space-y-3">
          <label htmlFor="threshold" className="text-sm font-medium text-[var(--color-foreground)]">
            HITL Confidence Threshold
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-muted-foreground)]">
                Documents with confidence above this threshold will be auto-approved
              </span>
              <span className="min-w-[4rem] text-right font-mono-figures text-sm font-semibold">
                {threshold}% ({zoneLabel})
              </span>
            </div>
            <input
              id="threshold"
              type="range"
              min={0}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              className="w-full accent-[var(--color-primary)]"
              aria-label={`Confidence threshold: ${threshold}%`}
            />
            <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
              <span>0% (All manual)</span>
              <span>100% (All auto)</span>
            </div>
            <ProgressBar value={threshold} max={100} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
