import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { chargeIdDecision, correlationId, safeTechnicalStatus, shouldApplyVerified, shouldSendTicketEmail, verifiedApplyPayload } from '../_shared/openpay/attempt'
import { openpayRuntime } from '../_shared/openpay/gate'
import { openpayEventShouldFetch } from '../_shared/openpay/status'
import { sanitizeErrorCode, sanitizeProviderDetail } from '../_shared/openpay/provider-error'
import { verifyOpenpayCharge } from '../_shared/openpay/verify'
import { basicAuthMatches } from '../_shared/openpay/webhook-auth'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function firstRow<T>(data: unknown): T | null {
  return Array.isArray(data) ? (data[0] as T | undefined) ?? null : null
}

export default async function handler(req: Request): Promise<Response> {
  const runtime = openpayRuntime({
    OPENPAY_ENABLED: env('OPENPAY_ENABLED'),
    OPENPAY_SANDBOX: env('OPENPAY_SANDBOX'),
  })
  if (!runtime) {
    return json(404, { error: 'OPENPAY_DISABLED' })
  }
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const webhookUser = env('OPENPAY_WEBHOOK_USER')
  const webhookPassword = env('OPENPAY_WEBHOOK_PASSWORD')
  const merchantId = env('OPENPAY_MERCHANT_ID')
  const privateKey = env('OPENPAY_PRIVATE_KEY')
  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!webhookUser || !webhookPassword || !merchantId || !privateKey || !baseUrl || !apiKey) {
    return json(500, { error: 'CONFIGURATION_ERROR' })
  }
  if (!basicAuthMatches(req.headers.get('authorization'), webhookUser, webhookPassword)) {
    return json(401, { error: 'UNAUTHORIZED' })
  }

  let event: { type?: string; transaction?: { id?: string } }
  try {
    event = await req.json() as { type?: string; transaction?: { id?: string } }
  } catch {
    return json(400, { error: 'INVALID_REQUEST' })
  }
  if (!event.type || !openpayEventShouldFetch(event.type)) {
    return json(200, { ok: true, ignored: true })
  }
  const transactionId = event.transaction?.id
  if (!transactionId || !/^[A-Za-z0-9_-]{1,64}$/.test(transactionId)) {
    return json(400, { error: 'MISSING_TRANSACTION' })
  }

  const chargeResponse = await fetch(`${runtime.apiBase}/v1/${merchantId}/charges/${transactionId}`, {
    headers: { Authorization: `Basic ${btoa(`${privateKey}:`)}` },
  })
  if (!chargeResponse.ok) return json(502, { error: 'PROVIDER_LOOKUP_FAILED' })
  const charge = await chargeResponse.json() as {
    id: string
    status: string
    amount: number
    currency: string
    order_id: string | null
    error_code?: number | string
    error_message?: string
  }
  if (!charge.order_id || charge.id !== transactionId) return json(409, { error: 'REFERENCE_MISMATCH' })

  const admin = createAdminClient({ baseUrl, apiKey })
  const { data: attemptData, error: attemptError } = await admin.database
    .from('openpay_payment_attempts')
    .select('id,order_id,openpay_order_ref,openpay_charge_id')
    .eq('openpay_order_ref', charge.order_id)
    .limit(1)
  const attempt = firstRow<{
    id: string
    order_id: string
    openpay_order_ref: string
    openpay_charge_id: string | null
  }>(attemptData)
  if (attemptError || !attempt) return json(409, { error: 'ATTEMPT_NOT_FOUND' })
  if (attempt.openpay_charge_id && attempt.openpay_charge_id !== charge.id) {
    return json(409, { error: 'CHARGE_ID_MISMATCH' })
  }

  const { data: orderData, error: orderError } = await admin.database
    .from('orders')
    .select('id,total_cents,currency')
    .eq('id', attempt.order_id)
    .limit(1)
  const order = firstRow<{ id: string; total_cents: number | string; currency: string | null }>(orderData)
  if (orderError || !order || order.currency !== 'MXN') return json(409, { error: 'ORDER_NOT_FOUND' })
  const totalCents = typeof order.total_cents === 'string' ? Number(order.total_cents) : order.total_cents
  if (!Number.isSafeInteger(totalCents)) return json(409, { error: 'ORDER_AMOUNT_MISMATCH' })

  const verified = verifyOpenpayCharge(charge, {
    orderRef: attempt.openpay_order_ref,
    totalCents,
  })
  if (!verified.ok) return json(409, { error: verified.code })
  const chargeDecision = chargeIdDecision(attempt.openpay_charge_id, charge.id)
  if (chargeDecision === 'mismatch') return json(409, { error: 'CHARGE_ID_MISMATCH' })
  if (chargeDecision === 'set') {
    await admin.database.from('openpay_payment_attempts').update({
      openpay_charge_id: charge.id,
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id).is('openpay_charge_id', null)
    const { data: storedData } = await admin.database
      .from('openpay_payment_attempts')
      .select('openpay_charge_id')
      .eq('id', attempt.id)
      .limit(1)
    const stored = firstRow<{ openpay_charge_id: string | null }>(storedData)
    if (chargeIdDecision(stored?.openpay_charge_id ?? null, charge.id) === 'mismatch') {
      return json(409, { error: 'CHARGE_ID_MISMATCH' })
    }
  }

  if (!shouldApplyVerified(verified.normalized)) {
    await admin.database.from('openpay_payment_attempts').update({
      last_verified_status: safeTechnicalStatus(charge.status),
      provider_error_code: sanitizeErrorCode(charge.error_code),
      provider_error_detail: sanitizeProviderDetail(charge.error_message),
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', attempt.id).eq('openpay_charge_id', charge.id)
    return json(200, { ok: true, applied: false, status: verified.normalized })
  }

  const { data, error } = await admin.database.rpc('openpay_apply_verified_charge', {
    p: verifiedApplyPayload({
      openpayOrderRef: attempt.openpay_order_ref,
      chargeId: charge.id,
      orderId: order.id,
      amountCents: totalCents,
      externalState: charge.status,
      correlationId: correlationId(event.type, transactionId),
      verifiedAt: new Date().toISOString(),
    }),
  })
  if (error) return json(503, { error: 'APPLY_UNAVAILABLE' })
  const row = data as { ok?: boolean; outcome?: string; error_code?: string; order_id?: string }
  if (!row?.ok) return json(409, { error: row?.error_code ?? 'APPLY_REJECTED' })
  if (shouldSendTicketEmail(row.outcome)) {
    const bearer = env('TICKET_OPERATOR_BEARER')
    const paidOrderId = row.order_id
    if (bearer && paidOrderId) {
      fetch(`${baseUrl}/functions/send-ticket-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ order_id: paidOrderId }),
      }).catch(() => undefined)
    }
  }
  return json(200, { ok: true, outcome: row.outcome ?? null })
}
