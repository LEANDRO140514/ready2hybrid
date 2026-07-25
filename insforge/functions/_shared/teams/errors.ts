export type TeamRosterErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_TOKEN'
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_INACTIVE'
  | 'PAYMENT_REQUIRED'
  | 'WAIVER_REQUIRED'
  | 'WAIVER_CONFIGURATION_REQUIRED'
  | 'ROSTER_FULL'
  | 'DUPLICATE_PARTICIPANT'
  | 'CONFLICT'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFIGURATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

const STATUS: Record<TeamRosterErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_TOKEN: 400,
  INVITATION_NOT_FOUND: 404,
  INVITATION_INACTIVE: 409,
  PAYMENT_REQUIRED: 409,
  WAIVER_REQUIRED: 400,
  WAIVER_CONFIGURATION_REQUIRED: 503,
  ROSTER_FULL: 409,
  DUPLICATE_PARTICIPANT: 409,
  CONFLICT: 409,
  METHOD_NOT_ALLOWED: 405,
  CONFIGURATION_ERROR: 503,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}

export class TeamRosterError extends Error {
  readonly code: TeamRosterErrorCode
  readonly status: number

  constructor(code: TeamRosterErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'TeamRosterError'
    this.code = code
    this.status = STATUS[code]
  }

  toPublicBody(): { error: TeamRosterErrorCode } {
    return { error: this.code }
  }
}

export function isTeamRosterError(error: unknown): error is TeamRosterError {
  return error instanceof TeamRosterError
}

export function mapRpcError(code: string | undefined): TeamRosterError {
  switch (code) {
    case 'INVALID_REQUEST':
    case 'INVALID_TOKEN':
    case 'INVITATION_NOT_FOUND':
    case 'INVITATION_INACTIVE':
    case 'PAYMENT_REQUIRED':
    case 'WAIVER_REQUIRED':
    case 'WAIVER_CONFIGURATION_REQUIRED':
    case 'ROSTER_FULL':
    case 'DUPLICATE_PARTICIPANT':
    case 'CONFLICT':
    case 'CONFIGURATION_ERROR':
      return new TeamRosterError(code)
    default:
      return new TeamRosterError('INTERNAL_ERROR')
  }
}
