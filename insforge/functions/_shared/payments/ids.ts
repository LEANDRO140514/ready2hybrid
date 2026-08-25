import { PaymentContractError } from './errors'

/**
 * SPEC-041 active initial providers. Identifiers outside this set fail closed.
 * Physical storage currently uses lowercase `mercadopago`; mapping belongs to
 * MULTI-PAY-4, not this contract identifier set.
 */
export const ACTIVE_PAYMENT_PROVIDER_IDS = ['MERCADO_PAGO', 'CLIP', 'OPENPAY'] as const

export type ActivePaymentProviderId = (typeof ACTIVE_PAYMENT_PROVIDER_IDS)[number]

export function isActivePaymentProviderId(value: string): value is ActivePaymentProviderId {
  return (ACTIVE_PAYMENT_PROVIDER_IDS as readonly string[]).includes(value)
}

export function parseActivePaymentProviderId(raw: unknown): ActivePaymentProviderId {
  if (typeof raw !== 'string' || !isActivePaymentProviderId(raw)) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER')
  }
  return raw
}

/** Server enablement for the approved active set. Missing/false = fail closed. */
export type ProviderEnablement = Partial<Record<ActivePaymentProviderId, boolean>>

export function resolveSelectableProvider(
  raw: unknown,
  enablement: ProviderEnablement,
): ActivePaymentProviderId {
  const id = parseActivePaymentProviderId(raw)
  if (enablement[id] !== true) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER')
  }
  return id
}
