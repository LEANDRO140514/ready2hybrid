export type OrderStatusErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_REFERENCE'
  | 'ORDER_NOT_FOUND'
  | 'ORIGIN_NOT_ALLOWED'
  | 'CONFIGURATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export type OrderStatusErrorBody = {
  error: {
    code: OrderStatusErrorCode
    message: string
    retry?: 'NO' | 'OPTIONAL'
  }
}

const MESSAGES: Record<
  OrderStatusErrorCode,
  { message: string; retry: OrderStatusErrorBody['error']['retry']; status: number }
> = {
  METHOD_NOT_ALLOWED: { message: 'Method not allowed.', retry: 'NO', status: 405 },
  INVALID_REFERENCE: { message: 'Order reference is invalid.', retry: 'NO', status: 400 },
  ORDER_NOT_FOUND: { message: 'Order was not found.', retry: 'OPTIONAL', status: 404 },
  ORIGIN_NOT_ALLOWED: { message: 'Request origin is not allowed.', retry: 'NO', status: 403 },
  CONFIGURATION_ERROR: { message: 'Order status is not configured.', retry: 'NO', status: 503 },
  SERVICE_UNAVAILABLE: { message: 'Order status temporarily unavailable.', retry: 'OPTIONAL', status: 503 },
  INTERNAL_ERROR: { message: 'Unexpected order status error.', retry: 'OPTIONAL', status: 500 },
}

export class OrderStatusError extends Error {
  readonly code: OrderStatusErrorCode
  readonly status: number
  readonly retry: OrderStatusErrorBody['error']['retry']

  constructor(code: OrderStatusErrorCode, detail?: string) {
    const meta = MESSAGES[code]
    super(detail ?? meta.message)
    this.code = code
    this.status = meta.status
    this.retry = meta.retry
  }

  toPublicBody(): OrderStatusErrorBody {
    return {
      error: {
        code: this.code,
        message: MESSAGES[this.code].message,
        retry: this.retry,
      },
    }
  }
}
