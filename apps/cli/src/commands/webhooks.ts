/**
 * neip webhooks — Webhook Management commands.
 *
 * Commands:
 *   neip webhooks list          — GET    /api/v1/webhooks
 *   neip webhooks create        — POST   /api/v1/webhooks
 *   neip webhooks delete <id>   — DELETE /api/v1/webhooks/:id
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a webhook resource. */
interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `webhooks list`. */
interface WebhooksListOptions {
  page: string;
  pageSize: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a single line from stdin with a prompt. */
function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function webhooksList(options: WebhooksListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  const result = await api.get<PaginatedResponse<Webhook>>('/api/v1/webhooks', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} webhooks (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function webhooksCreate(): Promise<void> {
  process.stdout.write('Creating a new webhook. Enter details below.\n');

  const url = await promptLine('Target URL (e.g. https://example.com/hook): ');
  const eventsInput = await promptLine('Events to subscribe to (comma-separated, e.g. invoice.created,payment.received): ');

  if (url === '') {
    printError('Target URL is required.');
    process.exit(1);
  }

  if (eventsInput === '') {
    printError('At least one event is required.');
    process.exit(1);
  }

  const events = eventsInput
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e !== '');

  if (events.length === 0) {
    printError('At least one valid event is required.');
    process.exit(1);
  }

  const result = await api.post<{ data: Webhook }>('/api/v1/webhooks', { url, events });

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const webhook = result.data.data;
  printSuccess(webhook, `Webhook ${webhook.id} created. Store the secret safely — it will not be shown again.`);
}

async function webhooksDelete(id: string): Promise<void> {
  if (id === '') {
    printError('Webhook ID is required.');
    process.exit(1);
  }

  const result = await api.delete<void>(`/api/v1/webhooks/${id}`);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess({ id }, `Webhook ${id} deleted.`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `webhooks` command group.
 */
export function buildWebhooksCommand(): Command {
  const webhooks = new Command('webhooks')
    .description('จัดการ webhook endpoints — Webhook endpoint management')
    .addHelpText('after', `
Examples:
  $ neip webhooks list                      # แสดง webhooks ทั้งหมด
  $ neip webhooks create                    # สร้าง webhook ใหม่ (interactive)
  $ neip webhooks delete <id>              # ลบ webhook

Available events: invoice.created, invoice.paid, payment.received,
  bill.created, bill.paid, journal.posted, contact.created
  `);

  webhooks
    .command('list')
    .description('แสดงรายการ webhook endpoints ทั้งหมด — List all registered webhook endpoints')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of webhooks per page', '20')
    .action(async (options: WebhooksListOptions) => {
      await webhooksList(options);
    });

  webhooks
    .command('create')
    .description('สร้าง webhook subscription ใหม่ (interactive) — Create a new webhook subscription interactively')
    .action(async () => {
      await webhooksCreate();
    });

  webhooks
    .command('delete <id>')
    .description('ลบ webhook ด้วย ID — Delete a webhook by ID')
    .action(async (id: string) => {
      await webhooksDelete(id);
    });

  return webhooks;
}
