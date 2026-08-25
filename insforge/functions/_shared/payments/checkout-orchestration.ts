import type { PaymentProviderAdapter } from './adapter'
import { parseResolvedPaymentCheckoutInput } from './checkout-input'
import { PaymentContractError } from './errors'
import type { ProviderEnablement } from './ids'
import { selectPaymentProviderAdapter, type PaymentProviderRegistry } from './registry'
import type { ProviderCheckoutResult, ResolvedPaymentCheckoutInput } from './types'

export type CreatePaymentCheckoutArgs = {
  input: unknown
  enablement: ProviderEnablement
  registry: PaymentProviderRegistry
}

/**
 * Provider-neutral checkout seam. Lane A later calls this with a already-resolved
 * canonical snapshot and selected_provider. Does not recompute price.
 * Does not mark paid / register / ticket.
 */
export async function createPaymentCheckout(
  args: CreatePaymentCheckoutArgs,
): Promise<ProviderCheckoutResult> {
  const input = parseResolvedPaymentCheckoutInput(args.input)
  const adapter = selectPaymentProviderAdapter(input.provider, args.enablement, args.registry)
  assertAdapterMatches(adapter, input)
  const result = await adapter.createCheckout(input)
  if (result.financialAuthority !== false) {
    throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Checkout cannot carry financial authority')
  }
  if (result.provider !== input.provider) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Checkout provider mismatch')
  }
  return result
}

function assertAdapterMatches(adapter: PaymentProviderAdapter, input: ResolvedPaymentCheckoutInput): void {
  if (adapter.provider !== input.provider) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Adapter does not match selected provider')
  }
}
