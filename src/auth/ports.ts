import { getInsforgeClient, getPublicInsforgeEnv } from '../lib/insforge/client'
import type {
  AuthPort,
  AuthorizationPort,
  OperationalAssignment,
  OperationalRole,
} from './types'

/**
 * Production/default auth port — InsForge public anon client only.
 * Test harness adapters are never selected here.
 */
export function createInsforgeAuthPort(): AuthPort {
  return {
    async getSession() {
      const env = getPublicInsforgeEnv()
      if (!env.baseUrl || !env.anonKey) {
        return {
          status: 'error',
          user: null,
          errorMessage: 'InsForge public configuration is missing',
        }
      }
      try {
        const { data, error } = await getInsforgeClient().auth.getCurrentUser()
        if (error) {
          return {
            status: 'unauthenticated',
            user: null,
            errorMessage: null,
          }
        }
        const user = data?.user
        if (!user?.id) {
          return { status: 'unauthenticated', user: null, errorMessage: null }
        }
        return {
          status: 'authenticated',
          user: {
            id: String(user.id),
            email: typeof user.email === 'string' ? user.email : null,
          },
          errorMessage: null,
        }
      } catch {
        return {
          status: 'error',
          user: null,
          errorMessage: 'Session restore failed',
        }
      }
    },
    async signInWithPassword(email, password) {
      try {
        const { error } = await getInsforgeClient().auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          return {
            ok: false,
            message: error.message || 'Sign in failed',
          }
        }
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Sign in failed',
        }
      }
    },
    async signOut() {
      try {
        await getInsforgeClient().auth.signOut()
      } catch {
        // Logout is best-effort; local UI clears regardless.
      }
    },
  }
}

/**
 * T2-1 default: roles/assignments unresolved until T2-2 supplies canonical authz.
 * Never reads localStorage or fixture env.
 */
export function createDefaultAuthorizationPort(): AuthorizationPort {
  return {
    async resolveRole(): Promise<OperationalRole | null> {
      return null
    },
    async resolveAssignment(): Promise<OperationalAssignment | null> {
      return null
    },
  }
}

export function createAuthPort(): AuthPort {
  return createInsforgeAuthPort()
}
