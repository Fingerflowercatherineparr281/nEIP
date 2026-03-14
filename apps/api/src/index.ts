/**
 * index.ts — Entry point for the nEIP API server.
 *
 * Calls start() from server.ts which builds the Fastify application,
 * registers all plugins, and begins listening on PORT (default 5400).
 *
 * ห้าม console.log — all output goes through Pino structured logging.
 */

import { start } from './server.js';

await start();
