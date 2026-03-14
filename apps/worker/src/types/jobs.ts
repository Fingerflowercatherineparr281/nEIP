/**
 * Type-safe job definition interfaces for the nEIP pg-boss worker.
 *
 * Every job type is modelled as a discriminated union member so that handlers
 * can pattern-match exhaustively.  New job types extend this file; the
 * registry in worker.ts picks them up automatically.
 *
 * Architecture reference: AR10 (pg-boss queue), NFR-O1 (structured logging)
 */

// ---------------------------------------------------------------------------
// Branded scalar helpers
// ---------------------------------------------------------------------------

/** UUIDv7 string — used for ids. */
type Uuid = string;

// ---------------------------------------------------------------------------
// Job name constants (single source of truth)
// ---------------------------------------------------------------------------

export const JOB_NAMES = {
  EXAMPLE_PING: 'example.ping',
  INVOICE_MATCH: 'invoice.match',
  PAYMENT_APPLY: 'payment.apply',
  MONTH_END_CLOSE: 'month-end.close',
  CSV_IMPORT: 'csv.import',
  NOTIFICATION_SEND: 'notification.send',
  WEBHOOK_DELIVER: 'webhook.deliver',
} as const satisfies Record<string, `${string}.${string}`>;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ---------------------------------------------------------------------------
// Base payload — all job data must include these tenant-scoped fields
// ---------------------------------------------------------------------------

/**
 * Every job payload must be a sub-type of BaseJobPayload.
 * tenantId is required for multi-tenant isolation (NFR-S5).
 * correlationId allows tracing across async boundaries.
 */
export interface BaseJobPayload {
  /** The organisation (tenant) this job belongs to. */
  readonly tenantId: Uuid;
  /** Optional correlation ID from the originating HTTP request. */
  readonly correlationId?: string;
}

// ---------------------------------------------------------------------------
// Concrete payload types per job name
// ---------------------------------------------------------------------------

export interface ExamplePingPayload extends BaseJobPayload {
  readonly message: string;
}

export interface InvoiceMatchPayload extends BaseJobPayload {
  /** UUIDv7 of the payment record to match against open invoices. */
  readonly paymentId: Uuid;
  /**
   * Override the default confidence threshold for this run expressed as a
   * fraction in [0, 1].  When omitted the agent uses its built-in defaults.
   */
  readonly confidenceThresholdOverride?: number;
  /**
   * Optional: pre-supply the payment amount in satang (bigint serialised as
   * decimal string) so the worker does not need a DB round-trip for validation.
   * When present, must match the persisted payment record exactly.
   */
  readonly amountSatang?: string;
  /**
   * Optional: pre-supply the customer ID so that the worker can pass it
   * directly to the matching agent without an extra DB query.
   */
  readonly customerId?: string;
}

export interface PaymentApplyPayload extends BaseJobPayload {
  readonly paymentId: Uuid;
  readonly invoiceId: Uuid;
  /** Confidence score returned by the AI agent (0-100). */
  readonly confidence: number;
}

export interface MonthEndClosePayload extends BaseJobPayload {
  /** Fiscal year number, e.g. 2025. */
  readonly fiscalYear: number;
  /** Fiscal period (1–12). */
  readonly fiscalPeriod: number;
  /** UUIDv7 of the user who initiated the close. */
  readonly initiatedBy: Uuid;
}

export interface CsvImportPayload extends BaseJobPayload {
  /** Storage path or signed URL to the uploaded CSV file. */
  readonly fileRef: string;
  readonly importType: 'transactions' | 'chart-of-accounts' | 'contacts';
  readonly initiatedBy: Uuid;
}

export interface NotificationSendPayload extends BaseJobPayload {
  readonly recipientUserId: Uuid;
  readonly channel: 'email' | 'line';
  readonly templateId: string;
  readonly templateData: Record<string, string | number | boolean>;
}

export interface WebhookDeliverPayload extends BaseJobPayload {
  /** UUIDv7 of the webhook registration. */
  readonly webhookId: Uuid;
  /** The webhook endpoint URL. */
  readonly webhookUrl: string;
  /** The domain event to deliver. */
  readonly event: {
    readonly id: string;
    readonly type: string;
    readonly tenantId: string;
    readonly payload: unknown;
    readonly version: number;
    readonly timestamp: Date;
  };
}

// ---------------------------------------------------------------------------
// Discriminated union — the canonical registry of all job shapes
// ---------------------------------------------------------------------------

export type JobPayloadMap = {
  [JOB_NAMES.EXAMPLE_PING]: ExamplePingPayload;
  [JOB_NAMES.INVOICE_MATCH]: InvoiceMatchPayload;
  [JOB_NAMES.PAYMENT_APPLY]: PaymentApplyPayload;
  [JOB_NAMES.MONTH_END_CLOSE]: MonthEndClosePayload;
  [JOB_NAMES.CSV_IMPORT]: CsvImportPayload;
  [JOB_NAMES.NOTIFICATION_SEND]: NotificationSendPayload;
  [JOB_NAMES.WEBHOOK_DELIVER]: WebhookDeliverPayload;
};

/**
 * Strongly-typed handler callback.
 * N is constrained to the keys of JobPayloadMap so that each handler
 * only receives the payload it declares.
 */
export type JobHandler<N extends JobName> = (
  job: JobHandlerInput<N>,
) => Promise<void>;

export interface JobHandlerInput<N extends JobName> {
  readonly id: string;
  readonly name: N;
  readonly data: JobPayloadMap[N];
  /** ISO 8601 timestamp when pg-boss created the job row. */
  readonly createdOn: string;
  /** Number of times this job has been attempted (1-based). */
  readonly retryCount: number;
}

// ---------------------------------------------------------------------------
// Handler registry type — maps every job name to its handler
// ---------------------------------------------------------------------------

export type HandlerRegistry = {
  [N in JobName]: JobHandler<N>;
};
