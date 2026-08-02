export type ConnectivityState = 'online' | 'offline' | 'recovering'

export type AppUpdateState =
  | 'none'
  | 'available'
  | 'activating'
  | 'failed'
  | 'unsupported'

export type PwaRegistrationState =
  | 'unsupported'
  | 'failed'
  | 'active'
  | 'pending'

export type ShellAvailability =
  | 'unavailable'
  | 'available'
  | 'incompatible'
