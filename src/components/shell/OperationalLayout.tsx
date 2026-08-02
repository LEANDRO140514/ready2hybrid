import { Link, Outlet } from '@tanstack/react-router'

import { useAuth } from '../../auth/AuthContext'
import { useConnectivitySync } from '../../pwa/connectivity'
import { StatusBanners } from './StatusBanners'

export function OperationalLayout() {
  useConnectivitySync()
  const { session, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="brand">Ready2Hybrid</p>
          <p className="tagline">Shell operativo</p>
        </div>
        <nav aria-label="Principal">
          <Link to="/">Inicio</Link>
          <Link to="/ops/checkin">Check-in</Link>
          <Link to="/ops/desk">Mesa</Link>
          {session.status === 'authenticated' ? (
            <button type="button" onClick={() => void signOut()}>
              Cerrar sesión
            </button>
          ) : (
            <Link to="/login">Iniciar sesión</Link>
          )}
        </nav>
      </header>
      <StatusBanners />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
