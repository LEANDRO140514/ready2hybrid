import { create } from 'zustand'

import type {
  AppUpdateState,
  ConnectivityState,
  PwaRegistrationState,
  ShellAvailability,
} from '../pwa/types'

type ShellStore = {
  connectivity: ConnectivityState
  update: AppUpdateState
  registration: PwaRegistrationState
  shell: ShellAvailability
  setConnectivity: (value: ConnectivityState) => void
  setUpdate: (value: AppUpdateState) => void
  setRegistration: (value: PwaRegistrationState) => void
  setShell: (value: ShellAvailability) => void
}

export const useShellStore = create<ShellStore>((set) => ({
  connectivity: typeof navigator !== 'undefined' && navigator.onLine
    ? 'online'
    : 'offline',
  update: 'none',
  registration: 'pending',
  shell: 'available',
  setConnectivity: (connectivity) => set({ connectivity }),
  setUpdate: (update) => set({ update }),
  setRegistration: (registration) => set({ registration }),
  setShell: (shell) => set({ shell }),
}))
