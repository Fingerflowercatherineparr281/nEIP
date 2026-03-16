/**
 * neip gl — General Ledger command group.
 *
 * Registers all GL sub-commands under the `gl` namespace:
 *   neip gl journal ...
 *   neip gl accounts ...
 */

import { Command } from 'commander';
import { buildAccountsCommand } from './accounts.js';
import { buildJournalCommand } from './journal.js';

/**
 * Build the `gl` command group and attach all sub-commands.
 */
export function buildGlCommand(): Command {
  const gl = new Command('gl')
    .description('บัญชีแยกประเภทสมุดบัญชีหลัก (General Ledger) — General Ledger operations')
    .addHelpText('after', `
Examples:
  $ neip gl accounts list                        # ดูผังบัญชี
  $ neip gl accounts create                      # สร้างบัญชีใหม่
  $ neip gl journal list                         # ดูรายการบัญชี
  $ neip gl journal create                       # สร้างรายการบัญชีใหม่
  $ neip gl journal post <id>                    # post รายการบัญชี
  `);

  gl.addCommand(buildJournalCommand());
  gl.addCommand(buildAccountsCommand());

  return gl;
}
