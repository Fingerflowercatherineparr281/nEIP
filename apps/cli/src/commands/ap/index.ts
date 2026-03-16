/**
 * neip ap — Accounts Payable command group.
 *
 * Registers all AP sub-commands under the `ap` namespace:
 *   neip ap bill ...    — Bills
 *   neip ap payment ... — Bill payments
 *   neip ap po ...      — Purchase Orders (ใบสั่งซื้อ)
 */

import { Command } from 'commander';
import { buildApBillCommand } from './bill.js';
import { buildApPaymentCommand } from './payment.js';
import { buildApPoCommand } from './purchase-orders.js';

/**
 * Build the `ap` command group and attach all sub-commands.
 */
export function buildApCommand(): Command {
  const ap = new Command('ap')
    .description('เจ้าหนี้การค้า (Accounts Payable) — Accounts Payable operations')
    .addHelpText('after', `
Examples:
  $ neip ap bill create                          # สร้างบิลค่าใช้จ่าย
  $ neip ap bill list --status overdue           # ดูบิลเกินกำหนด
  $ neip ap payment create                       # บันทึกการจ่ายชำระ
  $ neip ap po list                              # ดูใบสั่งซื้อ
  `);

  ap.addCommand(buildApBillCommand());
  ap.addCommand(buildApPaymentCommand());
  ap.addCommand(buildApPoCommand());

  return ap;
}
