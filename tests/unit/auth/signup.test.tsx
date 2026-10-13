import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../../../src/App'
import { validateSignupInput } from '../../../src/auth/account'
import { closedAccountAuth } from '../../../src/auth/fixture-ports'
import type { AuthPort, AuthorizationPort, PublicSignupConfig } from '../../../src/auth/types'

const openConfig: PublicSignupConfig = {
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

const noRole: AuthorizationPort = {
  async resolveRole() {
    return null
  },
  async resolveAssignment() {
    return null
  },
}

function accountPort(overrides: Partial<AuthPort> = {}): AuthPort {
  return {
    ...closedAccountAuth(),
    async getSession() {
      return { status: 'unauthenticated', user: null, errorMessage: null }
    },
    async signInWithPassword() {
      return { ok: true }
    },
    async signOut() {},
    async getSignupConfig() {
      return { ok: true, config: openConfig }
    },
    async signUp() {
      return { ok: true, needsVerification: true }
    },
    async verifyEmail() {
      return { ok: true }
    },
    async resendVerificationEmail() {
      return { ok: true }
    },
    ...overrides,
  }
}

function fillSignup(email: string, password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
    target: { value: confirm },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('account signup', () => {
  it('uses the published password policy instead of a fixed rule', () => {
    const strict = validateSignupInput(
      { email: 'persona@example.com', password: 'claveab', confirmPassword: 'claveab' },
      { ...openConfig.policy, requireNumber: true },
    )
    expect(strict.ok).toBe(false)
    if (!strict.ok) expect(strict.message).toContain('un número')
  })

  it('sends a valid signup to verification and ignores a role query', async () => {
    const signUp = vi.fn<AuthPort['signUp']>(async () => ({
      ok: true,
      needsVerification: true,
    }))
    render(
      <App
        initialPath="/signup?role=OWNER"
        authPort={accountPort({ signUp })}
        authorizationPort={noRole}
      />,
    )

    expect(await screen.findByLabelText('Correo')).toBeTruthy()
    expect(screen.queryByLabelText(/rol/i)).toBeNull()
    expect(screen.queryByText('OWNER')).toBeNull()
    fillSignup('Persona@Example.com', 'clave12')

    expect(await screen.findByRole('heading', { name: 'Verifica tu correo' })).toBeTruthy()
    expect(screen.getByTestId('verify-sent').textContent).toContain(
      'Enviamos un código de 6 dígitos a persona@example.com',
    )
    expect(signUp).toHaveBeenCalledTimes(1)
    expect(signUp.mock.calls[0]).toEqual(['persona@example.com', 'clave12'])
  })

  it('rejects a password confirmation that does not match', async () => {
    const signUp = vi.fn<AuthPort['signUp']>()
    render(
      <App initialPath="/signup" authPort={accountPort({ signUp })} authorizationPort={noRole} />,
    )
    expect(await screen.findByLabelText('Correo')).toBeTruthy()
    fillSignup('persona@example.com', 'clave12', 'clave13')
    expect((await screen.findByTestId('signup-error')).textContent).toContain(
      'La confirmación no coincide',
    )
    expect(signUp).not.toHaveBeenCalled()
  })

  it('rejects an invalid email before calling Auth', async () => {
    const signUp = vi.fn<AuthPort['signUp']>()
    render(
      <App initialPath="/signup" authPort={accountPort({ signUp })} authorizationPort={noRole} />,
    )
    expect(await screen.findByLabelText('Correo')).toBeTruthy()
    fillSignup('no-es-correo', 'clave12')
    expect((await screen.findByTestId('signup-error')).textContent).toContain(
      'Escribe un correo válido.',
    )
    expect(signUp).not.toHaveBeenCalled()
  })

  it('returns to login after a correct verification code', async () => {
    render(
      <App
        initialPath="/verify-email?email=persona@example.com"
        authPort={accountPort()}
        authorizationPort={noRole}
      />,
    )
    expect(await screen.findByLabelText('Código de verificación')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Código de verificación'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    expect((await screen.findByTestId('verified-notice')).textContent).toBe(
      'Cuenta verificada. Ya puedes iniciar sesión.',
    )
    expect(
      screen.getByRole('heading', {
        name: 'Control de ventas y conciliación financiera',
      }),
    ).toBeTruthy()
    expect(screen.queryByText(/shell|PWA|manifiesto|build:/i)).toBeNull()
  })

  it('shows a clear error for a rejected verification code', async () => {
    render(
      <App
        initialPath="/verify-email?email=persona@example.com"
        authPort={accountPort({
          async verifyEmail() {
            return { ok: false, message: 'El código no es válido o expiró.' }
          },
        })}
        authorizationPort={noRole}
      />,
    )
    expect(await screen.findByLabelText('Código de verificación')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Código de verificación'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    expect((await screen.findByTestId('verify-error')).textContent).toContain(
      'El código no es válido o expiró.',
    )
    expect(screen.queryByTestId('verified-notice')).toBeNull()
  })

  it('stops another resend when Auth reports a cooldown', async () => {
    render(
      <App
        initialPath="/verify-email?email=persona@example.com"
        authPort={accountPort({
          async resendVerificationEmail() {
            return {
              ok: false,
              cooldown: true,
              message: 'Espera un momento antes de pedir otro código.',
            }
          },
        })}
        authorizationPort={noRole}
      />,
    )
    const resend = await screen.findByRole('button', { name: 'Reenviar código' })
    fireEvent.click(resend)
    expect((await screen.findByTestId('verify-error')).textContent).toContain(
      'Espera un momento antes de pedir otro código.',
    )
    expect((screen.getByRole('button', { name: 'Reenviar código' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('keeps a verified user without a dashboard role on Inicio only', async () => {
    render(
      <App
        initialPath="/"
        authPort={accountPort({
          async getSession() {
            return {
              status: 'authenticated',
              user: { id: 'user-without-role', email: 'persona@example.com' },
              errorMessage: null,
            }
          },
        })}
        authorizationPort={noRole}
      />,
    )
    expect(await screen.findByRole('heading', { name: 'HYBRID EVENT EXPERIENCE 2026' })).toBeTruthy()
    expect(screen.getByTestId('session-role').textContent).toContain('sin rol operativo')
    expect(screen.queryByRole('link', { name: 'Ventas' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Check-in' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Mesa' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeTruthy()
  })
})
