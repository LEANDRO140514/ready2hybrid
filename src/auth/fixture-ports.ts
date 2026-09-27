/**
 * Test/e2e harness adapters ONLY.
 * Must never be imported from the production entry (`main.tsx`) or `ports.ts`.
 * Wired exclusively via `main.e2e.tsx` and unit tests that inject App ports.
 */
import { isOperationalRole } from './roles'
import type {
  AuthPort,
  AuthSession,
  AuthStepFailure,
  AuthorizationPort,
  OperationalAssignment,
  PublicSignupConfig,
} from './types'

const HARNESS_SIGNUP_CONFIG: PublicSignupConfig = {
  policy: {
    passwordMinLength: 6,
    requireNumber: false,
    requireLowercase: false,
    requireUppercase: false,
    requireSpecialChar: false,
  },
  signupOpen: true,
  verifyEmailMethod: 'code',
}

/** Satisfies AuthPort in tests that never open signup. */
export function closedAccountAuth(): Pick<
  AuthPort,
  'getSignupConfig' | 'signUp' | 'verifyEmail' | 'resendVerificationEmail'
> {
  const closed: AuthStepFailure = {
    ok: false,
    message: 'Alta no disponible en esta prueba.',
  }
  return {
    async getSignupConfig() {
      return closed
    },
    async signUp() {
      return closed
    },
    async verifyEmail() {
      return closed
    },
    async resendVerificationEmail() {
      return closed
    },
  }
}

export const FIXTURE_SESSION_KEY = 'r2h.e2e.session'
export const FIXTURE_ROLE_KEY = 'r2h.e2e.role'
export const FIXTURE_ASSIGNMENT_KEY = 'r2h.e2e.assignment'

function readFixtureSession(): AuthSession {
  try {
    const raw = localStorage.getItem(FIXTURE_SESSION_KEY)
    if (!raw) {
      return { status: 'unauthenticated', user: null, errorMessage: null }
    }
    const parsed = JSON.parse(raw) as { id?: string; email?: string | null }
    if (!parsed.id) {
      return { status: 'unauthenticated', user: null, errorMessage: null }
    }
    return {
      status: 'authenticated',
      user: { id: parsed.id, email: parsed.email ?? null },
      errorMessage: null,
    }
  } catch {
    return {
      status: 'error',
      user: null,
      errorMessage: 'Invalid fixture session payload',
    }
  }
}

export function createFixtureAuthPort(): AuthPort {
  return {
    async getSession() {
      return readFixtureSession()
    },
    async signInWithPassword(email) {
      localStorage.setItem(
        FIXTURE_SESSION_KEY,
        JSON.stringify({ id: `fixture:${email}`, email }),
      )
      return { ok: true }
    },
    async signOut() {
      localStorage.removeItem(FIXTURE_SESSION_KEY)
      localStorage.removeItem(FIXTURE_ROLE_KEY)
      localStorage.removeItem(FIXTURE_ASSIGNMENT_KEY)
    },
    async getSignupConfig() {
      return { ok: true, config: HARNESS_SIGNUP_CONFIG }
    },
    async signUp() {
      return { ok: true, needsVerification: true }
    },
    async verifyEmail(_email, code) {
      if (code === '000000') {
        return { ok: false, message: 'El código no es válido o expiró.' }
      }
      return { ok: true }
    },
    async resendVerificationEmail() {
      return { ok: true }
    },
  }
}

export function createFixtureAuthorizationPort(): AuthorizationPort {
  return {
    async resolveRole() {
      const raw = localStorage.getItem(FIXTURE_ROLE_KEY)
      return isOperationalRole(raw) ? raw : null
    },
    async resolveAssignment() {
      const raw = localStorage.getItem(FIXTURE_ASSIGNMENT_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as OperationalAssignment
      } catch {
        return null
      }
    },
  }
}
