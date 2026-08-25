import type { PaymentClient } from '../mercadopago/payments'
import { amountToCents } from '../mercadopago/payments'
import { validateMercadoPagoWebhookSignature } from '../mercadopago/signature'
import { normalizeProviderPaymentStatus } from '../webhook/normalize'
import type { PaymentProviderAdapter } from './adapter'
import { PaymentContractError } from './errors'
import { isNormalizedPaymentStatus, type NormalizedPaymentStatus } from './status'
import type {
  ProviderEventInput,
  ProviderPayment,
  ResolvedPaymentCheckoutInput,
} from './types'

/**
 * Narrow checkout port. Amount/currency/orderId come from the resolved snapshot.
 *
 * Extra Checkout Pro fields required by the existing mp-client:
 * - productCode / productName: SAFE_PRESENTATION_METADATA (Lane A checkout builder)
 * - price.journey: SALES_DOMAIN_DATA (not recomputed here)
 * - paymentPolicy: LEGACY_COUPLING / Lane A MSI policy
 * - accessToken / siteId / notificationUrl: PAYMENT_PROVIDER_NEEDED (remain outside adapter DTOs)
 *
 * This unit does not bind those fields; runtime wiring is blocked by Lane A WIP.
 */
export type MercadoPagoPreferencePortInput = {
  orderId: string
  amountCents: number
  currency: 'MXN'
  description: string
  backUrls: {
    success: string
    failure: string
    pending: string
  }
}

export type MercadoPagoPreferencePortResult = {
  preferenceId: string
  initPoint: string
}

export type MercadoPagoPreferencePort = {
  createCheckoutProPreference: (
    input: MercadoPagoPreferencePortInput,
  ) => Promise<MercadoPagoPreferencePortResult>
}

export type MercadoPagoAdapterDeps = {
  preferences: MercadoPagoPreferencePort
  payments: PaymentClient
  getAccessToken: () => string
  getWebhookSecret: () => string
}

function asNormalizedStatus(raw: string): NormalizedPaymentStatus {
  const mapped = normalizeProviderPaymentStatus(raw)
  return isNormalizedPaymentStatus(mapped) ? mapped : 'UNKNOWN'
}

/**
 * Thin Mercado Pago adapter. Reuses existing signature, GET payment, and
 * status normalization. Does not perform HTTP itself. Does not apply
 * order/ticket/registration/inventory effects.
 */
export function createMercadoPagoPaymentAdapter(
  deps: MercadoPagoAdapterDeps,
): PaymentProviderAdapter {
  return {
    provider: 'MERCADO_PAGO',

    async createCheckout(input: ResolvedPaymentCheckoutInput) {
      if (input.provider !== 'MERCADO_PAGO') {
        throw new PaymentContractError('UNSUPPORTED_PROVIDER')
      }
      if (input.eligibility !== 'PAYMENT_ELIGIBLE') {
        throw new PaymentContractError('INVALID_REQUEST')
      }
      let created: MercadoPagoPreferencePortResult
      try {
        created = await deps.preferences.createCheckoutProPreference({
          orderId: input.orderId,
          amountCents: input.amountCents,
          currency: input.currency,
          description: input.description,
          backUrls: input.returnUrls,
        })
      } catch (error) {
        if (error instanceof PaymentContractError) throw error
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      if (!created.preferenceId?.trim() || !created.initPoint?.trim()) {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      return {
        provider: 'MERCADO_PAGO' as const,
        checkoutHandle: created.preferenceId,
        redirectUrl: created.initPoint,
        financialAuthority: false as const,
      }
    },

    async verifyEvent(event: ProviderEventInput) {
      if (event.provider !== 'MERCADO_PAGO') {
        throw new PaymentContractError('INVALID_EVENT', 'Mercado Pago adapter rejects other providers')
      }
      if (event.authenticity.mechanism !== 'x-signature') {
        throw new PaymentContractError('INVALID_EVENT', 'Mercado Pago requires x-signature')
      }
      const secret = deps.getWebhookSecret()
      const xSignature = event.authenticity.xSignature
      const xRequestId = event.authenticity.xRequestId
      const dataId = event.authenticity.dataId ?? event.transactionHandle
      if (!secret.trim() || !xSignature?.trim() || !xRequestId?.trim() || !dataId.trim()) {
        throw new PaymentContractError('INVALID_EVENT')
      }
      const signature = await validateMercadoPagoWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
        secret,
      })
      if (!signature.ok) {
        throw new PaymentContractError('INVALID_EVENT')
      }
      return {
        provider: 'MERCADO_PAGO' as const,
        authenticity: 'accepted' as const,
        eventId: event.eventId,
        transactionHandle: signature.dataIdNormalized,
        financialAuthority: false as const,
      }
    },

    async getPayment(transactionHandle: string) {
      const handle = transactionHandle.trim()
      if (!handle) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      const accessToken = deps.getAccessToken()
      if (!accessToken.trim()) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      let raw
      try {
        raw = await deps.payments.getPayment(handle, accessToken)
      } catch {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      const providerTransactionId = String(raw.id ?? '').trim()
      if (!providerTransactionId) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      const amountCents =
        typeof raw.transaction_amount === 'number' ? amountToCents(raw.transaction_amount) : null
      const currency =
        typeof raw.currency_id === 'string' && raw.currency_id.trim()
          ? raw.currency_id.trim()
          : null
      const orderCorrelation =
        typeof raw.external_reference === 'string' && raw.external_reference.trim()
          ? raw.external_reference.trim()
          : null
      const payment: ProviderPayment = {
        provider: 'MERCADO_PAGO',
        providerTransactionId,
        providerRawStatus: raw.status,
        normalizedStatus: asNormalizedStatus(raw.status),
        amountCents,
        currency,
        orderCorrelation,
      }
      return payment
    },

    normalizeStatus(providerRawStatus: string) {
      return asNormalizedStatus(providerRawStatus)
    },
  }
}
