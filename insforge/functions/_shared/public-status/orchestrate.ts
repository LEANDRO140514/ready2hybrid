import { loadOrderStatusRuntimeConfig } from './config'
import { OrderStatusError } from './errors'
import { projectPublicOrderStatus } from './mapping'
import { parsePublicOrderReference } from './validate'

export type OrderStatusRepository = {
  getOrderStateByTrackingRef: (trackingRef: string) => Promise<string | null>
}

export type OrchestrateDeps = {
  env: (key: string) => string | undefined
  repo: OrderStatusRepository
}

export type OrderStatusSuccessBody = {
  status: string
  terminal: boolean
  next_poll_after_seconds: number | null
}

export async function orchestrateOrderStatus(
  req: Request,
  deps: OrchestrateDeps,
): Promise<{ status: number; body: OrderStatusSuccessBody; headers?: Record<string, string> }> {
  if (req.method !== 'GET') {
    throw new OrderStatusError('METHOD_NOT_ALLOWED')
  }

  const config = loadOrderStatusRuntimeConfig(deps.env)
  const url = new URL(req.url)
  const reference = parsePublicOrderReference(url.searchParams.get('reference'))

  let internalState: string | null
  try {
    internalState = await deps.repo.getOrderStateByTrackingRef(reference)
  } catch {
    throw new OrderStatusError('SERVICE_UNAVAILABLE')
  }

  if (internalState === null) {
    throw new OrderStatusError('ORDER_NOT_FOUND')
  }

  const projection = projectPublicOrderStatus(internalState, config.pollSeconds)
  return {
    status: 200,
    body: {
      status: projection.status,
      terminal: projection.terminal,
      next_poll_after_seconds: projection.next_poll_after_seconds,
    },
  }
}
