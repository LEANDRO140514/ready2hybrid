import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { FinancePage } from '../components/finance/FinancePage'
import { PartnersPage } from '../components/partners/PartnersPage'
import { useAuth } from '../auth/AuthContext'
import { evaluateOperationalAccess } from '../auth/guards'
import { roleAllowsPath, routeRequiresAssignment, type ProtectedOpsPath } from '../auth/roles'
import { buildDashboard, EMPTY_FILTERS } from '../sales-dashboard/model'
import { useSalesPort } from '../sales-dashboard/port'

export function HomePage() {
  const { session, role, roleResolved } = useAuth()
  const port = useSalesPort()
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const canReadFinance = roleResolved && (role === 'OWNER' || role === 'FINANCE')

  useEffect(() => {
    if (!canReadFinance) return
    let cancelled = false
    port
      .loadSnapshot()
      .then((snapshot) => {
        if (cancelled) return
        const view = buildDashboard(snapshot.orders, EMPTY_FILTERS, new Date())
        setPendingCount(view.unreconciledCount)
      })
      .catch(() => {
        if (!cancelled) setPendingCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [canReadFinance, port])

  return (
    <section className="auth-card">
      <p className="brand">ENFORMA</p>
      <h1>HYBRID EVENT EXPERIENCE 2026</h1>
      <p data-testid="home-copy">Control de ventas y conciliación financiera.</p>
      {session.status === 'authenticated' && session.user?.email ? (
        <p className="muted" data-testid="home-identity">
          {session.user.email}
          {roleResolved && role ? ` · ${role}` : ''}
        </p>
      ) : null}
      {canReadFinance ? (
        <p>
          <Link className="cta" to="/ops/finance">Ir a ventas</Link>
        </p>
      ) : null}
      {canReadFinance && pendingCount != null && pendingCount > 0 ? (
        <p data-testid="home-reconcile">
          {pendingCount}{' '}
          {pendingCount === 1
            ? 'venta pendiente de conciliar'
            : 'ventas pendientes de conciliar'}{' '}
          <Link to="/ops/finance">Ir a conciliar</Link>
        </p>
      ) : null}
      {roleResolved && roleAllowsPath(role, '/ops/partners') ? (
        <p>
          <Link to="/ops/partners">Community Partners</Link>
        </p>
      ) : null}
      {roleResolved && roleAllowsPath(role, '/ops/checkin') ? (
        <p>
          <Link to="/ops/checkin">Check-in</Link>
        </p>
      ) : null}
      {roleResolved && roleAllowsPath(role, '/ops/desk') ? (
        <p>
          <Link to="/ops/desk">Mesa</Link>
        </p>
      ) : null}
    </section>
  )
}

export function LoginPage() {
  const { session, signIn, getSignupConfig } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getSignupConfig().then((result) => {
      if (!cancelled && result.ok) setSignupOpen(result.config.signupOpen)
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
    <section className="auth-card brand-accent">
      <p className="brand">ENFORMA</p>
      <p className="tagline">HYBRID EVENT EXPERIENCE 2026</p>
      <h1>Control de ventas y conciliación financiera</h1>
      {search.verified === '1' ? (
        <p data-testid="verified-notice">Cuenta verificada. Ya puedes iniciar sesión.</p>
      ) : null}
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
      {signupOpen ? (
        <p className="text-link">
          <Link to="/signup">Crear cuenta</Link>
        </p>
      ) : null}
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
    requireAssignment: routeRequiresAssignment(path),
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

export function FinanceShellPage() {
  return (
    <OpsGuard path="/ops/finance" title="Control de ventas y conciliación financiera">
      <FinancePage />
    </OpsGuard>
  )
}

export function PartnersShellPage() {
  return (
    <OpsGuard path="/ops/partners" title="Community Partners">
      <PartnersPage />
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
