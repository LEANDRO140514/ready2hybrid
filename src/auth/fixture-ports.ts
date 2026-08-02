/**
 * Test/e2e harness adapters ONLY.
 * Must never be imported from the production entry (`main.tsx`) or `ports.ts`.
 * Wired exclusively via `main.e2e.tsx` and unit tests that inject App ports.
 */
import { isOperationalRole } from './roles'
import type {
  AuthPort,
  AuthSession,
  AuthorizationPort,
  OperationalAssignment,
} from './types'

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
