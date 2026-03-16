/**
 * neip ar — Accounts Receivable command group.
 *
 * Registers all AR sub-commands under the `ar` namespace:
 *   neip ar invoice ...
 *   neip ar payment ...
 *   neip ar so ...        — Sales Orders (ใบสั่งขาย)
 *   neip ar do ...        — Delivery Notes (ใบส่งของ)
 *   neip ar receipts ...  — Receipts (ใบเสร็จรับเงิน)
 *   neip ar cn ...        — Credit Notes (ใบลดหนี้)
 */

import { Command } from 'commander';
import { buildInvoiceCommand } from './invoice.js';
import { buildPaymentCommand } from './payment.js';
import { buildArSoCommand } from './sales-orders.js';
import { buildArDoCommand } from './delivery-notes.js';
import { buildArReceiptsCommand } from './receipts.js';
import { buildArCnCommand } from './credit-notes.js';

/**
 * Build the `ar` command group and attach all sub-commands.
 */
export function buildArCommand(): Command {
  const ar = new Command('ar')
    .description('ลูกหนี้การค้า (Accounts Receivable) — Accounts Receivable operations')
    .addHelpText('after', `
Examples:
  $ neip ar invoice create                       # สร้างใบแจ้งหนี้
  $ neip ar invoice list --status overdue        # ดูใบแจ้งหนี้เกินกำหนด
  $ neip ar payment create                       # บันทึกการรับชำระ
  $ neip ar so list                              # ดูใบสั่งขาย
  $ neip ar do list                              # ดูใบส่งของ
  $ neip ar receipts list                        # ดูใบเสร็จรับเงิน
  $ neip ar cn list                              # ดูใบลดหนี้
  `);

  ar.addCommand(buildInvoiceCommand());
  ar.addCommand(buildPaymentCommand());
  ar.addCommand(buildArSoCommand());
  ar.addCommand(buildArDoCommand());
  ar.addCommand(buildArReceiptsCommand());
  ar.addCommand(buildArCnCommand());

  return ar;
}
