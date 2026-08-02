import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent, type ReactNode } from 'react'

import { useAuth } from '../auth/AuthContext'
import { evaluateOperationalAccess } from '../auth/guards'
import type { ProtectedOpsPath } from '../auth/roles'
import { useShellStore } from '../stores/shell-store'

export function HomePage() {
  const connectivity = useShellStore((s) => s.connectivity)
  const buildId = import.meta.env.VITE_SHELL_BUILD_ID ?? 'dev'
  return (
    <section>
      <h1>Ready2Hybrid</h1>
      <p data-testid="home-copy">
        Shell operativo y fundación PWA. La operación de entrada (manifiesto y
        check-in) todavía no está habilitada en esta unidad.
      </p>
      <p data-testid="shell-connectivity">
        Conectividad: {connectivity}
      </p>
      <p className="muted" data-testid="not-ready-operate">
        No listo para operar sin manifiesto.
      </p>
      <p className="muted" data-testid="shell-build-id">
        build:{buildId}
      </p>
    </section>
  )
}

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (session.status === 'authenticated') {
    return <Navigate to="/" />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await signIn(email, password)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    void navigate({ to: '/' })
  }

  return (
    <section>
      <h1>Iniciar sesión</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="login-form">
        <label>
          Correo
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>
          Entrar
        </button>
      </form>
    </section>
  )
}

export function UnauthorizedPage() {
  return (
    <section data-testid="unauthorized">
      <h1>Acceso denegado</h1>
      <p>
        No hay sesión válida, rol comprobable o asignación vigente para esta
        ruta operativa.
      </p>
      <p>
        <Link to="/login">Ir a iniciar sesión</Link>
      </p>
    </section>
  )
}

function OpsGuard({
  path,
  title,
  children,
}: {
  path: ProtectedOpsPath
  title: string
  children: ReactNode
}) {
  const {
    session,
    role,
    roleResolved,
    assignment,
    assignmentResolved,
  } = useAuth()

  if (session.status === 'loading' || !roleResolved || !assignmentResolved) {
    return <p data-testid="ops-loading">Cargando autorización…</p>
  }

  if (session.status !== 'authenticated') {
    return <Navigate to="/login" />
  }

  const decision = evaluateOperationalAccess({
    session,
    role,
    roleResolved,
    assignment,
    assignmentResolved,
    path,
  })

  if (decision.outcome === 'deny') {
    return <Navigate to="/unauthorized" />
  }

  return (
    <section data-testid={`ops-allowed-${path}`}>
      <h1>{title}</h1>
      {children}
    </section>
  )
}

export function CheckinShellPage() {
  return (
    <OpsGuard path="/ops/checkin" title="Check-in">
      <p data-testid="checkin-shell">
        Pantalla primaria de CHECKIN_STAFF (shell). El manifiesto, el escáner
        QR y el check-in todavía no están habilitados.
      </p>
      <p className="muted" data-testid="not-ready-operate">
        No listo para operar sin manifiesto.
      </p>
    </OpsGuard>
  )
}

export function DeskShellPage() {
  return (
    <OpsGuard path="/ops/desk" title="Mesa de soluciones">
      <p data-testid="desk-shell">
        Shell de mesa de soluciones. Las acciones protegidas no están parte de
        T2-1B.
      </p>
    </OpsGuard>
  )
}
