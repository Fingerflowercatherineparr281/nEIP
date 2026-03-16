/**
 * neip notifications — Notification commands.
 *
 * Commands:
 *   neip notifications list              — GET /api/v1/notifications
 *   neip notifications settings          — GET /api/v1/notifications/settings
 *   neip notifications settings update   — PUT /api/v1/notifications/settings
 */

import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for a single notification. */
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/** Response shape for notification settings. */
interface NotificationSettings {
  emailEnabled: boolean;
  emailFrequency: 'instant' | 'daily' | 'weekly';
  inAppEnabled: boolean;
  events: Record<string, boolean>;
}

/** Paginated list response wrapper. */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Options accepted by `notifications list`. */
interface NotificationsListOptions {
  page: string;
  pageSize: string;
  unread?: boolean;
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

async function notificationsList(options: NotificationsListOptions): Promise<void> {
  const params: Record<string, string> = {
    page: options.page,
    pageSize: options.pageSize,
  };

  if (options.unread === true) {
    params['unread'] = 'true';
  }

  const result = await api.get<PaginatedResponse<Notification>>('/api/v1/notifications', params);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const { data, total, page, pageSize } = result.data;

  printSuccess(
    data,
    `Showing ${String(data.length)} of ${String(total)} notifications (page ${String(page)}/${String(Math.ceil(total / pageSize))})`,
  );
}

async function notificationsSettings(): Promise<void> {
  const result = await api.get<{ data: NotificationSettings }>('/api/v1/notifications/settings');

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, 'Notification settings:');
}

async function notificationsSettingsUpdate(): Promise<void> {
  process.stdout.write('Updating notification settings. Leave fields blank to keep existing values.\n');

  const emailEnabledInput = await promptLine('Email notifications enabled? (true/false, blank to skip): ');
  const emailFrequencyInput = await promptLine('Email frequency (instant/daily/weekly, blank to skip): ');
  const inAppEnabledInput = await promptLine('In-app notifications enabled? (true/false, blank to skip): ');

  const body: Record<string, unknown> = {};

  if (emailEnabledInput !== '') {
    if (emailEnabledInput !== 'true' && emailEnabledInput !== 'false') {
      printError('emailEnabled must be "true" or "false".');
      process.exit(1);
    }
    body['emailEnabled'] = emailEnabledInput === 'true';
  }

  if (emailFrequencyInput !== '') {
    const validFrequencies = ['instant', 'daily', 'weekly'];
    if (!validFrequencies.includes(emailFrequencyInput)) {
      printError(`emailFrequency must be one of: ${validFrequencies.join(', ')}`);
      process.exit(1);
    }
    body['emailFrequency'] = emailFrequencyInput;
  }

  if (inAppEnabledInput !== '') {
    if (inAppEnabledInput !== 'true' && inAppEnabledInput !== 'false') {
      printError('inAppEnabled must be "true" or "false".');
      process.exit(1);
    }
    body['inAppEnabled'] = inAppEnabledInput === 'true';
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update.');
    process.exit(1);
  }

  const result = await api.put<{ data: NotificationSettings }>('/api/v1/notifications/settings', body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data.data, 'Notification settings updated.');
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `notifications` command group.
 */
export function buildNotificationsCommand(): Command {
  const notifications = new Command('notifications')
    .description('จัดการการแจ้งเตือน — Notification management')
    .addHelpText('after', `
Examples:
  $ neip notifications list                  # แสดงการแจ้งเตือนทั้งหมด
  $ neip notifications list --unread         # เฉพาะที่ยังไม่ได้อ่าน
  $ neip notifications settings             # ดูการตั้งค่าการแจ้งเตือน
  $ neip notifications settings update      # แก้ไขการตั้งค่า
  `);

  notifications
    .command('list')
    .description('แสดงการแจ้งเตือนของผู้ใช้ปัจจุบัน — List notifications for the current user')
    .option('--page <number>', 'หน้าที่ — Page number', '1')
    .option('--page-size <number>', 'จำนวนต่อหน้า — Number of notifications per page', '20')
    .option('--unread', 'แสดงเฉพาะที่ยังไม่ได้อ่าน — Show only unread notifications', false)
    .action(async (options: NotificationsListOptions) => {
      await notificationsList(options);
    });

  const settingsCmd = new Command('settings').description('การตั้งค่าการแจ้งเตือน — Notification settings operations');

  settingsCmd
    .action(async () => {
      await notificationsSettings();
    });

  settingsCmd
    .command('update')
    .description('แก้ไขการตั้งค่าการแจ้งเตือน (interactive) — Update notification settings interactively')
    .action(async () => {
      await notificationsSettingsUpdate();
    });

  notifications.addCommand(settingsCmd);

  return notifications;
}
