import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Severity levels aligned with axe-core impact values.
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Structured accessibility violation returned by the scanner.
 */
export interface A11yViolation {
  /** axe-core rule id (e.g. "color-contrast") */
  ruleId: string;
  /** Human-readable description of the issue */
  description: string;
  /** WCAG criteria tags (e.g. "wcag2aa", "wcag143") */
  wcagTags: string[];
  /** Impact / severity */
  severity: Severity;
  /** Suggested fix from axe-core */
  fixSuggestion: string;
  /** Affected HTML elements (CSS selectors) */
  affectedElements: string[];
  /** Help URL for the rule */
  helpUrl: string;
}

/**
 * Full scan result for a single page.
 */
export interface A11yScanResult {
  /** URL that was scanned */
  url: string;
  /** Human-readable page name */
  pageName: string;
  /** ISO timestamp */
  timestamp: string;
  /** All violations found */
  violations: A11yViolation[];
  /** Summary counts by severity */
  summary: Record<Severity, number>;
  /** Whether the scan should be considered a failure (critical or serious violations) */
  failed: boolean;
}

const RESULTS_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  'results',
);

/**
 * Run an axe-core accessibility scan against the current page state.
 *
 * @param page      Playwright Page object (already navigated)
 * @param pageName  Friendly name used for the output file
 * @returns         Structured scan results
 */
export async function scanPage(
  page: Page,
  pageName: string,
): Promise<A11yScanResult> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations: A11yViolation[] = results.violations.map((v) => ({
    ruleId: v.id,
    description: v.description,
    wcagTags: v.tags.filter(
      (t) => t.startsWith('wcag') || t.startsWith('best-practice'),
    ),
    severity: (v.impact ?? 'minor') as Severity,
    fixSuggestion: v.help,
    affectedElements: v.nodes.map((n) => n.target.join(' ')),
    helpUrl: v.helpUrl,
  }));

  const summary: Record<Severity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  for (const v of violations) {
    summary[v.severity]++;
  }

  const scanResult: A11yScanResult = {
    url: page.url(),
    pageName,
    timestamp: new Date().toISOString(),
    violations,
    summary,
    failed: summary.critical > 0 || summary.serious > 0,
  };

  // Persist results as JSON
  saveResults(scanResult);

  return scanResult;
}

/**
 * Write scan results to the results/ directory as JSON.
 */
function saveResults(result: A11yScanResult): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const filename = `${result.pageName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
}

/**
 * Format violations into a human-readable summary string (useful for CI output).
 */
export function formatSummary(result: A11yScanResult): string {
  const lines: string[] = [
    `=== A11y Report: ${result.pageName} (${result.url}) ===`,
    `Scanned at: ${result.timestamp}`,
    `Critical: ${result.summary.critical} | Serious: ${result.summary.serious} | Moderate: ${result.summary.moderate} | Minor: ${result.summary.minor}`,
  ];

  if (result.violations.length > 0) {
    lines.push('', 'Violations:');
    for (const v of result.violations) {
      lines.push(
        `  [${v.severity.toUpperCase()}] ${v.ruleId}: ${v.description}`,
        `    Fix: ${v.fixSuggestion}`,
        `    Elements: ${v.affectedElements.join(', ')}`,
        `    Help: ${v.helpUrl}`,
      );
    }
  } else {
    lines.push('', 'No violations found.');
  }

  return lines.join('\n');
}
