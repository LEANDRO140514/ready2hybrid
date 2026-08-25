import type { ActivePaymentProviderId, ProviderEnablement } from './ids'
import { ACTIVE_PAYMENT_PROVIDER_IDS } from './ids'

/**
 * Adapter existence is not runtime enablement.
 * Contracted/implemented are documentary; only `runtimeEnabled` is consulted
 * by checkout/event orchestration. MP7 does not enable Clip or Openpay.
 */
export type ProviderAvailability = {
  provider: ActivePaymentProviderId
  contracted: boolean
  implemented: boolean
  runtimeReady: boolean
  runtimeEnabled: boolean
}

export const SAFE_RUNTIME_ENABLEMENT: ProviderEnablement = {
  MERCADO_PAGO: false,
  CLIP: false,
  OPENPAY: false,
}

export function isRuntimeEnabled(
  provider: ActivePaymentProviderId,
  enablement: ProviderEnablement,
): boolean {
  return enablement[provider] === true
}

export function describeProviderAvailability(
  enablement: ProviderEnablement,
): Record<ActivePaymentProviderId, ProviderAvailability> {
  return {
    MERCADO_PAGO: {
      provider: 'MERCADO_PAGO',
      contracted: true,
      implemented: true,
      runtimeReady: false,
      runtimeEnabled: isRuntimeEnabled('MERCADO_PAGO', enablement),
    },
    CLIP: {
      provider: 'CLIP',
      contracted: true,
      implemented: true,
      runtimeReady: false,
      runtimeEnabled: isRuntimeEnabled('CLIP', enablement),
    },
    OPENPAY: {
      provider: 'OPENPAY',
      contracted: true,
      implemented: true,
      runtimeReady: false,
      runtimeEnabled: isRuntimeEnabled('OPENPAY', enablement),
    },
  }
}

export function enabledProviderIds(enablement: ProviderEnablement): ActivePaymentProviderId[] {
  return ACTIVE_PAYMENT_PROVIDER_IDS.filter((id) => isRuntimeEnabled(id, enablement))
}
