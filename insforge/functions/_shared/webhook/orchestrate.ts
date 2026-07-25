import { amountToCents, type PaymentClient } from '../mercadopago/payments'
import { validateMercadoPagoWebhookSignature } from '../mercadopago/signature'
import { loadPaymentAccessConfig, loadWebhookSecret } from './config'
import { WebhookError } from './errors'
import {
  assertSupportedPaymentTopic,
  extractDataId,
  extractPaymentTopic,
  normalizeProviderPaymentStatus,
  type NormalizedPaymentState,
} from './normalize'

export type WebhookApplyInput = {
  providerNotificationId: string
  notificationType: string
  canonicalInputHash: string
  sanitizedHeaders: Record<string, string>
  providerPaymentId: string
  externalState: string
  normalizedState: NormalizedPaymentState
  amountCents: number
  currency: string
  externalReference: string
  liveMode: boolean | null
  collectorId: string | null
  merchantOwnershipOk: boolean
  externalReferenceOk: boolean
  amountOk: boolean
  currencyOk: boolean
  providerCreatedAt: string | null
  providerUpdatedAt: string | null
  correlationId: string | null
}

export type WebhookApplyResult = {
  ok: boolean
  replay?: boolean
  outcome?: string
  error_code?: string
}

export type WebhookRepository = {
  applyPaymentTx: (input: WebhookApplyInput) => Promise<WebhookApplyResult>
}

export type OrchestrateDeps = {
  env: (key: string) => string | undefined
  payments: PaymentClient
  repo: WebhookRepository
  now?: () => Date
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function sanitizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of ['content-type', 'user-agent', 'x-request-id']) {
    const value = headers.get(key)
    if (value) out[key] = value.slice(0, 200)
  }
  const sig = headers.get('x-signature')
  if (sig) {
    const tsMatch = /ts=(\d+)/.exec(sig)
    out['x-signature-ts'] = tsMatch?.[1] ?? 'present'
    out['x-signature'] = 'redacted'
  }
  return out
}

export async function orchestrateWebhook(
  req: Request,
  deps: OrchestrateDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (req.method !== 'POST') {
    throw new WebhookError('METHOD_NOT_ALLOWED')
  }

  const url = new URL(req.url)
  const xSignatureEarly = req.headers.get('x-signature')
  // Reject missing signature before secret/config lookups (no mutations, no MP calls).
  if (!xSignatureEarly?.trim()) {
    throw new WebhookError('UNAUTHORIZED')
  }

  // Secret required before cryptographic validation (fail-closed).
  const webhookSecret = loadWebhookSecret(deps.env)

  let body: Record<string, unknown> = {}
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const raw = await req.json()
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        body = raw as Record<string, unknown>
      } else {
        throw new WebhookError('INVALID_REQUEST')
      }
    } catch (error) {
      if (error instanceof WebhookError) throw error
      throw new WebhookError('INVALID_REQUEST')
    }
  } else if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    // Non-JSON body with content is malformed for this contract.
    throw new WebhookError('INVALID_REQUEST')
  }

  const dataId = extractDataId(url, body)
  const xRequestId = req.headers.get('x-request-id')
  const xSignature = xSignatureEarly

  const signature = await validateMercadoPagoWebhookSignature({
    xSignature,
    xRequestId,
    dataId,
    secret: webhookSecret,
  })

  if (!signature.ok) {
    // Fail closed: no provider query, no mutations.
    throw new WebhookError('UNAUTHORIZED')
  }

  const topic = extractPaymentTopic(url.searchParams.get('type') || url.searchParams.get('topic'), body)
  try {
    assertSupportedPaymentTopic(topic)
  } catch (error) {
    if (error instanceof WebhookError && error.code === 'UNSUPPORTED_TOPIC') {
      return {
        status: 200,
        body: { ok: true, ignored: true, reason: 'UNSUPPORTED_TOPIC' },
      }
    }
    throw error
  }

  const paymentConfig = loadPaymentAccessConfig(deps.env)
  const payment = await deps.payments.getPayment(signature.dataIdNormalized, paymentConfig.accessToken)
  const normalizedState = normalizeProviderPaymentStatus(payment.status)
  const amountCents =
    typeof payment.transaction_amount === 'number' ? amountToCents(payment.transaction_amount) : -1
  const currency = (payment.currency_id || '').toUpperCase()
  const externalReference = (payment.external_reference || '').trim()
  const liveMode = typeof payment.live_mode === 'boolean' ? payment.live_mode : null
  const collectorId =
    payment.collector_id === undefined || payment.collector_id === null
      ? null
      : String(payment.collector_id)

  let merchantOwnershipOk = true
  if (
    paymentConfig.expectedLiveMode !== null &&
    liveMode !== null &&
    liveMode !== paymentConfig.expectedLiveMode
  ) {
    merchantOwnershipOk = false
  }
  if (
    paymentConfig.expectedCollectorId &&
    collectorId &&
    collectorId !== paymentConfig.expectedCollectorId
  ) {
    merchantOwnershipOk = false
  }

  const currencyOk = currency === 'MXN'
  const externalReferenceOk = externalReference.length > 0
  // amountOk is finalized inside TX against order.total_cents; pre-flag obvious failures.
  const amountOk = amountCents > 0

  const sanitizedHeaders = sanitizeHeaders(req.headers)
  const canonicalInputHash = await sha256Hex(
    JSON.stringify({
      dataId: signature.dataIdNormalized,
      requestId: xRequestId,
      ts: signature.parts.ts,
      topic,
    }),
  )

  const apply = await deps.repo.applyPaymentTx({
    providerNotificationId: xRequestId!.trim(),
    notificationType: topic || 'payment',
    canonicalInputHash,
    sanitizedHeaders,
    providerPaymentId: String(payment.id),
    externalState: payment.status,
    normalizedState,
    amountCents,
    currency,
    externalReference,
    liveMode,
    collectorId,
    merchantOwnershipOk,
    externalReferenceOk,
    amountOk,
    currencyOk,
    providerCreatedAt: payment.date_created ?? null,
    providerUpdatedAt: payment.date_last_updated ?? null,
    correlationId: xRequestId,
  })

  if (!apply.ok) {
    if (apply.error_code === 'INTERNAL_ERROR') {
      throw new WebhookError('INTERNAL_ERROR')
    }
    // Permanent mismatch / order missing: acknowledge without retry storm; no domain confirm.
    return {
      status: 200,
      body: {
        ok: true,
        applied: false,
        outcome: apply.outcome || 'REJECTED_VERIFICATION',
      },
    }
  }

  const outcome = apply.outcome || 'APPLIED'
  const applied =
    !apply.replay &&
    outcome !== 'DUPLICATE' &&
    outcome !== 'VERIFICATION_REJECTED' &&
    outcome !== 'REJECTED_VERIFICATION'

  return {
    status: 200,
    body: {
      ok: true,
      applied,
      replay: Boolean(apply.replay),
      outcome,
    },
  }
}
