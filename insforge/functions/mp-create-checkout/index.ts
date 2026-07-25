import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { CheckoutError } from '../_shared/checkout/errors'
import { createHttpMercadoPagoClient } from '../_shared/checkout/mp-client'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
} from '../_shared/checkout/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function corsHeaders(): Record<string, string> {
  const origin = env('CHECKOUT_CORS_ORIGIN')?.trim()
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
    'Content-Type': 'application/json',
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() })
}

function createPorts() {
  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) {
    throw new CheckoutError('CONFIGURATION_ERROR', 'InsForge admin credentials missing')
  }

  const admin = createAdminClient({ baseUrl, apiKey })

  const catalog: CatalogPort = {
    async getProductWithEvent(productCode) {
      const { data: products, error } = await admin.database
        .from('products')
        .select('*')
        .eq('code', productCode)
        .limit(1)
      if (error || !products?.length) return null
      const product = products[0] as Record<string, unknown>
      const { data: events, error: eventError } = await admin.database
        .from('events')
        .select('*')
        .eq('code', product.event_code as string)
        .limit(1)
      if (eventError || !events?.length) return null
      const event = events[0] as Record<string, unknown>
      return {
        product: {
          id: String(product.id),
          code: String(product.code),
          name: String(product.name),
          block: String(product.block),
          kind: String(product.kind),
          sale_state: (product.sale_state as string | null) ?? null,
          visibility: (product.visibility as string | null) ?? null,
          cupo: Number(product.cupo),
          price_cents: Number(product.price_cents),
          currency: String(product.currency),
          team_size: Number(product.team_size),
          event_code: String(product.event_code),
          has_chip: Boolean(product.has_chip),
          has_insurance: Boolean(product.has_insurance),
        },
        event: {
          code: String(event.code),
          status: String(event.status),
          sales_open_at: (event.sales_open_at as string | null) ?? null,
          sales_close_at: (event.sales_close_at as string | null) ?? null,
        },
      }
    },
  }

  const repo: CheckoutRepository = {
    async startCheckoutTx(input) {
      const { data, error } = await admin.database.rpc('checkout_start_tx', {
        p: {
          product_code: input.productCode,
          quantity: input.quantity,
          journey: input.journey,
          unit_price_cents: input.unitPriceCents,
          item_total_cents: input.itemTotalCents,
          total_cents: input.totalCents,
          capacity_unit: input.capacityUnit,
          capacity_units: input.capacityUnits,
          hold_duration_seconds: input.holdDurationSeconds,
          idempotency_key_hash: input.idempotencyKeyHash,
          request_fingerprint: input.requestFingerprint,
          idempotency_ttl_seconds: input.idempotencyTtlSeconds,
          correlation_id: input.correlationId,
          buyer_public_ref: input.buyerPublicRef,
          participant_public_ref: input.participantPublicRef,
          commercial_snapshot: input.commercialSnapshot,
        },
      })
      if (error) throw new CheckoutError('INTERNAL_ERROR')
      const row = data as Record<string, unknown>
      if (!row?.ok) {
        throw new CheckoutError((row?.error_code as never) || 'INTERNAL_ERROR')
      }
      if (row.replay) {
        return {
          orderId: '',
          trackingRef: '',
          orderItemId: '',
          holdId: '',
          expiresAt: '',
          replay: true,
          priorResponse: row.prior_response as never,
        }
      }
      return {
        orderId: String(row.order_id),
        trackingRef: String(row.tracking_ref),
        orderItemId: String(row.order_item_id),
        holdId: String(row.hold_id),
        expiresAt: String(row.expires_at),
        replay: false,
        priorResponse: null,
      }
    },
    async attachPreference(input) {
      const { data, error } = await admin.database.rpc('checkout_attach_preference', {
        p: {
          order_id: input.orderId,
          preference_id: input.preferenceId,
          init_point: input.initPoint,
        },
      })
      if (error || !(data as { ok?: boolean })?.ok) {
        throw new CheckoutError('CHECKOUT_CREATION_FAILED')
      }
    },
    async compensatePreferenceFailure(input) {
      await admin.database.rpc('checkout_compensate_preference', {
        p: {
          order_id: input.orderId,
          hold_id: input.holdId,
          reason: input.reason,
        },
      })
    },
  }

  return { catalog, repo }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, new CheckoutError('INVALID_REQUEST').toPublicBody())
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonResponse(400, new CheckoutError('INVALID_REQUEST').toPublicBody())
  }

  try {
    const { catalog, repo } = createPorts()
    const result = await orchestrateCheckoutStart(raw, {
      env,
      catalog,
      repo,
      mp: createHttpMercadoPagoClient(),
    })
    return jsonResponse(result.status, result.body)
  } catch (error) {
    if (error instanceof CheckoutError) {
      return jsonResponse(error.status, error.toPublicBody())
    }
    return jsonResponse(500, new CheckoutError('INTERNAL_ERROR').toPublicBody())
  }
}
