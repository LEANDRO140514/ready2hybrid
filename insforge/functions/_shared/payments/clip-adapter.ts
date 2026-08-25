import type { ClipCheckoutHttpClient } from '../clip/checkout-client'
import { centsToClipAmount, clipAmountToCents } from '../clip/money'
import { normalizeClipCheckoutStatus } from '../clip/status'
import type { ClipCreateCheckoutRequest } from '../clip/types'
import type { PaymentProviderAdapter } from './adapter'
import { PaymentContractError } from './errors'
import type {
  ProviderEventInput,
  ProviderPayment,
  ResolvedPaymentCheckoutInput,
  VerifiedProviderEvent,
} from './types'

const CLIP_DESCRIPTION_MAX = 250
const CLIP_EXTERNAL_REFERENCE_MAX = 36
const CLIP_EXPIRES_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const CLIP_CHECKOUT_RESOURCE = 'checkout'

export type ClipAdapterDeps = {
  client: ClipCheckoutHttpClient
  getWebhookUrl: () => string
}

function serializeClipExpiresAt(value: string | undefined): string {
  const raw = value?.trim() ?? ''
  if (!raw) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'Clip checkout requires canonical expiresAt from upstream hold/order expiry',
    )
  }
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) {
    throw new PaymentContractError('INVALID_REQUEST', 'expiresAt must be a valid ISO-8601 timestamp')
  }
  const truncated = new Date(Math.trunc(ms / 1000) * 1000)
  const formatted = truncated.toISOString().replace('.000Z', 'Z')
  if (formatted.length !== 20 || !CLIP_EXPIRES_AT_PATTERN.test(formatted)) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'expiresAt cannot be serialized to Clip YYYY-MM-DDTHH:MM:SSZ',
    )
  }
  return formatted
}

function presentationDescription(raw: string): string {
  let cleaned = ''
  for (const ch of raw) {
    const code = ch.charCodeAt(0)
    cleaned += code < 32 || code === 127 ? ' ' : ch
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    throw new PaymentContractError('INVALID_REQUEST', 'description is required')
  }
  if (cleaned.length > CLIP_DESCRIPTION_MAX) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'description exceeds Clip purchase_description max length of 250',
    )
  }
  return cleaned
}

function requireOrderId(orderId: string): string {
  const id = orderId.trim()
  if (!id) {
    throw new PaymentContractError('INVALID_REQUEST', 'orderId is required')
  }
  if (id.length > CLIP_EXTERNAL_REFERENCE_MAX) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'orderId exceeds Clip metadata.external_reference max length of 36',
    )
  }
  return id
}

function requireWebhookUrl(getWebhookUrl: () => string): string {
  const url = getWebhookUrl().trim()
  if (!url) {
    throw new PaymentContractError('INVALID_REQUEST', 'Clip webhook_url is required from server config')
  }
  return url
}

function isCheckoutResource(resource: string | undefined): boolean {
  if (!resource) return true
  const key = resource.trim().toLowerCase()
  return key === CLIP_CHECKOUT_RESOURCE || key === 'payment_request'
}

/**
 * Thin Clip Checkout Redirect adapter. HTTP stays in the Clip client.
 * Does not apply order/ticket/registration/inventory effects.
 */
export function createClipPaymentAdapter(deps: ClipAdapterDeps): PaymentProviderAdapter {
  return {
    provider: 'CLIP',

    async createCheckout(input: ResolvedPaymentCheckoutInput) {
      if (input.provider !== 'CLIP') {
        throw new PaymentContractError('UNSUPPORTED_PROVIDER')
      }
      if (input.eligibility !== 'PAYMENT_ELIGIBLE') {
        throw new PaymentContractError('INVALID_REQUEST')
      }
      const request: ClipCreateCheckoutRequest = {
        amount: centsToClipAmount(input.amountCents),
        currency: input.currency,
        purchase_description: presentationDescription(input.description),
        redirection_url: {
          success: input.returnUrls.success,
          error: input.returnUrls.failure,
          default: input.returnUrls.pending,
        },
        webhook_url: requireWebhookUrl(deps.getWebhookUrl),
        metadata: {
          external_reference: requireOrderId(input.orderId),
        },
        override_settings: {
          tip_enabled: false,
        },
        expires_at: serializeClipExpiresAt(input.expiresAt),
      }
      let created
      try {
        created = await deps.client.createCheckout(request)
      } catch (error) {
        if (error instanceof PaymentContractError) throw error
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      return {
        provider: 'CLIP' as const,
        checkoutHandle: created.payment_request_id,
        redirectUrl: created.payment_request_url,
        financialAuthority: false as const,
      }
    },

    async verifyEvent(event: ProviderEventInput): Promise<VerifiedProviderEvent> {
      if (event.provider !== 'CLIP') {
        throw new PaymentContractError('INVALID_EVENT', 'Clip adapter rejects other providers')
      }
      if (event.authenticity.mechanism !== 'event_handle') {
        throw new PaymentContractError('INVALID_EVENT', 'Clip requires event_handle')
      }
      if (!isCheckoutResource(event.authenticity.resource)) {
        throw new PaymentContractError('INVALID_EVENT', 'Clip refund/non-checkout resources are not checkout payments')
      }
      const paymentRequestId = (
        event.authenticity.paymentRequestId ?? event.transactionHandle
      ).trim()
      if (!paymentRequestId || !event.eventId.trim()) {
        throw new PaymentContractError('INVALID_EVENT')
      }
      return {
        provider: 'CLIP',
        authenticity: 'accepted',
        eventId: event.eventId,
        transactionHandle: paymentRequestId,
        financialAuthority: false,
        notificationId: event.authenticity.notificationId?.trim() || undefined,
      }
    },

    async getPayment(transactionHandle: string): Promise<ProviderPayment> {
      const handle = transactionHandle.trim()
      if (!handle) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      let raw
      try {
        raw = await deps.client.getCheckout(handle)
      } catch (error) {
        if (error instanceof PaymentContractError) throw error
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      const normalizedStatus = normalizeClipCheckoutStatus(raw.status)
      const completed = normalizedStatus === 'APPROVED'
      const receipt = raw.receipt_no?.trim() ?? ''
      const providerTransactionId = completed ? receipt : raw.payment_request_id.trim()
      if (!providerTransactionId) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      let amountCents: number | null = null
      try {
        amountCents = clipAmountToCents(raw.amount)
      } catch {
        amountCents = null
        if (completed) {
          throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
        }
      }
      const currency = raw.currency.trim() || null
      const orderCorrelation = raw.metadata?.external_reference?.trim() || null
      return {
        provider: 'CLIP',
        providerTransactionId,
        providerRawStatus: raw.status,
        normalizedStatus,
        amountCents,
        currency,
        orderCorrelation,
      }
    },

    normalizeStatus(providerRawStatus: string) {
      return normalizeClipCheckoutStatus(providerRawStatus)
    },
  }
}
