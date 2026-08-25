import { PaymentContractError } from './errors'
import { toDurablePaymentProviderId } from './storage-mapping'
import type { ActivePaymentProviderId } from './ids'
import type {
  ExpectedFinancialSnapshot,
  PaidSemanticsDecision,
  ProviderPayment,
  VerifiedProviderEvent,
} from './types'

/**
 * Trusted, server-derived ownership/account proof. Never inferred from browser.
 * Mercado Pago: collector/merchant match performed by the live webhook before RPC.
 * Clip/Openpay: account-scoped server GET. No fabricated merchant-id field.
 */
export type CanonicalOwnershipProof =
  | { mechanism: 'collector_id_match'; verified: true }
  | { mechanism: 'account_scoped_get'; verified: true }

/**
 * Canonical RPC payload for webhook_apply_payment_tx(jsonb).
 * `provider` is the contract id. SQL maps it to durable storage.
 * This port does not invoke the RPC.
 */
export type CanonicalWebhookApplyPayload = {
  provider: ActivePaymentProviderId
  provider_notification_id: string
  notification_type: string
  provider_payment_id: string
  external_state: string
  normalized_state: string
  amount_cents: number
  currency: string
  external_reference: string
  merchant_ownership_ok: true
  external_reference_ok: true
  amount_ok: true
  currency_ok: true
}

export type CanonicalApplyEvidence = {
  event: VerifiedProviderEvent
  payment: ProviderPayment
  expected: ExpectedFinancialSnapshot
  decision: PaidSemanticsDecision
  ownershipProof: CanonicalOwnershipProof
}

function requireOwnershipProof(proof: CanonicalOwnershipProof | undefined): asserts proof is CanonicalOwnershipProof {
  if (!proof || proof.verified !== true) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Canonical apply requires explicit server-derived ownership proof',
    )
  }
  if (proof.mechanism !== 'collector_id_match' && proof.mechanism !== 'account_scoped_get') {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Canonical apply ownership mechanism is not recognized',
    )
  }
}

function requireOwnershipMatchesProvider(
  provider: ActivePaymentProviderId,
  proof: CanonicalOwnershipProof,
): void {
  if (provider === 'MERCADO_PAGO' && proof.mechanism !== 'collector_id_match') {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Mercado Pago apply requires collector_id_match ownership proof',
    )
  }
  if (provider !== 'MERCADO_PAGO' && proof.mechanism !== 'account_scoped_get') {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Clip/Openpay apply requires account_scoped_get ownership proof',
    )
  }
}

/**
 * Thin mapping from already-authorized provider-neutral evidence onto the
 * canonical apply contract. Does not persist, issue tickets, or call SQL.
 */
export function mapEligibleEvidenceToCanonicalApplyPayload(
  evidence: CanonicalApplyEvidence,
): CanonicalWebhookApplyPayload {
  if (evidence.decision.paidSemantics !== 'eligible_for_domain_tx') {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Evidence is not eligible for domain tx',
    )
  }
  requireOwnershipProof(evidence.ownershipProof)
  if (
    evidence.payment.provider !== evidence.expected.provider ||
    evidence.event.provider !== evidence.expected.provider
  ) {
    throw new PaymentContractError('FINANCIAL_MISMATCH', 'Provider mismatch before canonical apply')
  }
  requireOwnershipMatchesProvider(evidence.payment.provider, evidence.ownershipProof)
  void toDurablePaymentProviderId(evidence.payment.provider)
  const providerPaymentId = evidence.payment.providerTransactionId.trim()
  const notificationId = (evidence.event.notificationId ?? evidence.event.eventId).trim()
  if (!providerPaymentId || !notificationId) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Canonical apply requires durable identities',
    )
  }
  if (
    evidence.payment.amountCents !== evidence.expected.amountCents ||
    evidence.payment.currency !== evidence.expected.currency ||
    evidence.payment.orderCorrelation !== evidence.expected.orderId
  ) {
    throw new PaymentContractError('FINANCIAL_MISMATCH', 'Snapshot mismatch before canonical apply')
  }
  return {
    provider: evidence.payment.provider,
    provider_notification_id: notificationId,
    notification_type: 'payment',
    provider_payment_id: providerPaymentId,
    external_state: evidence.payment.providerRawStatus,
    normalized_state: evidence.payment.normalizedStatus,
    amount_cents: evidence.expected.amountCents,
    currency: evidence.expected.currency,
    external_reference: evidence.expected.orderId,
    merchant_ownership_ok: true,
    external_reference_ok: true,
    amount_ok: true,
    currency_ok: true,
  }
}
