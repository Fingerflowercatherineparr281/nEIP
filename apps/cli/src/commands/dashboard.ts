/**
 * neip dashboard — Dashboard commands.
 *
 * Commands:
 *   neip dashboard              — GET /api/v1/dashboard/executive
 *   neip dashboard consolidated — GET /api/v1/dashboard/consolidated
 */

import { Command } from 'commander';
import { api } from '../lib/api-client.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function dashboardExecutive(): Promise<void> {
  const result = await api.get<unknown>('/api/v1/dashboard/executive');

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, 'Executive Dashboard:');
}

async function dashboardConsolidated(): Promise<void> {
  const result = await api.get<unknown>('/api/v1/dashboard/consolidated');

  if (!result.ok) {
    printError(result.error.detail, result.error.status);
    process.exit(1);
  }

  printSuccess(result.data, 'Consolidated Dashboard:');
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `dashboard` command group.
 */
export function buildDashboardCommand(): Command {
  const dashboard = new Command('dashboard')
    .description('แดชบอร์ดและ KPI — Dashboard and KPI views')
    .addHelpText('after', `
Examples:
  $ neip dashboard                      # แดชบอร์ดผู้บริหาร (executive)
  $ neip dashboard consolidated         # แดชบอร์ดรวมหลายองค์กร (firm-level)
  `);

  // Default action — executive dashboard
  dashboard
    .action(async () => {
      await dashboardExecutive();
    });

  dashboard
    .command('consolidated')
    .description('แดชบอร์ดรวมหลายองค์กร — View consolidated multi-entity dashboard (firm-level)')
    .action(async () => {
      await dashboardConsolidated();
    });

  return dashboard;
}
