import { PaymentContractError } from './errors'
import type { ActivePaymentProviderId } from './ids'
import { resolveSelectableProvider, type ProviderEnablement } from './ids'
import type { PaymentProviderAdapter } from './adapter'

export type PaymentProviderRegistry = Partial<Record<ActivePaymentProviderId, PaymentProviderAdapter>>

export function selectPaymentProviderAdapter(
  rawProvider: unknown,
  enablement: ProviderEnablement,
  registry: PaymentProviderRegistry,
): PaymentProviderAdapter {
  const provider = resolveSelectableProvider(rawProvider, enablement)
  const adapter = registry[provider]
  if (!adapter) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER')
  }
  if (adapter.provider !== provider) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER')
  }
  return adapter
}
