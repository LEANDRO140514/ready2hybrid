import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { CheckoutError } from '../_shared/checkout/errors'
import { createHttpMercadoPagoClient } from '../_shared/checkout/mp-client'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
} from '../_shared/checkout/orchestrate'
import {
  gateRequestOrigin,
  originNotAllowedResponse,
  readConfiguredOrigin,
} from '../_shared/http/origin-guard'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

const ALLOW_METHODS = 'POST, OPTIONS'
const ALLOW_HEADERS = 'Content-Type, Authorization, X-Idempotency-Key'

function gateOrigin(req: Request) {
  const allowedOrigin = readConfiguredOrigin(env, 'CHECKOUT_CORS_ORIGIN')
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { 'Content-Type': 'application/json' },
  })
}

function jsonResponse(status: number, body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
          day: product.day == null || product.day === '' ? null : String(product.day),
          commercial_stage_high_water:
            product.commercial_stage_high_water == null || product.commercial_stage_high_water === ''
              ? 'LAUNCH'
              : String(product.commercial_stage_high_water),
        },
        event: {
          code: String(event.code),
          status: String(event.status),
          sales_open_at: (event.sales_open_at as string | null) ?? null,
          sales_close_at: (event.sales_close_at as string | null) ?? null,
          sale_state: (event.sale_state as string | null) ?? null,
        },
      }
    },
    async getCategoryOfferSaleState(eventCode, block) {
      const { data, error } = await admin.database
        .from('event_category_sale_states')
        .select('sale_state')
        .eq('event_code', eventCode)
        .eq('block', block)
        .limit(1)
      if (error || !data?.length) return null
      const saleState = (data[0] as { sale_state?: string | null }).sale_state
      return saleState == null || saleState === '' ? null : String(saleState)
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
          buyer_email: input.buyerEmail,
          buyer_name: input.buyerName,
          buyer_phone: input.buyerPhone,
          buyer_contact_consent: input.buyerContactConsent,
          participant_public_ref: input.participantPublicRef,
          captain_name: input.captainName,
          teammate_names: input.teammateNames,
          commercial_snapshot: input.commercialSnapshot,
          invitation_ttl_seconds: input.invitationTtlSeconds,
          waiver_document_type: input.waiverDocumentType,
          waiver_document_version: input.waiverDocumentVersion,
          waiver_accepted: input.waiverAccepted,
        },
      })
      if (error) {
        // TEMPORARY DIAGNOSTIC: log RPC error before throwing
        console.error('[CHECKOUT_TX_ERROR]', JSON.stringify(error))
        throw new CheckoutError('INTERNAL_ERROR')
      }
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
          invitationTokens: [],
        }
      }
      const tokens = Array.isArray(row.invitation_tokens)
        ? (row.invitation_tokens as Array<{ token?: string }>)
            .filter((t) => typeof t?.token === 'string')
            .map((t) => ({ token: String(t.token) }))
        : []
      return {
        orderId: String(row.order_id),
        trackingRef: String(row.tracking_ref),
        orderItemId: String(row.order_item_id),
        holdId: String(row.hold_id),
        expiresAt: String(row.expires_at),
        replay: false,
        priorResponse: null,
        invitationTokens: tokens,
      }
    },
    async attachPreference(input) {
      const { data, error } = await admin.database.rpc('checkout_attach_preference', {
        p: {
          order_id: input.orderId,
          preference_id: input.preferenceId,
          init_point: input.initPoint,
          invitation_tokens: input.invitationTokens,
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

  const catalogWithCapacity: CatalogPort = {
    ...catalog,
    async getConsumedCapacityUnits(productId) {
      const { data: holds, error } = await admin.database
        .from('capacity_holds')
        .select('capacity_units,state,expires_at')
        .eq('product_id', productId)
      if (error || !holds) return 0
      const nowMs = Date.now()
      let sum = 0
      for (const h of holds as Array<{ capacity_units: number; state: string; expires_at: string | null }>) {
        if (h.state === 'CONVERTED') {
          sum += Number(h.capacity_units) || 0
          continue
        }
        if (h.state === 'ACTIVE') {
          if (h.expires_at == null || new Date(h.expires_at).getTime() > nowMs) {
            sum += Number(h.capacity_units) || 0
          }
        }
      }
      return sum
    },
  }

  return { catalog: catalogWithCapacity, repo }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    const gate = gateOrigin(req)
    if (!gate.ok) {
      if (gate.kind === 'MISSING_CONFIG') {
        return new Response(JSON.stringify(new CheckoutError('CONFIGURATION_ERROR').toPublicBody()), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return originNotAllowedResponse()
    }
    const { 'Content-Type': _ct, ...preflightHeaders } = gate.headers
    return new Response(null, { status: 204, headers: preflightHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(new CheckoutError('INVALID_REQUEST').toPublicBody()), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const gate = gateOrigin(req)
  if (!gate.ok) {
    if (gate.kind === 'MISSING_CONFIG') {
      return new Response(JSON.stringify(new CheckoutError('CONFIGURATION_ERROR').toPublicBody()), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originNotAllowedResponse()
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonResponse(400, new CheckoutError('INVALID_REQUEST').toPublicBody(), gate.headers)
  }

  try {
    const { catalog, repo } = createPorts()
    const result = await orchestrateCheckoutStart(raw, {
      env,
      catalog,
      repo,
      mp: createHttpMercadoPagoClient(),
    })
    return jsonResponse(result.status, result.body, gate.headers)
  } catch (error) {
    if (error instanceof CheckoutError) {
      return jsonResponse(error.status, error.toPublicBody(), gate.headers)
    }
    // TEMPORARY DIAGNOSTIC: log unexpected error before converting to INTERNAL_ERROR
    console.error('[CHECKOUT_HANDLER_ERROR]', error instanceof Error ? error.stack ?? error.message : JSON.stringify(error))
    return jsonResponse(500, new CheckoutError('INTERNAL_ERROR').toPublicBody(), gate.headers)
  }
}
