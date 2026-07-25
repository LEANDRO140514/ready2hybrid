import { OrderStatusError } from './errors'

export type OrderStatusRuntimeConfig = {
  pollSeconds: number
  corsOrigin: string | null
}

export function loadOrderStatusRuntimeConfig(
  env: (key: string) => string | undefined,
): OrderStatusRuntimeConfig {
  const raw = env('ORDER_STATUS_POLL_SECONDS')?.trim()
  let pollSeconds = 3
  if (raw) {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      throw new OrderStatusError('CONFIGURATION_ERROR')
    }
    pollSeconds = n
  }

  const corsOrigin =
    env('ORDER_STATUS_CORS_ORIGIN')?.trim() || env('CHECKOUT_CORS_ORIGIN')?.trim() || null

  return { pollSeconds, corsOrigin }
}
