export type WebhookErrorCode =
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'UNAUTHORIZED'
  | 'WEBHOOK_NOT_CONFIGURED'
  | 'CONFIGURATION_ERROR'
  | 'UNSUPPORTED_TOPIC'
  | 'PROVIDER_UNAVAILABLE'
  | 'PAYMENT_NOT_FOUND'
  | 'INTERNAL_ERROR'

export type WebhookErrorBody = {
  error: {
    code: WebhookErrorCode
    message: string
    retry?: 'NO' | 'OPTIONAL' | 'AFTER_STATE_CHANGE'
  }
}

const MESSAGES: Record<
  WebhookErrorCode,
  { message: string; retry: WebhookErrorBody['error']['retry']; status: number }
> = {
  INVALID_REQUEST: { message: 'Invalid webhook request.', retry: 'NO', status: 400 },
  METHOD_NOT_ALLOWED: { message: 'Method not allowed.', retry: 'NO', status: 405 },
  UNAUTHORIZED: { message: 'Webhook signature rejected.', retry: 'NO', status: 401 },
  WEBHOOK_NOT_CONFIGURED: { message: 'Webhook is not configured.', retry: 'NO', status: 503 },
  CONFIGURATION_ERROR: { message: 'Webhook runtime is misconfigured.', retry: 'NO', status: 503 },
  UNSUPPORTED_TOPIC: { message: 'Notification topic ignored.', retry: 'NO', status: 200 },
  PROVIDER_UNAVAILABLE: { message: 'Payment provider temporarily unavailable.', retry: 'OPTIONAL', status: 503 },
  PAYMENT_NOT_FOUND: { message: 'Provider payment was not found.', retry: 'NO', status: 404 },
  INTERNAL_ERROR: { message: 'Unexpected webhook error.', retry: 'OPTIONAL', status: 500 },
}

export class WebhookError extends Error {
  readonly code: WebhookErrorCode
  readonly status: number
  readonly retry: WebhookErrorBody['error']['retry']

  constructor(code: WebhookErrorCode, detail?: string) {
    const meta = MESSAGES[code]
    super(detail ?? meta.message)
    this.code = code
    this.status = meta.status
    this.retry = meta.retry
  }

  toPublicBody(): WebhookErrorBody {
    return {
      error: {
        code: this.code,
        message: MESSAGES[this.code].message,
        retry: this.retry,
      },
    }
  }
}

export function isWebhookError(error: unknown): error is WebhookError {
  return error instanceof WebhookError
}
