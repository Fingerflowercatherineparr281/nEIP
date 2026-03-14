/**
 * Request-ID plugin — generates or forwards X-Request-ID per request.
 *
 * Architecture reference:
 *   AR20 — X-Request-ID required as a correlation header on every
 *           request and echoed back on every response.
 *
 * Behaviour:
 *   - If the incoming request already carries an X-Request-ID header,
 *     that value is used as-is (client-supplied correlation ID).
 *   - If the header is absent, a new UUID v4 is generated.
 *   - The resolved ID is set on `request.id` so Pino includes it in
 *     every log record for the lifetime of the request.
 *   - The ID is echoed back in the X-Request-ID response header so
 *     clients can correlate logs.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import { HEADER_REQUEST_ID } from '@neip/shared';

/** Lower-cased version used for case-insensitive header look-up. */
const HEADER_LOWER = HEADER_REQUEST_ID.toLowerCase();

/**
 * Extract the X-Request-ID from the incoming request headers.
 * Returns the existing value if present, otherwise generates a new UUID v4.
 */
function resolveRequestId(req: FastifyRequest): string {
  const existing = req.headers[HEADER_LOWER];
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }
  return randomUUID();
}

async function requestIdPlugin(fastify: FastifyInstance): Promise<void> {
  /**
   * Override Fastify's built-in request ID generation so the value is
   * populated before any other hook or plugin runs.
   */
  fastify.addHook('onRequest', (request, _reply, done) => {
    (request as FastifyRequest & { id: string }).id = resolveRequestId(request);
    done();
  });

  /**
   * Echo the resolved request ID back in the response so clients can
   * correlate their logs with server-side traces.
   */
  fastify.addHook('onSend', (_request, reply, _payload, done) => {
    void reply.header(HEADER_REQUEST_ID, _request.id);
    done();
  });
}

export default fp(requestIdPlugin, {
  fastify: '5.x',
  name: 'request-id',
});
