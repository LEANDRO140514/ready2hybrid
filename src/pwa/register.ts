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
    onRegisteredSW(_swUrl, registration) {
      setRegistration('active')
      setShell('available')
      void registration?.update()
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

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!navigator.serviceWorker.controller) return
    let reloaded = false
    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return {
    needRefresh,
    applyUpdate: () => {
      setUpdate('activating')
      void updateServiceWorker(true)
      setNeedRefresh(false)
    },
  }
}
