import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { useShellStore } from '../stores/shell-store'

/** Hook wiring vite-plugin-pwa update prompt without forcing mid-operation. */
export function usePwaRegistration(): {
  needRefresh: boolean
  applyUpdate: () => void
} {
  const setRegistration = useShellStore((s) => s.setRegistration)
  const setUpdate = useShellStore((s) => s.setUpdate)
  const setShell = useShellStore((s) => s.setShell)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW() {
      setRegistration('active')
      setShell('available')
    },
    onRegisterError() {
      setRegistration('failed')
      setUpdate('failed')
      // Online SPA must remain usable when SW registration fails.
      setShell('available')
    },
  })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setRegistration('unsupported')
      setUpdate('unsupported')
    }
  }, [setRegistration, setUpdate])

  useEffect(() => {
    if (needRefresh) setUpdate('available')
  }, [needRefresh, setUpdate])

  return {
    needRefresh,
    applyUpdate: () => {
      setUpdate('activating')
      void updateServiceWorker(true)
      setNeedRefresh(false)
    },
  }
}
