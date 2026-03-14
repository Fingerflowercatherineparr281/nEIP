/**
 * neip ar — Accounts Receivable command group.
 *
 * Registers all AR sub-commands under the `ar` namespace:
 *   neip ar invoice ...
 *   neip ar payment ...
 */

import { Command } from 'commander';
import { buildInvoiceCommand } from './invoice.js';
import { buildPaymentCommand } from './payment.js';

/**
 * Build the `ar` command group and attach all sub-commands.
 */
export function buildArCommand(): Command {
  const ar = new Command('ar').description('Accounts Receivable operations');

  ar.addCommand(buildInvoiceCommand());
  ar.addCommand(buildPaymentCommand());

  return ar;
}
