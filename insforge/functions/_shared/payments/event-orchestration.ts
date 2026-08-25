import { requiredEventMechanism, type PaymentProviderAdapter } from './adapter'
import {
  decidePaidSemanticsFromPayment,
  decidePaidSemanticsFromVerifiedEvent,
} from './authority'
import { PaymentContractError } from './errors'
import type { ProviderEnablement } from './ids'
import { selectPaymentProviderAdapter, type PaymentProviderRegistry } from './registry'
import type {
  ExpectedFinancialSnapshot,
  PaidSemanticsDecision,
  ProviderEventInput,
  ProviderPayment,
  VerifiedProviderEvent,
} from './types'

export type ProviderEventResolution =
  | {
      kind: 'VERIFICATION_HANDSHAKE'
      event: VerifiedProviderEvent
      financialAuthority: false
      paidSemantics: false
    }
  | {
      kind: 'IGNORED_NON_FINANCIAL_EVENT'
      event: VerifiedProviderEvent
      financialAuthority: false
      paidSemantics: false
    }
  | {
      kind: 'PAYMENT_SIGNAL'
      event: VerifiedProviderEvent
      payment: ProviderPayment
      decision: PaidSemanticsDecision
    }

export type ResolveProviderEventArgs = {
  event: ProviderEventInput
  expected: ExpectedFinancialSnapshot
  enablement: ProviderEnablement
  registry: PaymentProviderRegistry
}

/**
 * Provider-neutral event seam. Authenticity stays provider-specific.
 * Redirect never enters this function. A verified event is not paid.
 */
export async function resolveProviderEvent(
  args: ResolveProviderEventArgs,
): Promise<ProviderEventResolution> {
  if (args.event.provider !== args.expected.provider) {
    throw new PaymentContractError('INVALID_EVENT', 'Event provider does not match expected snapshot')
  }
  if (args.event.authenticity.mechanism !== requiredEventMechanism(args.event.provider)) {
    throw new PaymentContractError('INVALID_EVENT', 'Authenticity mechanism is provider-specific')
  }
  const adapter = selectPaymentProviderAdapter(args.event.provider, args.enablement, args.registry)
  assertAdapterMatches(adapter, args.event)
  const event = await adapter.verifyEvent(args.event)
  if (event.financialAuthority !== false) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Verified event cannot carry financial authority',
    )
  }
  const verifiedDecision = decidePaidSemanticsFromVerifiedEvent(event)
  if (verifiedDecision.paidSemantics !== false) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Verified event cannot produce paid semantics',
    )
  }
  if (isOpenpayVerificationHandshake(args.event)) {
    return {
      kind: 'VERIFICATION_HANDSHAKE',
      event,
      financialAuthority: false,
      paidSemantics: false,
    }
  }
  const handle = event.transactionHandle.trim()
  if (!handle) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Payment signal missing transaction handle',
    )
  }
  const payment = await adapter.getPayment(handle)
  const decision = decidePaidSemanticsFromPayment(args.expected, payment)
  return {
    kind: 'PAYMENT_SIGNAL',
    event,
    payment,
    decision,
  }
}

function assertAdapterMatches(adapter: PaymentProviderAdapter, event: ProviderEventInput): void {
  if (adapter.provider !== event.provider) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Adapter does not match event provider')
  }
}

function isOpenpayVerificationHandshake(event: ProviderEventInput): boolean {
  return (
    event.provider === 'OPENPAY' &&
    event.authenticity.mechanism === 'http_basic_ingress' &&
    (event.authenticity.eventType?.trim().toLowerCase() ?? '') === 'verification'
  )
}
