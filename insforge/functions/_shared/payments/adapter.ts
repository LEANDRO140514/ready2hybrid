import type { ActivePaymentProviderId } from './ids'
import type { NormalizedPaymentStatus } from './status'
import type {
  ProviderCheckoutResult,
  ProviderEventInput,
  ProviderPayment,
  ResolvedPaymentCheckoutInput,
  VerifiedProviderEvent,
} from './types'

/**
 * Minimal adapter boundary for MERCADO_PAGO, CLIP, and OPENPAY.
 * verifyEvent (ingress) and getPayment (financial lookup) are distinct.
 * Refund/capture/tokenize are intentionally absent.
 */
export type PaymentProviderAdapter = {
  readonly provider: ActivePaymentProviderId
  createCheckout(input: ResolvedPaymentCheckoutInput): Promise<ProviderCheckoutResult>
  verifyEvent(event: ProviderEventInput): Promise<VerifiedProviderEvent>
  getPayment(transactionHandle: string): Promise<ProviderPayment>
  normalizeStatus(providerRawStatus: string): NormalizedPaymentStatus
}

export function requiredEventMechanism(
  provider: ActivePaymentProviderId,
): ProviderEventInput['authenticity']['mechanism'] {
  switch (provider) {
    case 'MERCADO_PAGO':
      return 'x-signature'
    case 'CLIP':
      return 'event_handle'
    case 'OPENPAY':
      return 'http_basic_ingress'
    default: {
      const _exhaustive: never = provider
      return _exhaustive
    }
  }
}
