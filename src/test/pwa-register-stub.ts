export function useRegisterSW(_options?: {
  onRegisteredSW?: () => void
  onRegisterError?: () => void
}) {
  return {
    needRefresh: [false, () => undefined] as [
      boolean,
      (value: boolean) => void,
    ],
    offlineReady: [false, () => undefined] as [
      boolean,
      (value: boolean) => void,
    ],
    updateServiceWorker: async () => undefined,
  }
}
