/**
 * AppError class hierarchy following RFC 7807 Problem Details for HTTP APIs.
 * Architecture reference: AR14, AR38
 *
 * RFC 7807 shape:
 *   { type: string, title: string, status: number, detail: string, instance?: string }
 */

/** Parameters accepted by AppError constructor */
interface AppErrorParams {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  cause?: unknown;
}

/**
 * Accept optional fields that may carry `undefined` at the call site
 * (exactOptionalPropertyTypes requires we distinguish "absent" from "undefined").
 * This type is used only inside this module for internal param merging.
 */
interface OptionalFields {
  instance?: string | undefined;
  cause?: unknown;
}

/** Build a params object for calling super() from subclasses */
function buildParams(
  fixed: Omit<AppErrorParams, 'instance' | 'cause'>,
  extra: OptionalFields,
): AppErrorParams {
  const result: AppErrorParams = { ...fixed };
  if (extra.instance !== undefined) {
    result.instance = extra.instance;
  }
  if (extra.cause !== undefined) {
    result.cause = extra.cause;
  }
  return result;
}

export class AppError extends Error {
  /** A URI reference that identifies the problem type */
  public readonly type: string;
  /** A short, human-readable summary of the problem type */
  public readonly title: string;
  /** HTTP status code */
  public readonly status: number;
  /** Human-readable explanation specific to this occurrence */
  public readonly detail: string;
  /** A URI reference identifying the specific occurrence of the problem */
  public readonly instance?: string;

  constructor(params: AppErrorParams) {
    super(params.detail, { cause: params.cause });
    this.name = this.constructor.name;
    this.type = params.type;
    this.title = params.title;
    this.status = params.status;
    this.detail = params.detail;
    if (params.instance !== undefined) {
      this.instance = params.instance;
    }

    // Restore prototype chain (required when extending built-ins in TypeScript)
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Serialise to RFC 7807 Problem Details object */
  toJSON(): {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
  } {
    const base: {
      type: string;
      title: string;
      status: number;
      detail: string;
      instance?: string;
    } = {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    };
    if (this.instance !== undefined) {
      base.instance = this.instance;
    }
    return base;
  }
}

// ---------------------------------------------------------------------------
// 400 Bad Request — Validation failure
// ---------------------------------------------------------------------------

/** Subclass constructor input for ValidationError */
interface ValidationErrorInput {
  detail: string;
  instance?: string | undefined;
  errors?: ReadonlyArray<{ field: string; message: string }> | undefined;
  cause?: unknown;
}

export class ValidationError extends AppError {
  /** Structured field-level validation failures */
  public readonly errors?: ReadonlyArray<{ field: string; message: string }>;

  constructor(params: ValidationErrorInput) {
    super(
      buildParams(
        {
          type: 'https://problems.neip.app/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: params.detail,
        },
        params,
      ),
    );
    if (params.errors !== undefined) {
      this.errors = params.errors;
    }
  }
}

// ---------------------------------------------------------------------------
// 401 Unauthorized — Authentication required
// ---------------------------------------------------------------------------

interface AuthErrorInput {
  detail?: string | undefined;
  instance?: string | undefined;
  cause?: unknown;
}

export class AuthError extends AppError {
  constructor(params: AuthErrorInput = {}) {
    super(
      buildParams(
        {
          type: 'https://problems.neip.app/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: params.detail ?? 'Authentication is required to access this resource.',
        },
        params,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// 403 Forbidden — Insufficient permissions
// ---------------------------------------------------------------------------

interface ForbiddenErrorInput {
  detail?: string | undefined;
  instance?: string | undefined;
  cause?: unknown;
}

export class ForbiddenError extends AppError {
  constructor(params: ForbiddenErrorInput = {}) {
    super(
      buildParams(
        {
          type: 'https://problems.neip.app/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: params.detail ?? 'You do not have permission to perform this action.',
        },
        params,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// 404 Not Found
// ---------------------------------------------------------------------------

interface NotFoundErrorInput {
  detail?: string | undefined;
  instance?: string | undefined;
  cause?: unknown;
}

export class NotFoundError extends AppError {
  constructor(params: NotFoundErrorInput = {}) {
    super(
      buildParams(
        {
          type: 'https://problems.neip.app/not-found',
          title: 'Not Found',
          status: 404,
          detail: params.detail ?? 'The requested resource was not found.',
        },
        params,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// 409 Conflict — Optimistic concurrency or duplicate resource
// ---------------------------------------------------------------------------

interface ConflictErrorInput {
  detail?: string | undefined;
  instance?: string | undefined;
  cause?: unknown;
}

export class ConflictError extends AppError {
  constructor(params: ConflictErrorInput = {}) {
    super(
      buildParams(
        {
          type: 'https://problems.neip.app/conflict',
          title: 'Conflict',
          status: 409,
          detail:
            params.detail ?? 'The request conflicts with the current state of the resource.',
        },
        params,
      ),
    );
  }
}
