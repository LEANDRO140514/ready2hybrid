import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { loadOrderStatusRuntimeConfig } from '../_shared/public-status/config'
import { OrderStatusError } from '../_shared/public-status/errors'
import { orchestrateOrderStatus, type OrderStatusRepository } from '../_shared/public-status/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function baseHeaders(): Record<string, string> {
  const config = loadOrderStatusRuntimeConfig(env)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (config.corsOrigin) {
    headers['Access-Control-Allow-Origin'] = config.corsOrigin
    headers['Vary'] = 'Origin'
  }
  return headers
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders() })
}

function createLazyRepo(): OrderStatusRepository {
  let client: ReturnType<typeof createAdminClient> | null = null

  function getClient() {
    if (client) return client
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) {
      throw new OrderStatusError('CONFIGURATION_ERROR')
    }
    client = createAdminClient({ baseUrl, apiKey })
    return client
  }

  return {
    async getOrderStateByTrackingRef(trackingRef) {
      const admin = getClient()
      // Minimal projection: only state by opaque tracking_ref. No PII columns selected.
      const { data, error } = await admin.database
        .from('orders')
        .select('state')
        .eq('tracking_ref', trackingRef)
        .limit(1)

      if (error) {
        throw new OrderStatusError('SERVICE_UNAVAILABLE')
      }
      const row = Array.isArray(data) ? data[0] : null
      if (!row || typeof row.state !== 'string') return null
      return row.state
    },
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders() })
  }

  try {
    const result = await orchestrateOrderStatus(req, {
      env,
      repo: createLazyRepo(),
    })
    return jsonResponse(result.status, result.body)
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return jsonResponse(error.status, error.toPublicBody())
    }
    return jsonResponse(500, new OrderStatusError('INTERNAL_ERROR').toPublicBody())
  }
}
