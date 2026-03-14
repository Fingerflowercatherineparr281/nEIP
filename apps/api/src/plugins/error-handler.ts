/**
 * Error handler plugin — maps the AppError hierarchy to RFC 7807 Problem Details responses.
 *
 * Architecture references:
 *   AR14 — RFC 7807 Problem Details for HTTP APIs
 *   AR20 — X-Request-ID correlation header on every response
 */

import type { FastifyInstance, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import {
  AppError,
  toErrorResponse,
  CONTENT_TYPE_PROBLEM_JSON,
  HEADER_REQUEST_ID,
} from '@neip/shared';

/**
 * Determine whether a value is an AppError instance without importing its
 * constructor into the type checker prematurely — plain `instanceof` is
 * enough and keeps the check fully typed.
 */
function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Determine whether a value looks like Fastify's own validation error shape.
 * Fastify wraps Ajv validation failures as FastifyError with statusCode 400
 * and a `validation` array.
 */
function isFastifyValidationError(err: unknown): err is FastifyError & {
  validation: unknown[];
  validationContext?: string;
} {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: unknown }).statusCode === 400 &&
    'validation' in err &&
    Array.isArray((err as { validation: unknown }).validation)
  );
}

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((err, request, reply) => {
    const requestId =
      (request.headers[HEADER_REQUEST_ID.toLowerCase()] as string | undefined) ??
      request.id;

    // --- AppError hierarchy → RFC 7807 -----------------------------------------
    if (isAppError(err)) {
      const body = toErrorResponse({
        ...err.toJSON(),
        instance: err.instance ?? request.url,
      });

      request.log.warn(
        { err, requestId, url: request.url, statusCode: err.status },
        'AppError',
      );

      void reply
        .status(err.status)
        .header('Content-Type', CONTENT_TYPE_PROBLEM_JSON)
        .send(body);
      return;
    }

    // --- Fastify/Ajv schema validation errors → 400 ----------------------------
    if (isFastifyValidationError(err)) {
      const body = toErrorResponse({
        type: 'https://problems.neip.app/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: err.message,
        instance: request.url,
      });

      request.log.warn(
        { err, requestId, url: request.url, statusCode: 400 },
        'FastifyValidationError',
      );

      void reply
        .status(400)
        .header('Content-Type', CONTENT_TYPE_PROBLEM_JSON)
        .send(body);
      return;
    }

    // --- FastifyError with an explicit statusCode (e.g. from fastify itself) ---
    const fastifyErr = err as FastifyError;
    if (fastifyErr.statusCode !== undefined && fastifyErr.statusCode < 500) {
      const status = fastifyErr.statusCode;
      const body = toErrorResponse({
        type: `https://problems.neip.app/http-error`,
        title: fastifyErr.name ?? 'Error',
        status,
        detail: fastifyErr.message,
        instance: request.url,
      });

      request.log.warn(
        { err, requestId, url: request.url, statusCode: status },
        'FastifyError',
      );

      void reply
        .status(status)
        .header('Content-Type', CONTENT_TYPE_PROBLEM_JSON)
        .send(body);
      return;
    }

    // --- Unexpected / internal server errors -----------------------------------
    request.log.error(
      { err, requestId, url: request.url, statusCode: 500 },
      'UnhandledError',
    );

    const body = toErrorResponse({
      type: 'https://problems.neip.app/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred. Please try again later.',
      instance: request.url,
    });

    void reply
      .status(500)
      .header('Content-Type', CONTENT_TYPE_PROBLEM_JSON)
      .send(body);
  });
}

export default fp(errorHandlerPlugin, {
  fastify: '5.x',
  name: 'error-handler',
});
