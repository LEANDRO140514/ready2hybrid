import { requiredEventMechanism, type PaymentProviderAdapter } from '../adapter'
import { PaymentContractError } from '../errors'
import type { ActivePaymentProviderId } from '../ids'
import { normalizeMockContractStatus } from '../status'
import type {
  ProviderEventInput,
  ProviderPayment,
  ResolvedPaymentCheckoutInput,
} from '../types'

export type InMemoryAdapterOptions = {
  createCheckout?: 'ok' | 'unavailable'
  verifyEvent?: 'accept' | 'reject' | 'unavailable'
  getPayment?: 'ok' | 'unavailable' | 'missing'
  checkoutHandle?: string
  redirectUrl?: string
  payment?: Partial<ProviderPayment>
}

function assertEventShape(
  provider: ActivePaymentProviderId,
  event: ProviderEventInput,
): void {
  if (event.provider !== provider) {
    throw new PaymentContractError('INVALID_EVENT', 'Event provider does not match adapter')
  }
  if (event.authenticity.mechanism !== requiredEventMechanism(provider)) {
    throw new PaymentContractError('INVALID_EVENT', 'Authenticity mechanism is provider-specific')
  }
  if (!event.eventId.trim() || !event.transactionHandle.trim()) {
    throw new PaymentContractError('INVALID_EVENT')
  }
}

/**
 * Deterministic in-memory adapter. No HTTP, no secrets, no PSP network.
 * Status mapping uses mock contract fixtures only.
 */
export function createInMemoryPaymentAdapter(
  provider: ActivePaymentProviderId,
  options: InMemoryAdapterOptions = {},
): PaymentProviderAdapter {
  const payments = new Map<string, ProviderPayment>()
  const checkoutHandle = options.checkoutHandle ?? `${provider.toLowerCase()}-checkout-1`
  const redirectUrl =
    options.redirectUrl ?? `https://mock.ready2hybrid.test/${provider.toLowerCase()}/hosted`

  const seedPayment = (handle: string, patch: Partial<ProviderPayment> = {}): ProviderPayment => {
    const raw = patch.providerRawStatus ?? 'mock_pending'
    const payment: ProviderPayment = {
      provider,
      providerTransactionId: patch.providerTransactionId ?? handle,
      providerRawStatus: raw,
      normalizedStatus: patch.normalizedStatus ?? normalizeMockContractStatus(raw),
      amountCents: patch.amountCents !== undefined ? patch.amountCents : 140000,
      currency: patch.currency !== undefined ? patch.currency : 'MXN',
      orderCorrelation: patch.orderCorrelation !== undefined ? patch.orderCorrelation : 'order-1',
    }
    payments.set(payment.providerTransactionId, payment)
    return payment
  }

  if (options.payment) {
    seedPayment(options.payment.providerTransactionId ?? checkoutHandle, options.payment)
  }

  return {
    provider,
    async createCheckout(input: ResolvedPaymentCheckoutInput) {
      if (options.createCheckout === 'unavailable') {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      if (input.provider !== provider) {
        throw new PaymentContractError('INVALID_REQUEST', 'Adapter provider mismatch')
      }
      if (input.eligibility !== 'PAYMENT_ELIGIBLE') {
        throw new PaymentContractError('INVALID_REQUEST')
      }
      seedPayment(checkoutHandle, {
        amountCents: input.amountCents,
        currency: input.currency,
        orderCorrelation: input.orderId,
        providerRawStatus: 'mock_pending',
        normalizedStatus: 'PENDING',
      })
      return {
        provider,
        checkoutHandle,
        redirectUrl,
        financialAuthority: false,
      }
    },
    async verifyEvent(event) {
      if (options.verifyEvent === 'unavailable') {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      if (options.verifyEvent === 'reject') {
        throw new PaymentContractError('INVALID_EVENT')
      }
      assertEventShape(provider, event)
      return {
        provider,
        authenticity: 'accepted',
        eventId: event.eventId,
        transactionHandle: event.transactionHandle,
        financialAuthority: false,
      }
    },
    async getPayment(transactionHandle) {
      if (options.getPayment === 'unavailable') {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE')
      }
      const payment = payments.get(transactionHandle)
      if (!payment || options.getPayment === 'missing') {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE')
      }
      return payment
    },
    normalizeStatus(providerRawStatus) {
      return normalizeMockContractStatus(providerRawStatus)
    },
  }
}
