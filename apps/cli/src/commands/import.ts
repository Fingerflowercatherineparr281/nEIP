/**
 * neip import — Data Import commands.
 *
 * Commands:
 *   neip import upload <file>      — POST /api/v1/import (multipart)
 *   neip import preview <file>     — POST /api/v1/import/preview
 *   neip import status <jobId>     — GET  /api/v1/import/:jobId
 */

import { createReadStream, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { Command } from 'commander';
import { getConfigValue } from '../lib/config-store.js';
import { printError, printSuccess } from '../output/formatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Response shape for an import job. */
interface ImportJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filename: string;
  totalRows: number;
  processedRows: number;
  errors: string[];
  createdAt: string;
  completedAt: string | null;
}

/** Preview response shape. */
interface ImportPreview {
  filename: string;
  totalRows: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  validationErrors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:5400';

function resolveBaseUrl(): string {
  return getConfigValue('apiUrl') ?? DEFAULT_BASE_URL;
}

function buildAuthHeaders(): Record<string, string> {
  const token = getConfigValue('accessToken');
  if (token !== undefined && token !== '') {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * POST a multipart/form-data file upload to the given API path.
 * Returns the parsed JSON response.
 */
async function postMultipart<T>(pathname: string, filePath: string): Promise<{ ok: true; data: T } | { ok: false; detail: string; status: number }> {
  const baseUrl = resolveBaseUrl();
  const url = new URL(pathname, baseUrl);

  // Node.js 18+ fetch supports FormData natively
  const formData = new FormData();
  const fileContent = createReadStream(filePath);
  const fileName = basename(filePath);

  // Collect stream to Blob for fetch FormData
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    fileContent.on('data', (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));
    fileContent.on('end', resolve);
    fileContent.on('error', reject);
  });

  const blob = new Blob(chunks as Uint8Array<ArrayBuffer>[]);
  formData.append('file', blob, fileName);

  const headers = buildAuthHeaders();

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, detail: message, status: 0 };
  }

  if (response.ok) {
    const data = (await response.json()) as T;
    return { ok: true, data };
  }

  let detail = `Request failed with status ${response.status}`;
  try {
    const errBody = (await response.json()) as { detail?: string };
    if (errBody.detail !== undefined) detail = errBody.detail;
  } catch {
    // ignore parse errors
  }

  return { ok: false, detail, status: response.status };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function importUpload(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    printError(`File not found: ${filePath}`);
    process.exit(1);
  }

  process.stdout.write(`Uploading ${basename(filePath)}...\n`);

  const result = await postMultipart<{ data: ImportJob }>('/api/v1/import', filePath);

  if (!result.ok) {
    printError(result.detail, result.status);
    process.exit(1);
  }

  const job = result.data.data;
  printSuccess(job, `Import job ${job.jobId} created. Use "neip import status ${job.jobId}" to track progress.`);
}

async function importPreview(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    printError(`File not found: ${filePath}`);
    process.exit(1);
  }

  process.stdout.write(`Previewing ${basename(filePath)}...\n`);

  const result = await postMultipart<{ data: ImportPreview }>('/api/v1/import/preview', filePath);

  if (!result.ok) {
    printError(result.detail, result.status);
    process.exit(1);
  }

  printSuccess(result.data.data, 'Import preview:');
}

async function importStatus(jobId: string): Promise<void> {
  if (jobId === '') {
    printError('Job ID is required.');
    process.exit(1);
  }

  const baseUrl = resolveBaseUrl();
  const url = new URL(`/api/v1/import/${jobId}`, baseUrl);
  const headers = { ...buildAuthHeaders(), Accept: 'application/json' };

  let response: Response;
  try {
    response = await fetch(url.toString(), { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    printError(message);
    process.exit(1);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errBody = (await response.json()) as { detail?: string };
      if (errBody.detail !== undefined) detail = errBody.detail;
    } catch {
      // ignore
    }
    printError(detail, response.status);
    process.exit(1);
  }

  const body = (await response.json()) as { data: ImportJob };
  printSuccess(body.data, `Import job ${jobId} status:`);
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

/**
 * Build the `import` command group.
 */
export function buildImportCommand(): Command {
  const importCmd = new Command('import')
    .description('นำเข้าข้อมูลจากไฟล์ CSV/Excel — Data import operations')
    .addHelpText('after', `
Examples:
  $ neip import preview ./contacts.csv       # ดูตัวอย่างก่อน import
  $ neip import upload ./contacts.csv        # อัพโหลดไฟล์และเริ่ม job
  $ neip import status <jobId>               # ตรวจสอบสถานะ job
  `);

  importCmd
    .command('upload <file>')
    .description('อัพโหลดไฟล์เพื่อเริ่ม background import job — Upload a file to start a background import job')
    .action(async (file: string) => {
      await importUpload(file);
    });

  importCmd
    .command('preview <file>')
    .description('ดูตัวอย่างไฟล์ก่อน import โดยไม่บันทึกข้อมูล — Preview a file import without committing data')
    .action(async (file: string) => {
      await importPreview(file);
    });

  importCmd
    .command('status <jobId>')
    .description('ตรวจสอบสถานะ import job — Get the status of an import job by job ID')
    .action(async (jobId: string) => {
      await importStatus(jobId);
    });

  return importCmd;
}
