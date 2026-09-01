export type SendTicketEmailErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'METHOD_NOT_ALLOWED'
  | 'ORDER_NOT_FOUND'
  | 'BUYER_EMAIL_MISSING'
  | 'EMAIL_NOT_CONFIGURED'
  | 'EMAIL_SEND_FAILED'
  | 'CONFIGURATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

const STATUS: Record<SendTicketEmailErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  ORDER_NOT_FOUND: 404,
  BUYER_EMAIL_MISSING: 422,
  EMAIL_NOT_CONFIGURED: 503,
  EMAIL_SEND_FAILED: 502,
  CONFIGURATION_ERROR: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}

export class SendTicketEmailError extends Error {
  readonly code: SendTicketEmailErrorCode
  readonly status: number

  constructor(code: SendTicketEmailErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SendTicketEmailError'
    this.code = code
    this.status = STATUS[code]
  }

  toPublicBody(): { error: SendTicketEmailErrorCode } {
    return { error: this.code }
  }
}
