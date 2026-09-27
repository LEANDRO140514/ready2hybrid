import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'

import {
  explainPasswordPolicy,
  normalizeAccountEmail,
  validateSignupInput,
  validateVerificationCode,
} from '../auth/account'
import { useAuth } from '../auth/AuthContext'
import type { PublicSignupConfig } from '../auth/types'

export function SignupPage() {
  const { session, getSignupConfig, signUp } = useAuth()
  const navigate = useNavigate()
  const [config, setConfig] = useState<PublicSignupConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getSignupConfig().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setConfigError(result.message)
        return
      }
      setConfig(result.config)
    })
    return () => {
      cancelled = true
    }
  }, [getSignupConfig])

  if (session.status === 'authenticated') {
    return <Navigate to="/" />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!config) return
    const parsed = validateSignupInput({ email, password, confirmPassword }, config.policy)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setPending(true)
    setError(null)
    const result = await signUp(parsed.email, password)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPassword('')
    setConfirmPassword('')
    if (result.needsVerification) {
      void navigate({ to: '/verify-email', search: { email: parsed.email } })
      return
    }
    void navigate({ to: '/login', search: { verified: '1' } })
  }

  return (
    <section className="auth-card">
      <h1>Crear cuenta</h1>
      <p className="muted">
        Elige tu contraseña. Esta pantalla no asigna un rol operativo.
      </p>
      {configError ? <p role="alert">{configError}</p> : null}
      {config && !config.signupOpen ? (
        <p role="alert">El registro de cuentas está cerrado.</p>
      ) : null}
      {config?.signupOpen ? (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="login-form">
          <label>
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <p className="muted">{explainPasswordPolicy(config.policy)}</p>
          <label>
            Confirmar contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p role="alert" data-testid="signup-error">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending}>
            Crear cuenta
          </button>
        </form>
      ) : null}
      <p className="muted">
        <Link to="/login">Ya tengo cuenta</Link>
      </p>
    </section>
  )
}

export function VerifyEmailPage() {
  const { session, verifyEmail, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/verify-email' })
  const email = normalizeAccountEmail(search.email)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resendBlocked, setResendBlocked] = useState(false)

  if (session.status === 'authenticated') {
    return <Navigate to="/" />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = validateVerificationCode(code)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setPending(true)
    setError(null)
    const result = await verifyEmail(email, parsed.code)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    void navigate({ to: '/login', search: { verified: '1' } })
  }

  async function onResend() {
    setPending(true)
    setError(null)
    setNotice(null)
    const result = await resendVerificationEmail(email)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      if (result.cooldown) setResendBlocked(true)
      return
    }
    setNotice('Enviamos otro código.')
  }

  return (
    <section className="auth-card">
      <h1>Verifica tu correo</h1>
      {email ? (
        <p data-testid="verify-sent">Enviamos un código de 6 dígitos a {email}</p>
      ) : (
        <p role="alert">Falta el correo. Vuelve a crear la cuenta.</p>
      )}
      {email ? (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="login-form">
          <label>
            Código de verificación
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p role="alert" data-testid="verify-error">
              {error}
            </p>
          ) : null}
          {notice ? <p className="muted">{notice}</p> : null}
          <button type="submit" disabled={pending}>
            Verificar
          </button>
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={pending || resendBlocked}
          >
            Reenviar código
          </button>
        </form>
      ) : (
        <p>
          <Link to="/signup">Crear cuenta</Link>
        </p>
      )}
    </section>
  )
}
