export const OPERATIONAL_ROLES = [
  'OWNER',
  'OPERATIONS_MANAGER',
  'CHECKIN_STAFF',
  'SOLUTION_DESK',
] as const

export type OperationalRole = (typeof OPERATIONAL_ROLES)[number]

export type AuthUser = {
  id: string
  email: string | null
}

export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'

export type AuthSession = {
  status: SessionStatus
  user: AuthUser | null
  errorMessage: string | null
}

export type OperationalAssignment = {
  operatorId: string
  role: OperationalRole
  eventId: string
  eventDayId: string
  doorOrAreaId: string
  validFrom: string
  validTo: string
  sourceVersion: string
}

export type AuthorizationDecision =
  | { outcome: 'allow'; reason: 'authorized' }
  | {
      outcome: 'deny'
      reason:
        | 'no_session'
        | 'session_loading'
        | 'session_error'
        | 'role_unresolved'
        | 'role_denied'
        | 'assignment_unresolved'
        | 'assignment_expired'
        | 'assignment_mismatch'
    }

export type AuthPort = {
  getSession: () => Promise<AuthSession>
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  signOut: () => Promise<void>
}

export type AuthorizationPort = {
  resolveRole: (userId: string) => Promise<OperationalRole | null>
  resolveAssignment: (
    userId: string,
  ) => Promise<OperationalAssignment | null>
}
