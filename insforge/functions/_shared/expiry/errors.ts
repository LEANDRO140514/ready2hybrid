export type ExpiryPublicErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'SCHEDULE_SECRET_NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'LEASE_ACQUIRE_FAILED'
  | 'BATCH_RPC_FAILED'
  | 'DRY_RUN_RPC_FAILED'
  | 'LEASE_RELEASE_FAILED'
  | 'INTERNAL_ERROR'

type ExpiryPublicErrorBody = {
  error: {
    code: ExpiryPublicErrorCode
    message: string
  }
}

const ERROR_META: Record<
  ExpiryPublicErrorCode,
  { status: number; message: string }
> = {
  METHOD_NOT_ALLOWED: { status: 405, message: 'Method not allowed.' },
  SCHEDULE_SECRET_NOT_CONFIGURED: {
    status: 503,
    message: 'Expiry schedule is not configured.',
  },
  UNAUTHORIZED: { status: 401, message: 'Authorization is required.' },
  FORBIDDEN: { status: 403, message: 'Authorization was rejected.' },
  INVALID_REQUEST: { status: 400, message: 'Invalid expiry request.' },
  LEASE_ACQUIRE_FAILED: {
    status: 503,
    message: 'Expiry run lease could not be acquired.',
  },
  BATCH_RPC_FAILED: {
    status: 503,
    message: 'Expiry batch processing failed.',
  },
  DRY_RUN_RPC_FAILED: {
    status: 503,
    message: 'Expiry dry-run failed.',
  },
  LEASE_RELEASE_FAILED: {
    status: 503,
    message: 'Expiry run lease could not be released.',
  },
  INTERNAL_ERROR: { status: 500, message: 'Unexpected expiry reconciler error.' },
}

export class ExpiryError extends Error {
  readonly code: ExpiryPublicErrorCode
  readonly status: number

  constructor(code: ExpiryPublicErrorCode) {
    super(ERROR_META[code].message)
    this.code = code
    this.status = ERROR_META[code].status
  }

  toPublicBody(): ExpiryPublicErrorBody {
    return {
      error: {
        code: this.code,
        message: ERROR_META[this.code].message,
      },
    }
  }
}

export function isExpiryError(error: unknown): error is ExpiryError {
  return error instanceof ExpiryError
}
