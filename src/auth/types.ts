export const OPERATIONAL_ROLES = [
  'OWNER',
  'OPERATIONS_MANAGER',
  'CHECKIN_STAFF',
  'SOLUTION_DESK',
  'FINANCE',
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

/** Password rules published by InsForge public auth config. */
export type PasswordPolicy = {
  passwordMinLength: number
  requireNumber: boolean
  requireLowercase: boolean
  requireUppercase: boolean
  requireSpecialChar: boolean
}

export type AuthStepFailure = {
  ok: false
  message: string
  cooldown?: boolean
}

export type PublicSignupConfig = {
  policy: PasswordPolicy
  signupOpen: boolean
  verifyEmailMethod: 'code' | 'link'
}

export type AuthPort = {
  getSession: () => Promise<AuthSession>
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  signOut: () => Promise<void>
  getSignupConfig: () => Promise<
    { ok: true; config: PublicSignupConfig } | AuthStepFailure
  >
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; needsVerification: boolean } | AuthStepFailure>
  verifyEmail: (
    email: string,
    code: string,
  ) => Promise<{ ok: true } | AuthStepFailure>
  resendVerificationEmail: (
    email: string,
  ) => Promise<{ ok: true } | AuthStepFailure>
}

export type AuthorizationPort = {
  resolveRole: (userId: string) => Promise<OperationalRole | null>
  resolveAssignment: (
    userId: string,
  ) => Promise<OperationalAssignment | null>
}
