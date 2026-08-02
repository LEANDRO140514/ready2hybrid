import { useEffect } from 'react'

import { useShellStore } from '../stores/shell-store'
import type { ConnectivityState } from './types'

export type ConnectivityListener = (state: ConnectivityState) => void

const listeners = new Set<ConnectivityListener>()

export function subscribeConnectivity(
  listener: ConnectivityListener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(state: ConnectivityState): void {
  for (const listener of listeners) listener(state)
}

export function readConnectivity(): ConnectivityState {
  if (typeof navigator === 'undefined') return 'online'
  return navigator.onLine ? 'online' : 'offline'
}

export function useConnectivitySync(): void {
  const setConnectivity = useShellStore((s) => s.setConnectivity)

  useEffect(() => {
    const apply = (next: ConnectivityState) => {
      setConnectivity(next)
      emit(next)
    }

    apply(readConnectivity())

    const onOnline = () => {
      apply('recovering')
      window.setTimeout(() => apply('online'), 150)
    }
    const onOffline = () => apply('offline')

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [setConnectivity])
}
