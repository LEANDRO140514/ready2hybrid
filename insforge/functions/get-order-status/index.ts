import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { loadOrderStatusRuntimeConfig } from '../_shared/public-status/config'
import { OrderStatusError } from '../_shared/public-status/errors'
import { orchestrateOrderStatus, type OrderStatusRepository } from '../_shared/public-status/orchestrate'
import {
  gateRequestOrigin,
  originNotAllowedResponse,
  readConfiguredOrigin,
} from '../_shared/http/origin-guard'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

const ALLOW_METHODS = 'GET, OPTIONS'
const ALLOW_HEADERS = 'Content-Type, Authorization'

function gateOrigin(req: Request) {
  const allowedOrigin = readConfiguredOrigin(env, 'ORDER_STATUS_CORS_ORIGIN', 'CHECKOUT_CORS_ORIGIN')
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function jsonResponse(
  status: number,
  body: unknown,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
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
    const gate = gateOrigin(req)
    if (!gate.ok) {
      if (gate.kind === 'MISSING_CONFIG') {
        return new Response(JSON.stringify(new OrderStatusError('CONFIGURATION_ERROR').toPublicBody()), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        })
      }
      return originNotAllowedResponse()
    }
    const { 'Content-Type': _ct, 'Cache-Control': _cc, ...preflightHeaders } = gate.headers
    return new Response(null, { status: 204, headers: preflightHeaders })
  }

  const gate = gateOrigin(req)
  if (!gate.ok) {
    if (gate.kind === 'MISSING_CONFIG') {
      return new Response(JSON.stringify(new OrderStatusError('CONFIGURATION_ERROR').toPublicBody()), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      })
    }
    return originNotAllowedResponse()
  }

  // Validate poll config after Origin gate so misconfiguration still fails closed,
  // but unauthorized origins never reach runtime config / DB.
  try {
    loadOrderStatusRuntimeConfig(env)
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return jsonResponse(error.status, error.toPublicBody(), gate.headers)
    }
    return jsonResponse(500, new OrderStatusError('INTERNAL_ERROR').toPublicBody(), gate.headers)
  }

  try {
    const result = await orchestrateOrderStatus(req, {
      env,
      repo: createLazyRepo(),
    })
    return jsonResponse(result.status, result.body, gate.headers)
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return jsonResponse(error.status, error.toPublicBody(), gate.headers)
    }
    return jsonResponse(500, new OrderStatusError('INTERNAL_ERROR').toPublicBody(), gate.headers)
  }
}
