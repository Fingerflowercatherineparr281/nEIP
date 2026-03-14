/**
 * createApp — Fastify application factory.
 *
 * Registers all plugins and routes in dependency order, then returns the
 * configured Fastify instance. Keeping construction separate from listening
 * makes the app fully testable without binding a real port.
 *
 * Plugin registration order:
 *   1. request-id    — must run first so every log line carries the request ID
 *   2. helmet        — security headers (before any response can be sent)
 *   3. cors          — CORS headers
 *   4. rate-limit    — throttle before processing begins
 *   5. swagger       — schema must be registered before routes
 *   6. swagger-ui    — UI depends on swagger
 *   7. jwt           — token decode helper (auth enforcement added in Story 4.2)
 *   8. error-handler — catches errors thrown by any later plugin/route
 *   9. static        — serves Next.js out/ at root (low priority — API routes win)
 *  10. routes        — health + future feature routes
 */

import Fastify from 'fastify';
import type {
  FastifyInstance,
  RawServerDefault,
  FastifyBaseLogger,
  FastifyTypeProviderDefault,
} from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import fastifyJwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { createClient } from '@neip/db';
import type { DbClient } from '@neip/db';
import {
  CONTENT_TYPE_PROBLEM_JSON,
  AUTH_SECURITY_SCHEME_NAME,
  AUTH_SCHEME,
  API_BASE_PATH,
} from '@neip/shared';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import requestIdPlugin from './plugins/request-id.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth/index.js';
import { userRoutes } from './routes/users/index.js';
import { tenantRoutes } from './routes/tenants/index.js';
import { glRoutes } from './routes/gl/index.js';
import { arRoutes } from './routes/ar/index.js';
import { apRoutes } from './routes/ap/index.js';
import { reportRoutes } from './routes/reports/index.js';
import { importRoutes } from './routes/import/index.js';
import { exportRoutes } from './routes/export/index.js';
import { taxRoutes } from './routes/tax/index.js';
import { notificationRoutes } from './routes/notifications/index.js';
import { dashboardRoutes } from './routes/dashboard/index.js';
import { monthEndRoutes } from './routes/month-end/index.js';
import { webhookRoutesPlugin } from './routes/webhooks/index.js';
import { roleRoutesPlugin } from './routes/roles/index.js';
import { firmRoutes } from './routes/firm/index.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation — extend FastifyInstance with db + sql clients
// ---------------------------------------------------------------------------

import type { Sql } from 'postgres';

declare module 'fastify' {
  interface FastifyInstance {
    /** Drizzle ORM typed query client */
    db: DbClient;
    /** Raw postgres.js SQL client (used for low-level probes like health check) */
    sql: Sql;
  }
}

// Canonical type alias so the return type of createApp is always stable
export type App = FastifyInstance<
  RawServerDefault,
  import('http').IncomingMessage,
  import('http').ServerResponse,
  FastifyBaseLogger,
  FastifyTypeProviderDefault
>;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AppConfig {
  /** Comma-separated or array of allowed CORS origins. Defaults to `*` in dev. */
  corsOrigins?: string | string[] | RegExp;
  /** JWT signing secret — must be at least 32 characters. */
  jwtSecret: string;
  /** Database connection string. Defaults to DATABASE_URL env var. */
  databaseUrl?: string;
  /** Absolute path to the Next.js static export directory. */
  staticRoot?: string;
  /** Node environment. */
  nodeEnv?: 'development' | 'production' | 'test';
  /** Pino log level. */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build and configure the Fastify application.
 *
 * @param config - Runtime configuration (secrets, origins, paths).
 * @returns     Configured FastifyInstance, ready to call `.listen()` on.
 */
export async function createApp(config: AppConfig): Promise<App> {
  const {
    corsOrigins = '*',
    jwtSecret,
    databaseUrl,
    nodeEnv = 'development',
    logLevel = 'info',
  } = config;

  // Resolve the Next.js output directory relative to the monorepo root.
  const currentDir = fileURLToPath(new URL('.', import.meta.url));
  const defaultStaticRoot = join(currentDir, '..', '..', '..', 'web', 'out');
  const staticRoot = config.staticRoot ?? defaultStaticRoot;

  // ---------------------------------------------------------------------------
  // 1. Fastify instance with Pino structured logging
  //
  // exactOptionalPropertyTypes: true means we cannot pass `transport: undefined`
  // — we must branch so the production branch has no `transport` key at all.
  // ---------------------------------------------------------------------------

  const devTransport = {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true,
      },
    },
  } as const;

  const loggerOptions =
    nodeEnv === 'production'
      ? { level: logLevel }
      : { level: logLevel, ...devTransport };

  const app = Fastify({
    logger: loggerOptions,
    // Use a stable UUID per request as Fastify's built-in genReqId.
    // The request-id plugin overrides this with X-Request-ID header logic.
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        allErrors: true,
      },
    },
  }) as App;

  // ---------------------------------------------------------------------------
  // 2. Decorate instance with database clients
  // ---------------------------------------------------------------------------

  const { db, sql } = createClient(databaseUrl);
  app.decorate('db', db);
  // sql is a tagged-template function; Fastify interprets plain function values
  // as getter/setter descriptors in decorate(). Wrap in an object getter so
  // Fastify stores the SQL client itself rather than calling it as a getter fn.
  app.decorate<Sql>('sql', { getter: () => sql } as unknown as Sql);

  // ---------------------------------------------------------------------------
  // 3. Plugin: X-Request-ID (must be first)
  // ---------------------------------------------------------------------------

  await app.register(requestIdPlugin);

  // ---------------------------------------------------------------------------
  // 4. Plugin: Helmet — HTTP security headers
  //
  // exactOptionalPropertyTypes: true prohibits `contentSecurityPolicy: undefined`
  // — branch so the development path omits `contentSecurityPolicy` entirely.
  // ---------------------------------------------------------------------------

  if (nodeEnv === 'production') {
    await app.register(helmet, {
      crossOriginEmbedderPolicy: false, // required for Swagger UI assets
    });
  } else {
    await app.register(helmet, {
      contentSecurityPolicy: false, // disable CSP in dev so Swagger UI loads cleanly
      crossOriginEmbedderPolicy: false,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Plugin: CORS
  // ---------------------------------------------------------------------------

  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Idempotency-Key',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 86_400,
  });

  // ---------------------------------------------------------------------------
  // 6. Plugin: Rate-limiting — per-tenant, per-API-key
  // ---------------------------------------------------------------------------

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Key is derived from tenant ID (from JWT sub) or API key header,
    // falling back to IP. Full per-tenant keying is wired in Story 4.2
    // when the auth plugin attaches `request.tenantId`.
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      const ip =
        typeof forwarded === 'string'
          ? (forwarded.split(',')[0]?.trim() ?? request.ip)
          : request.ip;
      return ip;
    },
    errorResponseBuilder: (_request, context) => ({
      type: 'https://problems.neip.app/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit of ${String(context.max)} requests per ${String(context.after)} exceeded.`,
    }),
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  // ---------------------------------------------------------------------------
  // 7. Plugin: Swagger — OpenAPI 3.1 spec at /api/docs/json
  // ---------------------------------------------------------------------------

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'nEIP API',
        description: 'AI-Native ERP Platform REST API',
        version: '1.0.0',
        contact: { name: 'nEIP Team' },
        license: { name: 'Proprietary' },
      },
      servers: [
        {
          url: 'http://localhost:5400',
          description: 'Local development server',
        },
      ],
      components: {
        securitySchemes: {
          [AUTH_SECURITY_SCHEME_NAME]: {
            type: 'http',
            scheme: AUTH_SCHEME.toLowerCase(),
            bearerFormat: 'JWT',
            description: 'JWT access token — `Authorization: Bearer <token>`',
          },
        },
        schemas: {
          ErrorResponse: {
            type: 'object' as const,
            required: ['type', 'title', 'status', 'detail'],
            properties: {
              type: {
                type: 'string' as const,
                format: 'uri',
                description: 'URI reference identifying the problem type',
              },
              title: {
                type: 'string' as const,
                description: 'Short, human-readable summary',
              },
              status: {
                type: 'integer' as const,
                description: 'HTTP status code',
              },
              detail: {
                type: 'string' as const,
                description: 'Human-readable explanation specific to this occurrence',
              },
              instance: {
                type: 'string' as const,
                description: 'URI reference identifying the specific occurrence',
              },
            },
          },
        },
      },
      tags: [
        { name: 'system', description: 'System / operational endpoints' },
        { name: 'auth', description: 'Authentication and authorization' },
        { name: 'users', description: 'User management and role assignment' },
        { name: 'tenants', description: 'Tenant / organization management' },
        { name: 'gl', description: 'General Ledger, Chart of Accounts, Fiscal Years' },
        { name: 'ar', description: 'Accounts Receivable — Invoices and Payments' },
        { name: 'ap', description: 'Accounts Payable — Bills and Payments' },
        { name: 'reports', description: 'Financial report generation' },
        { name: 'tax', description: 'Tax rates — VAT and WHT configuration' },
      ],
    },
  });

  // ---------------------------------------------------------------------------
  // 8. Plugin: Swagger UI — served at /api/docs
  // ---------------------------------------------------------------------------

  await app.register(swaggerUi, {
    routePrefix: `${API_BASE_PATH}/docs`,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
  });

  // ---------------------------------------------------------------------------
  // 9. Plugin: JWT — token verification helper (enforcement in Story 4.2)
  // ---------------------------------------------------------------------------

  await app.register(fastifyJwt, {
    secret: jwtSecret,
    sign: { expiresIn: '1h', algorithm: 'HS256' },
  });

  // ---------------------------------------------------------------------------
  // 9b. Plugin: Multipart — file uploads for import (Story 8.1)
  // ---------------------------------------------------------------------------

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB max
      files: 1,                     // single file upload
    },
  });

  // ---------------------------------------------------------------------------
  // 10. Plugin: Error handler
  // ---------------------------------------------------------------------------

  await app.register(errorHandlerPlugin);

  // ---------------------------------------------------------------------------
  // 11. Plugin: Static file serving — Next.js build at apps/web/out
  //
  // Registered after API routes are declared so that /api/** paths are matched
  // first. Fastify route lookup is O(1) via a radix trie; registration order
  // only matters for the `wildcard` fallback paths handled outside the trie.
  // ---------------------------------------------------------------------------

  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: '/',
    decorateReply: false,
    wildcard: false,
  });

  // ---------------------------------------------------------------------------
  // 12. Routes — API feature routes
  // ---------------------------------------------------------------------------

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(tenantRoutes);
  await app.register(glRoutes);
  await app.register(arRoutes);
  await app.register(apRoutes);
  await app.register(reportRoutes);
  await app.register(importRoutes);
  await app.register(exportRoutes);
  await app.register(taxRoutes);
  await app.register(notificationRoutes);
  await app.register(dashboardRoutes);
  await app.register(monthEndRoutes);
  await app.register(firmRoutes);
  await app.register(webhookRoutesPlugin);
  await app.register(roleRoutesPlugin);

  // ---------------------------------------------------------------------------
  // 13. 404 fallback — serve Next.js index.html for unrecognised non-API paths
  // ---------------------------------------------------------------------------

  app.setNotFoundHandler((_request, reply) => {
    // API paths that are truly not found should get a 404 Problem Details body.
    if (_request.url.startsWith(`${API_BASE_PATH}/`)) {
      void reply
        .status(404)
        .header('Content-Type', CONTENT_TYPE_PROBLEM_JSON)
        .send({
          type: 'https://problems.neip.app/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Route ${_request.method} ${_request.url} not found.`,
          instance: _request.url,
        });
      return;
    }

    // For all other paths, fall back to the Next.js SPA shell.
    void reply.sendFile('index.html', staticRoot);
  });

  return app;
}
