import { useAuth } from '../../auth/AuthContext'
import { usePwaRegistration } from '../../pwa/register'
import { useShellStore } from '../../stores/shell-store'

export function StatusBanners() {
  const connectivity = useShellStore((s) => s.connectivity)
  const update = useShellStore((s) => s.update)
  const registration = useShellStore((s) => s.registration)
  const { needRefresh, applyUpdate } = usePwaRegistration()
  const { session } = useAuth()

  return (
    <div className="status-banners" aria-live="polite">
      {connectivity === 'offline' ? (
        <p className="banner banner-offline" data-testid="connectivity-offline">
          Sin conexión. El shell de la aplicación puede seguir disponible. Esto
          no significa que la operación de entrada esté lista.
        </p>
      ) : null}
      {connectivity === 'recovering' ? (
        <p className="banner" data-testid="connectivity-recovering">
          Recuperando conexión…
        </p>
      ) : null}
      {registration === 'failed' ? (
        <p className="banner banner-warn" data-testid="sw-failed">
          No se pudo registrar el service worker. Puedes seguir usando la app
          con red.
        </p>
      ) : null}
      {needRefresh || update === 'available' ? (
        <p className="banner banner-update" data-testid="update-available">
          Hay una actualización disponible.{' '}
          <button type="button" onClick={applyUpdate}>
            Actualizar cuando sea seguro
          </button>
        </p>
      ) : null}
      {session.status === 'authenticated' ? (
        <p className="banner banner-muted" data-testid="session-user">
          Sesión activa
          {session.user?.email ? `: ${session.user.email}` : ''}
        </p>
      ) : null}
    </div>
  )
}
