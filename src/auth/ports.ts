import {
  resendErrorMessage,
  signupErrorMessage,
  verificationErrorMessage,
} from './account'
import { getInsforgeClient, getPublicInsforgeEnv } from '../lib/insforge/client'
import { postProjectFunction } from '../lib/insforge/project-function'
import type {
  AuthPort,
  AuthorizationPort,
  OperationalAssignment,
  OperationalRole,
  PasswordPolicy,
  PublicSignupConfig,
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
    async getSignupConfig() {
      try {
        const { data, error } = await getInsforgeClient().auth.getPublicAuthConfig()
        if (error || !data) {
          return {
            ok: false,
            message: 'No se pudieron leer los requisitos de la cuenta.',
          }
        }
        const policy = passwordPolicyFromConfig(data)
        if (!policy) {
          return {
            ok: false,
            message: 'No se pudieron leer los requisitos de la cuenta.',
          }
        }
        const config: PublicSignupConfig = {
          policy,
          signupOpen: data.disableSignup !== true,
          verifyEmailMethod: data.verifyEmailMethod === 'link' ? 'link' : 'code',
        }
        return { ok: true, config }
      } catch {
        return {
          ok: false,
          message: 'No se pudieron leer los requisitos de la cuenta.',
        }
      }
    },
    async signUp(email, password) {
      try {
        const { data, error } = await getInsforgeClient().auth.signUp({
          email,
          password,
        })
        if (error) return { ok: false, message: signupErrorMessage(error) }
        const needsVerification =
          data?.requireEmailVerification === true || data?.user?.emailVerified === false
        if (needsVerification) {
          await getInsforgeClient().auth.signOut()
        }
        return { ok: true, needsVerification }
      } catch {
        return { ok: false, message: 'No se pudo crear la cuenta. Inténtalo de nuevo.' }
      }
    },
    async verifyEmail(email, code) {
      try {
        const { data, error } = await getInsforgeClient().auth.verifyEmail({
          email,
          otp: code,
        })
        if (error || !data) return verificationErrorMessage(error)
        await getInsforgeClient().auth.signOut()
        return { ok: true }
      } catch {
        return { ok: false, message: 'El código no es válido o expiró.' }
      }
    },
    async resendVerificationEmail(email) {
      try {
        const { error } = await getInsforgeClient().auth.resendVerificationEmail({
          email,
        })
        if (error) return resendErrorMessage(error)
        return { ok: true }
      } catch {
        return { ok: false, message: 'No se pudo reenviar el código.' }
      }
    },
  }
}

function passwordPolicyFromConfig(data: {
  passwordMinLength: number
  requireNumber: boolean
  requireLowercase: boolean
  requireUppercase: boolean
  requireSpecialChar: boolean
}): PasswordPolicy | null {
  if (!Number.isInteger(data.passwordMinLength) || data.passwordMinLength < 1) {
    return null
  }
  return {
    passwordMinLength: data.passwordMinLength,
    requireNumber: data.requireNumber,
    requireLowercase: data.requireLowercase,
    requireUppercase: data.requireUppercase,
    requireSpecialChar: data.requireSpecialChar,
  }
}

/**
 * T2-1 default: roles/assignments unresolved until T2-2 supplies canonical authz.
 * Never reads localStorage or fixture env.
 */
export function createDefaultAuthorizationPort(): AuthorizationPort {
  return {
    async resolveRole(userId: string): Promise<OperationalRole | null> {
      try {
        const data = await postProjectFunction<unknown>(
          getInsforgeClient(),
          'ops-sales-read',
          { view: 'whoami' },
        )
        if (!data || typeof data !== 'object') return null
        const body = data as { role?: unknown; userId?: unknown }
        if (body.userId !== userId) return null
        if (body.role === 'OWNER' || body.role === 'FINANCE') return body.role
        return null
      } catch {
        return null
      }
    },
    async resolveAssignment(): Promise<OperationalAssignment | null> {
      return null
    },
  }
}

export function createAuthPort(): AuthPort {
  return createInsforgeAuthPort()
}
