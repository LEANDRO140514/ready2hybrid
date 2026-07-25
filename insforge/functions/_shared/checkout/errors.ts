export type PublicErrorCode =
  | 'INVALID_REQUEST'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_AVAILABLE'
  | 'SALES_NOT_OPEN'
  | 'SALES_CLOSED'
  | 'SOLD_OUT'
  | 'PRICE_CHANGED'
  | 'WAIVER_REQUIRED'
  | 'CONFIGURATION_ERROR'
  | 'CHECKOUT_CREATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export type PublicErrorBody = {
  error: {
    code: PublicErrorCode
    message: string
    retry?: 'NO' | 'AFTER_STATE_CHANGE' | 'OPTIONAL'
  }
}

const MESSAGES: Record<PublicErrorCode, { message: string; retry: PublicErrorBody['error']['retry']; status: number }> = {
  INVALID_REQUEST: { message: 'Invalid checkout request.', retry: 'NO', status: 400 },
  PRODUCT_NOT_FOUND: { message: 'Product was not found.', retry: 'NO', status: 404 },
  PRODUCT_NOT_AVAILABLE: { message: 'Product is not available.', retry: 'AFTER_STATE_CHANGE', status: 409 },
  SALES_NOT_OPEN: { message: 'Sales have not opened.', retry: 'AFTER_STATE_CHANGE', status: 409 },
  SALES_CLOSED: { message: 'Sales are closed.', retry: 'NO', status: 409 },
  SOLD_OUT: { message: 'Product is sold out.', retry: 'AFTER_STATE_CHANGE', status: 409 },
  PRICE_CHANGED: { message: 'Product price changed.', retry: 'AFTER_STATE_CHANGE', status: 409 },
  WAIVER_REQUIRED: { message: 'Waiver acceptance is required.', retry: 'NO', status: 409 },
  CONFIGURATION_ERROR: { message: 'Checkout is not configured.', retry: 'NO', status: 503 },
  CHECKOUT_CREATION_FAILED: { message: 'Checkout could not be created.', retry: 'OPTIONAL', status: 502 },
  CONFLICT: { message: 'Request conflicts with an existing operation.', retry: 'AFTER_STATE_CHANGE', status: 409 },
  RATE_LIMITED: { message: 'Too many requests.', retry: 'OPTIONAL', status: 429 },
  INTERNAL_ERROR: { message: 'Unexpected checkout error.', retry: 'OPTIONAL', status: 500 },
}

export class CheckoutError extends Error {
  readonly code: PublicErrorCode
  readonly status: number
  readonly retry: PublicErrorBody['error']['retry']

  constructor(code: PublicErrorCode, detail?: string) {
    const meta = MESSAGES[code]
    super(detail ?? meta.message)
    this.code = code
    this.status = meta.status
    this.retry = meta.retry
  }

  toPublicBody(): PublicErrorBody {
    return {
      error: {
        code: this.code,
        message: MESSAGES[this.code].message,
        retry: this.retry,
      },
    }
  }
}

export function isCheckoutError(error: unknown): error is CheckoutError {
  return error instanceof CheckoutError
}
