/**
 * Import job handler — processes queued CSV/Excel import jobs.
 *
 * Story 8.1 — Import Engine Worker Handler
 *
 * Receives a CsvImportPayload from pg-boss, parses the file using the
 * import engine from @neip/core, and updates job progress.
 */

import type { JobHandlerInput } from '../types/jobs.js';
import { JOB_NAMES } from '../types/jobs.js';
import { log } from '../logger.js';
import { processImport } from '@neip/core';
import type { ImportType } from '@neip/core';

// ---------------------------------------------------------------------------
// Import type mapping (worker payload → core import type)
// ---------------------------------------------------------------------------

const IMPORT_TYPE_MAP: Record<string, ImportType> = {
  'transactions': 'journal_entries',
  'chart-of-accounts': 'chart_of_accounts',
  'contacts': 'contacts',
  // Direct mappings also accepted
  'journal_entries': 'journal_entries',
  'chart_of_accounts': 'chart_of_accounts',
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleImport(
  job: JobHandlerInput<typeof JOB_NAMES.CSV_IMPORT>,
): Promise<void> {
  log.info({
    msg: 'csv.import: processing',
    jobId: job.id,
    jobName: job.name,
    tenantId: job.data.tenantId,
    importType: job.data.importType,
    retryCount: job.retryCount,
  });

  const { fileRef, importType: rawImportType, tenantId, initiatedBy } = job.data;

  // Resolve import type
  const importType = IMPORT_TYPE_MAP[rawImportType];
  if (!importType) {
    log.error({
      msg: 'csv.import: unknown import type',
      jobId: job.id,
      tenantId,
      importType: rawImportType,
    });
    throw new Error(`Unknown import type: ${rawImportType}`);
  }

  // Decode the file from base64 (stored in payload for MVP)
  // In production, this would download from object storage using fileRef as a key/URL
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(fileRef, 'base64');
  } catch {
    log.error({
      msg: 'csv.import: failed to decode file data',
      jobId: job.id,
      tenantId,
    });
    throw new Error('Failed to decode file data from job payload');
  }

  // Detect file type from content (simple heuristic)
  // XLSX files start with PK (zip) header: 0x50 0x4B
  const isXlsx = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B;
  const fileType = isXlsx ? 'xlsx' : 'csv';

  log.info({
    msg: 'csv.import: starting import processing',
    jobId: job.id,
    tenantId,
    importType,
    fileType,
    fileSizeBytes: fileBuffer.length,
  });

  // Process the import using the core engine
  const result = await processImport(fileBuffer, fileType, {
    importType,
  });

  log.info({
    msg: 'csv.import: import processing complete',
    jobId: job.id,
    tenantId,
    initiatedBy,
    imported: result.imported,
    failed: result.failed,
    total: result.total,
    errorCount: result.errors.length,
  });

  // TODO: Persist valid rows to the database based on importType
  // For journal_entries: create journal entry records
  // For chart_of_accounts: upsert account records
  // For contacts: upsert contact records

  // TODO: Store import results for the status API endpoint
  // In production, update pg-boss job output or write to an import_results table

  if (result.failed > 0) {
    log.warn({
      msg: 'csv.import: some rows failed validation',
      jobId: job.id,
      tenantId,
      failedCount: result.failed,
      sampleErrors: JSON.stringify(result.errors.slice(0, 5)),
    });
  }

  log.info({
    msg: 'csv.import: completed',
    jobId: job.id,
    tenantId,
  });
}
