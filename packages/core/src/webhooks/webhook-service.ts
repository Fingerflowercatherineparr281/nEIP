/**
 * WebhookService — Registration, listing, deletion, and delivery of webhooks.
 *
 * Architecture reference: Story 13.1 (Webhook Registration + Delivery)
 *
 * Responsibilities:
 *  - CRUD operations for webhook registrations (scoped to tenant).
 *  - Deliver event payloads to registered webhook URLs with HMAC-SHA256 signature.
 *  - At-least-once delivery with exponential backoff retry (max 5 attempts).
 *  - Mark webhook as `failing` after all retries are exhausted.
 */

import { createHmac } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { DbClient } from '@neip/db';
import { webhooks } from '@neip/db';
import type { DomainEvent } from '@neip/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookInput {
  readonly tenantId: string;
  readonly url: string;
  readonly events: string[];
  readonly secret: string;
}

export interface WebhookOutput {
  readonly id: string;
  readonly tenantId: string;
  readonly url: string;
  readonly events: string[];
  readonly status: 'active' | 'failing';
  readonly lastDeliveryAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DeliveryResult {
  readonly webhookId: string;
  readonly success: boolean;
  readonly statusCode?: number;
  readonly error?: string;
  readonly attempt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of delivery attempts with exponential backoff. */
export const MAX_DELIVERY_ATTEMPTS = 5;

/** Base delay in milliseconds for exponential backoff (doubles each attempt). */
const BASE_DELAY_MS = 1_000;

/** Request timeout for webhook delivery in milliseconds. */
const DELIVERY_TIMEOUT_MS = 10_000;

/** HMAC signature header name. */
export const SIGNATURE_HEADER = 'x-neip-signature-256';

/** Timestamp header for replay protection. */
export const TIMESTAMP_HEADER = 'x-neip-timestamp';

// ---------------------------------------------------------------------------
// WebhookService
// ---------------------------------------------------------------------------

export class WebhookService {
  readonly #db: DbClient;

  constructor(db: DbClient) {
    this.#db = db;
  }

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  async register(input: WebhookInput): Promise<WebhookOutput> {
    const id = uuidv7();
    const now = new Date();

    await this.#db.insert(webhooks).values({
      id,
      tenant_id: input.tenantId,
      url: input.url,
      events: input.events,
      secret: input.secret,
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    return {
      id,
      tenantId: input.tenantId,
      url: input.url,
      events: input.events,
      status: 'active',
      lastDeliveryAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  async list(tenantId: string): Promise<readonly WebhookOutput[]> {
    const rows = await this.#db
      .select()
      .from(webhooks)
      .where(eq(webhooks.tenant_id, tenantId));

    return rows.map(rowToOutput);
  }

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.#db
      .delete(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.tenant_id, tenantId)))
      .returning({ id: webhooks.id });

    return result.length > 0;
  }

  // -------------------------------------------------------------------------
  // getActiveForEvent
  // -------------------------------------------------------------------------

  /**
   * Return all active webhooks for a tenant that are subscribed to the given
   * event type. A webhook subscribes via exact match or wildcard '*'.
   */
  async getActiveForEvent(
    tenantId: string,
    eventType: string,
  ): Promise<readonly WebhookOutput[]> {
    const rows = await this.#db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.tenant_id, tenantId), eq(webhooks.status, 'active')));

    // Filter in application layer since jsonb array contains is simpler here
    return rows
      .filter((row) => {
        const events = row.events as string[];
        return events.includes('*') || events.includes(eventType);
      })
      .map(rowToOutput);
  }

  // -------------------------------------------------------------------------
  // deliver
  // -------------------------------------------------------------------------

  /**
   * Deliver an event payload to a webhook URL with HMAC-SHA256 signature.
   * Retries with exponential backoff up to MAX_DELIVERY_ATTEMPTS times.
   *
   * @returns DeliveryResult indicating success or final failure.
   */
  async deliver(
    webhook: WebhookOutput,
    event: DomainEvent,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      tenantId: event.tenantId,
      payload: event.payload,
      version: event.version,
      timestamp: event.timestamp,
    });

    // Look up the secret from the DB (not stored in WebhookOutput for security)
    const [row] = await this.#db
      .select({ secret: webhooks.secret })
      .from(webhooks)
      .where(eq(webhooks.id, webhook.id));

    if (!row) {
      return {
        webhookId: webhook.id,
        success: false,
        error: 'Webhook not found',
        attempt: 0,
      };
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(row.secret, timestamp, body);

    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [SIGNATURE_HEADER]: signature,
            [TIMESTAMP_HEADER]: timestamp,
          },
          body,
          signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        });

        if (response.ok) {
          // Mark last_delivery_at
          await this.#db
            .update(webhooks)
            .set({ last_delivery_at: new Date(), updated_at: new Date() })
            .where(eq(webhooks.id, webhook.id));

          return {
            webhookId: webhook.id,
            success: true,
            statusCode: response.status,
            attempt,
          };
        }

        // Non-2xx — retry if attempts remain
        if (attempt < MAX_DELIVERY_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }

        // Final attempt failed — mark as failing
        await this.#markFailing(webhook.id);
        return {
          webhookId: webhook.id,
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
          attempt,
        };
      } catch (err: unknown) {
        if (attempt < MAX_DELIVERY_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }

        // Final attempt — mark as failing
        await this.#markFailing(webhook.id);
        return {
          webhookId: webhook.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          attempt,
        };
      }
    }

    // Should never reach here but TypeScript needs a return
    return { webhookId: webhook.id, success: false, attempt: MAX_DELIVERY_ATTEMPTS };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  async #markFailing(webhookId: string): Promise<void> {
    await this.#db
      .update(webhooks)
      .set({ status: 'failing', updated_at: new Date() })
      .where(eq(webhooks.id, webhookId));
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function rowToOutput(row: typeof webhooks.$inferSelect): WebhookOutput {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    url: row.url,
    events: row.events as string[],
    status: row.status as 'active' | 'failing',
    lastDeliveryAt: row.last_delivery_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Compute HMAC-SHA256 signature for webhook payload.
 *
 * The signed content is `{timestamp}.{body}` to prevent replay attacks.
 */
export function computeSignature(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const signedContent = `${timestamp}.${body}`;
  return `sha256=${createHmac('sha256', secret).update(signedContent).digest('hex')}`;
}

/**
 * Verify a webhook signature against the expected value.
 */
export function verifySignature(
  secret: string,
  timestamp: string,
  body: string,
  receivedSignature: string,
): boolean {
  const expected = computeSignature(secret, timestamp, body);
  // Constant-time comparison via crypto.timingSafeEqual would be ideal,
  // but for simplicity we compare hex strings (both are deterministic length).
  if (expected.length !== receivedSignature.length) return false;

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
  }
  return result === 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
