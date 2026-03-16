/**
 * neip users — User Management commands.
 *
 * Commands:
 *   neip users invite <email> --role <role>   — POST /api/v1/users/invite
 */

import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for an invitation. */
interface UserInvitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

/** Options accepted by `users invite`. */
interface InviteOptions {
  role: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function usersInvite(email: string, options: InviteOptions): Promise<void> {
  if (email.trim() === '') {
    printError('Email address is required.');
    process.exit(1);
  }
  if (options.role.trim() === '') {
    printError('--role is required.');
    process.exit(1);
  }

  const body: Record<string, string> = {
    email: email.trim(),
    role: options.role.trim(),
  };

  if (options.message !== undefined && options.message.trim() !== '') {
    body['message'] = options.message.trim();
  }

  const result = await api.post<{ data: UserInvitation }>('/api/v1/users/invite', body);

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  const invitation = result.data.data;
  printSuccess(
    invitation,
    `Invitation sent to ${invitation.email} with role "${invitation.role}". Expires at ${invitation.expiresAt}.`,
  );
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `users` command group.
 */
export function buildUsersCommand(): Command {
  const users = new Command('users')
    .description('จัดการผู้ใช้และคำเชิญ — User management and invitations')
    .addHelpText('after', `
Examples:
  $ neip users invite user@example.com --role accountant
  $ neip users invite user@example.com --role admin --message "ยินดีต้อนรับ"
  `);

  users
    .command('invite <email>')
    .description('เชิญผู้ใช้เข้าองค์กรด้วยอีเมล — Invite a user to the organisation by email')
    .requiredOption('--role <role>', 'บทบาทที่กำหนดให้ผู้ถูกเชิญ — Role to assign to the invited user')
    .option('--message <message>', 'ข้อความส่วนตัวในคำเชิญ (optional) — Personalised invitation message')
    .action(async (email: string, options: InviteOptions) => {
      await usersInvite(email, options);
    });

  return users;
}
