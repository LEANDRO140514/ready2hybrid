import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { useAuth } from '../../auth/AuthContext'
import { roleAllowsPath, type ProtectedOpsPath } from '../../auth/roles'
import { useConnectivitySync } from '../../pwa/connectivity'
import { StatusBanners } from './StatusBanners'

const OPS_LINKS: { path: ProtectedOpsPath; label: string }[] = [
  { path: '/ops/checkin', label: 'Check-in' },
  { path: '/ops/desk', label: 'Mesa' },
  { path: '/ops/finance', label: 'Ventas' },
  { path: '/ops/partners', label: 'Community Partners' },
]

export function OperationalLayout() {
  useConnectivitySync()
  const { session, role, roleResolved, signOut } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const bare = pathname === '/login'

  return (
    <div
      className="app-shell"
      data-build-id={import.meta.env.VITE_SHELL_BUILD_ID ?? 'dev'}
    >
      {bare ? null : (
      <header className="app-header">
        <div>
          <p className="brand">ENFORMA</p>
          <p className="tagline">HYBRID EVENT EXPERIENCE 2026</p>
        </div>
        <nav aria-label="Principal">
          <Link to="/">Inicio</Link>
          {OPS_LINKS.map((item) =>
            roleResolved && roleAllowsPath(role, item.path) ? (
              <Link key={item.path} to={item.path}>
                {item.label}
              </Link>
            ) : null,
          )}
          {session.status === 'authenticated' ? (
            <button type="button" onClick={() => void signOut()}>
              Cerrar sesión
            </button>
          ) : (
            <Link to="/login">Iniciar sesión</Link>
          )}
        </nav>
      </header>
      )}
      <StatusBanners updateOnly={bare} />
      <main className={bare ? 'bare-main' : undefined}>
        <Outlet />
      </main>
    </div>
  )
}
