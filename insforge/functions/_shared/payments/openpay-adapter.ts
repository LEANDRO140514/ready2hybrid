import { timingSafeEqual } from 'node:crypto'
import type { OpenpayChargeHttpClient } from '../openpay/charge-client'
import { centsToOpenpayAmount, openpayAmountToCents } from '../openpay/money'
import { normalizeOpenpayChargeStatus } from '../openpay/status'
import type {
  OpenpayCheckoutContext,
  OpenpayCreateChargeRequest,
  OpenpayWebhookBasicAuth,
} from '../openpay/types'
import type { PaymentProviderAdapter } from './adapter'
import { PaymentContractError } from './errors'
import type {
  ProviderEventInput,
  ProviderPayment,
  ResolvedPaymentCheckoutInput,
  VerifiedProviderEvent,
} from './types'

const OPENPAY_DESCRIPTION_MAX = 250
const OPENPAY_ORDER_ID_MAX = 100
const OPENPAY_VERIFICATION_EVENT = 'verification'

export type OpenpayAdapterDeps = {
  client: OpenpayChargeHttpClient
  getCheckoutContext: () => OpenpayCheckoutContext
  getWebhookBasicAuth: () => OpenpayWebhookBasicAuth
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
  if (cleaned.length > OPENPAY_DESCRIPTION_MAX) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'description exceeds Openpay description max length of 250',
    )
  }
  return cleaned
}

function requireOrderId(orderId: string): string {
  const id = orderId.trim()
  if (!id) {
    throw new PaymentContractError('INVALID_REQUEST', 'orderId is required')
  }
  if (id.length > OPENPAY_ORDER_ID_MAX) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'orderId exceeds Openpay order_id max length of 100',
    )
  }
  return id
}

function requireHttpsUrl(value: string, field: string): string {
  const url = value.trim()
  if (!url.startsWith('https://')) {
    throw new PaymentContractError('INVALID_REQUEST', `${field} must be an https URL`)
  }
  return url
}

function requireCustomer(customer: OpenpayCheckoutContext['customer']): OpenpayCreateChargeRequest['customer'] {
  const name = customer.name.trim()
  const lastName = customer.last_name.trim()
  const phone = customer.phone_number.trim()
  const email = customer.email.trim()
  if (!name || !lastName || !phone || !email || !email.includes('@')) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'Openpay customer context is incomplete; Lane A must supply validated canonical participant data',
    )
  }
  return { name, last_name: lastName, phone_number: phone, email }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function requireMatchingBasicAuth(
  event: Extract<ProviderEventInput, { provider: 'OPENPAY' }>,
  expected: OpenpayWebhookBasicAuth,
): void {
  const username = event.authenticity.username?.trim() ?? ''
  const password = event.authenticity.password ?? ''
  const expectedUser = expected.username.trim()
  const expectedPass = expected.password
  if (!expectedUser || !expectedPass) {
    throw new PaymentContractError('INVALID_EVENT', 'Openpay webhook Basic auth is not configured')
  }
  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
    throw new PaymentContractError('INVALID_EVENT', 'Openpay webhook Basic auth failed')
  }
}

function isOriginalCardCharge(raw: {
  transaction_type: string
  operation_type: string
  method: string
}): boolean {
  return (
    raw.transaction_type.trim().toLowerCase() === 'charge' &&
    raw.operation_type.trim().toLowerCase() === 'in' &&
    raw.method.trim().toLowerCase() === 'card'
  )
}

/**
 * Thin Openpay Mexico hosted-redirect adapter. HTTP stays in the Openpay client.
 * Does not apply order/ticket/registration/inventory effects.
 */
export function createOpenpayPaymentAdapter(deps: OpenpayAdapterDeps): PaymentProviderAdapter {
  return {
    provider: 'OPENPAY',

    async createCheckout(input: ResolvedPaymentCheckoutInput) {
      if (input.provider !== 'OPENPAY') {
        throw new PaymentContractError('UNSUPPORTED_PROVIDER')
      }
      if (input.eligibility !== 'PAYMENT_ELIGIBLE') {
        throw new PaymentContractError('INVALID_REQUEST')
      }
      const context = deps.getCheckoutContext()
      const clientIp = context.clientIp.trim()
      if (!clientIp || clientIp === 'unknown' || clientIp.includes(',')) {
        throw new PaymentContractError(
          'INVALID_REQUEST',
          'Openpay checkout requires a server-validated client IP',
        )
      }
      const request: OpenpayCreateChargeRequest = {
        method: 'card',
        amount: centsToOpenpayAmount(input.amountCents),
        currency: input.currency,
        description: presentationDescription(input.description),
        order_id: requireOrderId(input.orderId),
        customer: requireCustomer(context.customer),
        confirm: false,
        send_email: false,
        redirect_url: requireHttpsUrl(input.returnUrls.success, 'returnUrls.success'),
      }
      let created
      try {
        created = await deps.client.createCharge(request)
      } catch (error) {
        if (error instanceof PaymentContractError) throw error
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      return {
        provider: 'OPENPAY' as const,
        checkoutHandle: created.id,
        redirectUrl: created.payment_method.url,
        financialAuthority: false as const,
      }
    },

    async verifyEvent(event: ProviderEventInput): Promise<VerifiedProviderEvent> {
      if (event.provider !== 'OPENPAY') {
        throw new PaymentContractError('INVALID_EVENT', 'Openpay adapter rejects other providers')
      }
      if (event.authenticity.mechanism !== 'http_basic_ingress') {
        throw new PaymentContractError('INVALID_EVENT', 'Openpay requires http_basic_ingress')
      }
      requireMatchingBasicAuth(event, deps.getWebhookBasicAuth())
      const eventType = event.authenticity.eventType?.trim().toLowerCase() ?? ''
      if (eventType === OPENPAY_VERIFICATION_EVENT) {
        const verificationCode = event.authenticity.verificationCode?.trim() ?? ''
        if (!verificationCode || !event.eventId.trim()) {
          throw new PaymentContractError('INVALID_EVENT', 'Openpay verification handshake is incomplete')
        }
        return {
          provider: 'OPENPAY',
          authenticity: 'accepted',
          eventId: event.eventId,
          transactionHandle: event.eventId,
          financialAuthority: false,
        }
      }
      const transactionId = (event.authenticity.transactionId ?? event.transactionHandle).trim()
      if (!transactionId || !event.eventId.trim()) {
        throw new PaymentContractError('INVALID_EVENT')
      }
      return {
        provider: 'OPENPAY',
        authenticity: 'accepted',
        eventId: event.eventId,
        transactionHandle: transactionId,
        financialAuthority: false,
      }
    },

    async getPayment(transactionHandle: string): Promise<ProviderPayment> {
      const handle = transactionHandle.trim()
      if (!handle) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      let raw
      try {
        raw = await deps.client.getCharge(handle)
      } catch (error) {
        if (error instanceof PaymentContractError) throw error
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      const normalizedStatus = normalizeOpenpayChargeStatus(raw.status)
      const completed = normalizedStatus === 'APPROVED'
      if (completed && !isOriginalCardCharge(raw)) {
        throw new PaymentContractError(
          'FINANCIAL_RESOLUTION_FAILURE',
          'Openpay GET is not an original inbound card charge',
        )
      }
      const providerTransactionId = raw.id.trim()
      if (!providerTransactionId) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      let amountCents: number | null = null
      try {
        amountCents = openpayAmountToCents(raw.amount)
      } catch {
        amountCents = null
        if (completed) {
          throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
        }
      }
      const currency = raw.currency.trim() || null
      const orderCorrelation = raw.order_id?.trim() || null
      if (completed && (!orderCorrelation || !currency || amountCents == null)) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      return {
        provider: 'OPENPAY',
        providerTransactionId,
        providerRawStatus: raw.status,
        normalizedStatus,
        amountCents,
        currency,
        orderCorrelation,
      }
    },

    normalizeStatus(providerRawStatus: string) {
      return normalizeOpenpayChargeStatus(providerRawStatus)
    },
  }
}
