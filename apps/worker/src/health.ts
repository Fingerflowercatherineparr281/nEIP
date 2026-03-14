/**
 * Lightweight HTTP health-check server for the worker process.
 *
 * Exposes GET /health so container orchestrators (Docker, Kubernetes) can
 * probe liveness/readiness without depending on the pg-boss port.
 *
 * Response shape matches NFR-O2:
 *   { status: "ok"|"degraded", queue: { healthy, started, error } }
 *
 * Port defaults to WORKER_HEALTH_PORT env var or 5401.
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { getQueueStatus } from './worker.js';
import { log } from './logger.js';

const DEFAULT_HEALTH_PORT = 5401;

interface HealthResponse {
  status: 'ok' | 'degraded';
  service: 'worker';
  queue: {
    healthy: boolean;
    started: boolean;
    error: string | null;
  };
  timestamp: string;
}

function handleRequest(_req: IncomingMessage, res: ServerResponse): void {
  const queueStatus = getQueueStatus();
  const overall = queueStatus.healthy ? 'ok' : 'degraded';

  const body: HealthResponse = {
    status: overall,
    service: 'worker',
    queue: queueStatus,
    timestamp: new Date().toISOString(),
  };

  const json = JSON.stringify(body);
  const statusCode = overall === 'ok' ? 200 : 503;

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

/**
 * Starts the health-check HTTP server.
 * Returns the Server instance so the caller can close it on shutdown.
 */
export function startHealthServer(
  port: number = DEFAULT_HEALTH_PORT,
): Server {
  const server = createServer(handleRequest);

  server.listen(port, () => {
    log.info({ msg: 'health server listening', port });
  });

  server.on('error', (err) => {
    log.error({
      msg: 'health server error',
      error: err.message,
    });
  });

  return server;
}

/**
 * Gracefully closes the health-check server.
 */
export async function stopHealthServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err !== undefined) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
