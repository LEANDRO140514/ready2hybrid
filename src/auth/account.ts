import type { AuthStepFailure, PasswordPolicy } from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAccountEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function explainPasswordPolicy(policy: PasswordPolicy): string {
  const rules = [`mínimo ${policy.passwordMinLength} caracteres`]
  if (policy.requireLowercase) rules.push('una minúscula')
  if (policy.requireUppercase) rules.push('una mayúscula')
  if (policy.requireNumber) rules.push('un número')
  if (policy.requireSpecialChar) rules.push('un carácter especial')
  return `La contraseña debe tener ${rules.join(', ')}.`
}

export function validateSignupInput(
  input: { email: string; password: string; confirmPassword: string },
  policy: PasswordPolicy,
): { ok: true; email: string } | AuthStepFailure {
  const email = normalizeAccountEmail(input.email)
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, message: 'Escribe un correo válido.' }
  }
  if (!passwordMeetsPolicy(input.password, policy)) {
    return { ok: false, message: explainPasswordPolicy(policy) }
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, message: 'La confirmación no coincide con la contraseña.' }
  }
  return { ok: true, email }
}

export function validateVerificationCode(code: string): { ok: true; code: string } | AuthStepFailure {
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, message: 'El código debe tener 6 dígitos.' }
  }
  return { ok: true, code: trimmed }
}

function passwordMeetsPolicy(password: string, policy: PasswordPolicy): boolean {
  if (password.length < policy.passwordMinLength) return false
  if (policy.requireNumber && !/\d/.test(password)) return false
  if (policy.requireLowercase && !/[a-z]/.test(password)) return false
  if (policy.requireUppercase && !/[A-Z]/.test(password)) return false
  if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) return false
  return true
}

type AuthErrorLike = {
  message?: string
  statusCode?: number
}

export function signupErrorMessage(error: AuthErrorLike | null): string {
  const message = (error?.message ?? '').toLowerCase()
  if (
    message.includes('already') ||
    message.includes('exist') ||
    message.includes('registered') ||
    message.includes('duplicate')
  ) {
    return 'Ese correo ya tiene una cuenta. Inicia sesión o verifica el código.'
  }
  if (message.includes('disabled') && message.includes('signup')) {
    return 'El registro de cuentas está cerrado.'
  }
  if (message.includes('invalid') && message.includes('email')) {
    return 'Escribe un correo válido.'
  }
  if (message.includes('password')) {
    return 'La contraseña no cumple los requisitos de la cuenta.'
  }
  return 'No se pudo crear la cuenta. Inténtalo de nuevo.'
}

export function verificationErrorMessage(error: AuthErrorLike | null): AuthStepFailure {
  if (error?.statusCode === 429) {
    return {
      ok: false,
      cooldown: true,
      message: 'Espera un momento antes de pedir otro código.',
    }
  }
  return { ok: false, message: 'El código no es válido o expiró.' }
}

export function resendErrorMessage(error: AuthErrorLike | null): AuthStepFailure {
  if (error?.statusCode === 429) {
    return {
      ok: false,
      cooldown: true,
      message: 'Espera un momento antes de pedir otro código.',
    }
  }
  const message = (error?.message ?? '').toLowerCase()
  if (
    message.includes('wait') ||
    message.includes('interval') ||
    message.includes('too many') ||
    message.includes('rate')
  ) {
    return {
      ok: false,
      cooldown: true,
      message: 'Espera un momento antes de pedir otro código.',
    }
  }
  return { ok: false, message: 'No se pudo reenviar el código.' }
}
