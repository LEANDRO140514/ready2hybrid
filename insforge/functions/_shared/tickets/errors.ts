export type TicketCredentialErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_TOKEN'
  | 'TICKET_NOT_FOUND'
  | 'CREDENTIAL_NOT_FOUND'
  | 'TICKET_REVOKED'
  | 'NO_ACTIVE_CREDENTIAL'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFIGURATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'PUBLIC_TICKET_RETRIEVAL_DEFERRED'

const STATUS: Record<TicketCredentialErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_TOKEN: 400,
  TICKET_NOT_FOUND: 404,
  CREDENTIAL_NOT_FOUND: 404,
  TICKET_REVOKED: 409,
  NO_ACTIVE_CREDENTIAL: 409,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  METHOD_NOT_ALLOWED: 405,
  CONFIGURATION_ERROR: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  PUBLIC_TICKET_RETRIEVAL_DEFERRED: 403,
}

export class TicketCredentialError extends Error {
  readonly code: TicketCredentialErrorCode
  readonly status: number

  constructor(code: TicketCredentialErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'TicketCredentialError'
    this.code = code
    this.status = STATUS[code]
  }

  toPublicBody(): { error: TicketCredentialErrorCode } {
    return { error: this.code }
  }
}

export function mapRpcError(code: string | undefined): TicketCredentialError {
  switch (code) {
    case 'INVALID_REQUEST':
    case 'INVALID_TOKEN':
    case 'TICKET_NOT_FOUND':
    case 'CREDENTIAL_NOT_FOUND':
    case 'TICKET_REVOKED':
    case 'NO_ACTIVE_CREDENTIAL':
    case 'CONFLICT':
    case 'CONFIGURATION_ERROR':
      return new TicketCredentialError(code)
    default:
      return new TicketCredentialError('INTERNAL_ERROR')
  }
}
