import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import {
  assessHolds,
  assessOrder,
  browserSuppliedAmount,
  browserSuppliedCard,
  chargeIdDecision,
  nextAttemptAction,
  parsePaymentMode,
  paymentPathAllowed,
  readCents,
  failedChargeDisposition,
  safeTechnicalStatus,
  openpayChargeRedirect,
  shouldApplyVerified,
  shouldSendTicketEmail,
  verifiedApplyPayload,
} from '../_shared/openpay/attempt'
import { attemptIdFromOpenpayOrderId, buildOpenpayCharge, openpayOrderId } from '../_shared/openpay/charge'
import { trustedClientIp } from '../_shared/openpay/client-ip'
import { openpayMsiEnabled, openpayNewChargesOpen, openpayRuntime } from '../_shared/openpay/gate'
import { openpayChoicesForAmount } from '../_shared/openpay/msi'
import { chargeIsBusinessRejection, classifyOpenpayCreateBody, sanitizeErrorCode, sanitizeProviderDetail } from '../_shared/openpay/provider-error'
import { verifyOpenpayCharge } from '../_shared/openpay/verify'
import {
  gateRequestOrigin,
  originNotAllowedResponse,
  readConfiguredOrigin,
} from '../_shared/http/origin-guard'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AttemptRecord = {
  id: string
  order_id: string
  openpay_order_ref: string
  openpay_charge_id: string | null
  mode: string
}

type OrderRecord = {
  id: string
  state: string
  currency: string | null
  total_cents: number | string
  buyer_contact_id: string | null
}

function firstRow<T>(data: unknown): T | null {
  return Array.isArray(data) ? (data[0] as T | undefined) ?? null : null
}

function fireTicketEmail(baseUrl: string, orderId: string): void {
  const bearer = env('TICKET_OPERATOR_BEARER')
  if (!bearer) return
  fetch(`${baseUrl}/functions/send-ticket-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ order_id: orderId }),
  }).catch(() => undefined)
}

export default async function handler(req: Request): Promise<Response> {
  const runtime = openpayRuntime({
    OPENPAY_ENABLED: env('OPENPAY_ENABLED'),
    OPENPAY_SANDBOX: env('OPENPAY_SANDBOX'),
  })
  if (!runtime) {
    return json(404, { error: 'OPENPAY_DISABLED' })
  }
  const apiBase = runtime.apiBase
  const msiEnabled = openpayMsiEnabled({ OPENPAY_MSI_ENABLED: env('OPENPAY_MSI_ENABLED') })
  const chargesOpen = openpayNewChargesOpen({ OPENPAY_CHARGES_ENABLED: env('OPENPAY_CHARGES_ENABLED') })

  const allowedOrigin = readConfiguredOrigin(env, 'CHECKOUT_CORS_ORIGIN')
  const gate = gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: 'POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization',
    extraHeaders: { 'Content-Type': 'application/json' },
  })
  if (!gate.ok) {
    if (gate.kind === 'MISSING_CONFIG') return json(503, { error: 'CONFIGURATION_ERROR' })
    return originNotAllowedResponse()
  }
  if (req.method === 'OPTIONS') {
    const { 'Content-Type': _contentType, ...preflight } = gate.headers
    return new Response(null, { status: 204, headers: preflight })
  }
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }, gate.headers)

  const merchantId = env('OPENPAY_MERCHANT_ID')
  const privateKey = env('OPENPAY_PRIVATE_KEY')
  const redirectUrl = env('OPENPAY_REDIRECT_URL')
  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!merchantId || !privateKey || !redirectUrl || !baseUrl || !apiKey) {
    return json(500, { error: 'CONFIGURATION_ERROR' }, gate.headers)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return json(400, { error: 'INVALID_REQUEST' }, gate.headers)
  }
  if (browserSuppliedCard(body)) return json(400, { error: 'CARD_DATA_REJECTED' }, gate.headers)
  if (browserSuppliedAmount(body)) return json(400, { error: 'BROWSER_AMOUNT_REJECTED' }, gate.headers)

  const orderId = typeof body.order_id === 'string' ? body.order_id : ''
  const sourceId = typeof body.source_id === 'string' ? body.source_id : ''
  const deviceSessionId = typeof body.device_session_id === 'string' ? body.device_session_id : ''
  const preview = body.intent === 'preview'
  if (!UUID.test(orderId) || (!preview && (!sourceId || !deviceSessionId))) {
    return json(400, { error: 'INVALID_REQUEST' }, gate.headers)
  }
  const mode = preview
    ? { ok: true as const, mode: 'ONE_TIME' as const, installments: 1 as const }
    : parsePaymentMode({ mode: body.mode, installments: body.installments })
  if (!mode.ok) return json(400, { error: mode.code }, gate.headers)
  if (mode.mode === 'THREE_MSI' && !msiEnabled) {
    return json(400, { error: 'MSI_NOT_OFFERED' }, gate.headers)
  }

  const clientIp = trustedClientIp(req.headers)
  if (!clientIp) return json(400, { error: 'MISSING_CLIENT_IP' }, gate.headers)

  const admin = createAdminClient({ baseUrl, apiKey })
  const { data: orderData, error: orderError } = await admin.database
    .from('orders')
    .select('id,state,currency,total_cents,buyer_contact_id')
    .eq('id', orderId)
    .limit(1)
  const order = firstRow<OrderRecord>(orderData)
  if (orderError || !order) return json(404, { error: 'ORDER_NOT_FOUND' }, gate.headers)

  const totalCents = readCents(order.total_cents)
  if (totalCents == null) return json(409, { error: 'ORDER_AMOUNT_MISMATCH' }, gate.headers)
  const payable = assessOrder({ state: order.state, currency: order.currency, totalCents })
  if (!payable.ok) return json(409, { error: payable.code }, gate.headers)

  if (preview) {
    const choices = openpayChoicesForAmount(totalCents).filter((count) => count === 1 || msiEnabled)
    return json(200, {
      ok: true,
      preview: true,
      order_id: order.id,
      state: order.state,
      currency: 'MXN',
      amount_cents: totalCents,
      modes: choices.map((count) => (count === 3 ? 'THREE_MSI' : 'ONE_TIME')),
      three_msi_eligible: msiEnabled && choices.includes(3),
    }, gate.headers)
  }

  const plan = buildOpenpayCharge({
    attemptId: order.id,
    totalCents,
    installments: mode.installments,
    sourceId,
    deviceSessionId,
    redirectUrl,
  })
  if (!plan.ok) return json(400, { error: plan.code }, gate.headers)

  const { data: holdData } = await admin.database
    .from('capacity_holds')
    .select('state,expires_at')
    .eq('order_id', order.id)
  const holds = (Array.isArray(holdData) ? holdData : []) as { state: string; expires_at: string | null }[]
  const holdCheck = assessHolds(
    holds.map((hold) => ({ state: hold.state, expiresAt: hold.expires_at })),
    new Date().toISOString(),
  )
  if (!holdCheck.ok) return json(409, { error: holdCheck.code }, gate.headers)

  const { data: paymentData } = await admin.database
    .from('payments')
    .select('provider')
    .eq('order_id', order.id)
  const payments = (Array.isArray(paymentData) ? paymentData : []) as { provider: string }[]
  const path = paymentPathAllowed(payments)
  if (!path.ok) return json(409, { error: path.code }, gate.headers)

  if (!order.buyer_contact_id) return json(409, { error: 'ORDER_NOT_PAYABLE' }, gate.headers)
  const { data: buyerData } = await admin.database
    .from('buyer_contacts')
    .select('name,email,phone')
    .eq('id', order.buyer_contact_id)
    .limit(1)
  const buyer = firstRow<{ name: string | null; email: string | null; phone: string | null }>(buyerData)
  const customerName = buyer?.name?.trim() ?? ''
  const customerEmail = buyer?.email?.trim() ?? ''
  if (!customerName || !customerEmail) return json(409, { error: 'ORDER_NOT_PAYABLE' }, gate.headers)
  const customer = {
    name: customerName,
    email: customerEmail,
    ...(buyer?.phone?.trim() ? { phone_number: buyer.phone.trim() } : {}),
  }

  const { data: attemptData } = await admin.database
    .from('openpay_payment_attempts')
    .select('id,order_id,openpay_order_ref,openpay_charge_id,mode')
    .eq('order_id', order.id)
    .limit(1)
  let attempt = firstRow<AttemptRecord>(attemptData)
  const action = nextAttemptAction(
    attempt
      ? { openpayOrderRef: attempt.openpay_order_ref, openpayChargeId: attempt.openpay_charge_id }
      : null,
    order.id,
  )
  if (action.action === 'ref_mismatch') return json(409, { error: 'ORDER_REF_MISMATCH' }, gate.headers)
  if (!attempt?.openpay_charge_id && !chargesOpen) {
    return json(403, { error: 'CHARGES_CLOSED' }, gate.headers)
  }

  if (action.action === 'create_attempt') {
    const { error: insertError } = await admin.database.from('openpay_payment_attempts').insert([{
      order_id: order.id,
      openpay_order_ref: action.openpayOrderRef,
      mode: mode.mode,
      initial_status: null,
    }])
    const { data: reloaded } = await admin.database
      .from('openpay_payment_attempts')
      .select('id,order_id,openpay_order_ref,openpay_charge_id,mode')
      .eq('order_id', order.id)
      .limit(1)
    attempt = firstRow<AttemptRecord>(reloaded)
    if (insertError && !attempt) return json(409, { error: 'ATTEMPT_NOT_CREATED' }, gate.headers)
    if (!attempt) return json(409, { error: 'ATTEMPT_NOT_CREATED' }, gate.headers)
    if (attempt.openpay_charge_id) {
      return resumeExistingCharge({
        admin,
        attempt,
        order,
        totalCents,
        merchantId,
        privateKey,
        clientIp,
        baseUrl,
        apiBase,
        headers: gate.headers,
      })
    }
  }

  if (!attempt) return json(409, { error: 'ATTEMPT_NOT_FOUND' }, gate.headers)
  if (attempt.mode !== mode.mode) return json(409, { error: 'MODE_NOT_ALLOWED' }, gate.headers)
  if (attempt.openpay_charge_id) {
    return resumeExistingCharge({
      admin,
      attempt,
      order,
      totalCents,
      merchantId,
      privateKey,
      clientIp,
      baseUrl,
      apiBase,
      headers: gate.headers,
    })
  }

  const chargeAttemptId = attemptIdFromOpenpayOrderId(attempt.openpay_order_ref) ?? order.id
  const charge = buildOpenpayCharge({
    attemptId: chargeAttemptId,
    totalCents,
    installments: mode.installments,
    sourceId,
    deviceSessionId,
    redirectUrl,
    customer,
  })
  if (!charge.ok) return json(400, { error: charge.code }, gate.headers)

  let response: Response
  try {
    response = await fetch(`${apiBase}/v1/${merchantId}/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${privateKey}:`)}`,
        'Content-Type': 'application/json',
        'X-Forwarded-For': clientIp,
      },
      body: JSON.stringify(charge.body),
    })
  } catch {
    return json(504, { error: 'PROVIDER_UNKNOWN' }, gate.headers)
  }

  const payload = await response.json().catch(() => ({})) as {
    id?: string
    status?: string
    error_code?: number | string
    description?: string
    error_message?: string
    payment_method?: { url?: string }
  }
  const classified = classifyOpenpayCreateBody(response.status, payload)
  if (classified.outcome === 'technical') {
    return json(502, { error: 'PROVIDER_UNKNOWN' }, gate.headers)
  }
  if (classified.outcome === 'business') {
    await admin.database.from('openpay_payment_attempts').update({
      provider_error_code: classified.errorCode,
      provider_error_detail: classified.description,
      last_verified_status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id)
    return json(402, {
      error: 'CHARGE_REJECTED',
      error_code: classified.errorCode,
      description: classified.description,
    }, gate.headers)
  }
  if (chargeIsBusinessRejection(classified.status)) {
    const decision = chargeIdDecision(attempt.openpay_charge_id, classified.chargeId)
    if (decision === 'mismatch') return json(409, { error: 'CHARGE_ID_MISMATCH' }, gate.headers)
    if (decision === 'set') {
      await admin.database.from('openpay_payment_attempts').update({
        openpay_charge_id: classified.chargeId,
        provider_error_code: classified.errorCode,
        provider_error_detail: classified.description,
        initial_status: classified.status,
        last_verified_status: classified.status,
        updated_at: new Date().toISOString(),
      }).eq('id', attempt.id).is('openpay_charge_id', null)
      const { data: storedData } = await admin.database
        .from('openpay_payment_attempts')
        .select('openpay_charge_id')
        .eq('id', attempt.id)
        .limit(1)
      const stored = firstRow<{ openpay_charge_id: string | null }>(storedData)
      if (chargeIdDecision(stored?.openpay_charge_id ?? null, classified.chargeId) === 'mismatch') {
        return json(409, { error: 'CHARGE_ID_MISMATCH' }, gate.headers)
      }
    }
    return json(402, {
      error: 'CHARGE_REJECTED',
      error_code: classified.errorCode,
      description: classified.description,
      charge_id: classified.chargeId,
    }, gate.headers)
  }

  const decision = chargeIdDecision(attempt.openpay_charge_id, classified.chargeId)
  if (decision === 'mismatch') return json(409, { error: 'CHARGE_ID_MISMATCH' }, gate.headers)
  if (decision === 'set') {
    await admin.database.from('openpay_payment_attempts').update({
      openpay_charge_id: classified.chargeId,
      initial_status: safeTechnicalStatus(classified.status),
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id).is('openpay_charge_id', null)
    const { data: storedData } = await admin.database
      .from('openpay_payment_attempts')
      .select('openpay_charge_id')
      .eq('id', attempt.id)
      .limit(1)
    const stored = firstRow<{ openpay_charge_id: string | null }>(storedData)
    if (chargeIdDecision(stored?.openpay_charge_id ?? null, classified.chargeId) === 'mismatch') {
      return json(409, { error: 'CHARGE_ID_MISMATCH' }, gate.headers)
    }
  }

  return json(200, {
    order_id: order.id,
    openpay_order_ref: attempt.openpay_order_ref,
    charge_id: classified.chargeId,
    status: safeTechnicalStatus(classified.status),
    redirect_url: openpayChargeRedirect(payload.payment_method, apiBase),
  }, gate.headers)
}

async function resumeExistingCharge(input: {
  admin: ReturnType<typeof createAdminClient>
  attempt: AttemptRecord
  order: OrderRecord
  totalCents: number
  merchantId: string
  privateKey: string
  clientIp: string
  baseUrl: string
  apiBase: string
  headers: Record<string, string>
}): Promise<Response> {
  const chargeId = input.attempt.openpay_charge_id
  if (!chargeId) return json(409, { error: 'ATTEMPT_NOT_FOUND' }, input.headers)

  let response: Response
  try {
    response = await fetch(`${input.apiBase}/v1/${input.merchantId}/charges/${chargeId}`, {
      headers: {
        Authorization: `Basic ${btoa(`${input.privateKey}:`)}`,
        'X-Forwarded-For': input.clientIp,
      },
    })
  } catch {
    return json(504, { error: 'PROVIDER_UNKNOWN' }, input.headers)
  }
  if (!response.ok) return json(502, { error: 'PROVIDER_LOOKUP_FAILED' }, input.headers)
  const charge = await response.json() as {
    id: string
    status: string
    amount: number
    currency: string
    order_id: string | null
    error_code?: number | string
    error_message?: string
    payment_method?: { url?: string }
  }
  if (charge.id !== chargeId) return json(409, { error: 'CHARGE_ID_MISMATCH' }, input.headers)
  const verified = verifyOpenpayCharge(charge, {
    orderRef: input.attempt.openpay_order_ref,
    totalCents: input.totalCents,
  })
  if (!verified.ok) return json(409, { error: verified.code }, input.headers)
  if (failedChargeDisposition(verified.normalized) === 'rotate') {
    const nextRef = openpayOrderId(crypto.randomUUID())
    const errorCode = sanitizeErrorCode(charge.error_code)
    const description = sanitizeProviderDetail(charge.error_message)
    await input.admin.database.from('openpay_payment_attempts').update({
      openpay_order_ref: nextRef,
      openpay_charge_id: null,
      rejected_charge_id: chargeId,
      provider_error_code: errorCode,
      provider_error_detail: description,
      last_verified_status: safeTechnicalStatus(charge.status),
      updated_at: new Date().toISOString(),
    }).eq('id', input.attempt.id).eq('openpay_charge_id', chargeId)
    return json(200, {
      order_id: input.order.id,
      error: 'CHARGE_REJECTED',
      error_code: errorCode,
      description,
      openpay_order_ref: nextRef,
      charge_id: chargeId,
      status: safeTechnicalStatus(charge.status),
      retryable: true,
    }, input.headers)
  }
  if (failedChargeDisposition(verified.normalized) === 'stop') {
    return json(409, { error: 'CHARGE_CANCELLED' }, input.headers)
  }
  if (!shouldApplyVerified(verified.normalized)) {
    return json(200, {
      order_id: input.order.id,
      openpay_order_ref: input.attempt.openpay_order_ref,
      charge_id: chargeId,
      status: safeTechnicalStatus(charge.status),
      redirect_url: openpayChargeRedirect(charge.payment_method, input.apiBase),
    }, input.headers)
  }

  const { data, error } = await input.admin.database.rpc('openpay_apply_verified_charge', {
    p: verifiedApplyPayload({
      openpayOrderRef: input.attempt.openpay_order_ref,
      chargeId,
      orderId: input.order.id,
      amountCents: input.totalCents,
      externalState: charge.status,
      correlationId: `retry:${chargeId}`.slice(0, 64),
      verifiedAt: new Date().toISOString(),
    }),
  })
  if (error) return json(503, { error: 'APPLY_UNAVAILABLE' }, input.headers)
  const row = data as { ok?: boolean; outcome?: string; error_code?: string; order_id?: string }
  if (!row?.ok) return json(409, { error: row?.error_code ?? 'APPLY_REJECTED' }, input.headers)
  if (shouldSendTicketEmail(row.outcome) && row.order_id) fireTicketEmail(input.baseUrl, row.order_id)
  return json(200, {
    order_id: input.order.id,
    openpay_order_ref: input.attempt.openpay_order_ref,
    charge_id: chargeId,
    status: safeTechnicalStatus(charge.status),
    redirect_url: null,
    outcome: row.outcome ?? null,
  }, input.headers)
}
