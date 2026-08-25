import type {
  ExpectedFinancialSnapshot,
  FinancialCorrespondenceResult,
  PaidSemanticsDecision,
  ProviderCheckoutResult,
  ProviderPayment,
  VerifiedProviderEvent,
} from './types'

export function correspondFinancially(
  expected: ExpectedFinancialSnapshot,
  payment: ProviderPayment,
): FinancialCorrespondenceResult {
  if (payment.provider !== expected.provider) {
    return { ok: false, reason: 'PROVIDER_MISMATCH' }
  }
  if (payment.orderCorrelation == null || payment.orderCorrelation === '') {
    return { ok: false, reason: 'MISSING_CORRELATION' }
  }
  if (payment.orderCorrelation !== expected.orderId) {
    return { ok: false, reason: 'CORRELATION_MISMATCH' }
  }
  if (payment.amountCents == null) {
    return { ok: false, reason: 'MISSING_AMOUNT' }
  }
  if (payment.amountCents !== expected.amountCents) {
    return { ok: false, reason: 'AMOUNT_MISMATCH' }
  }
  if (payment.currency == null || payment.currency === '') {
    return { ok: false, reason: 'MISSING_CURRENCY' }
  }
  if (payment.currency !== expected.currency) {
    return { ok: false, reason: 'CURRENCY_MISMATCH' }
  }
  return { ok: true }
}

export function decidePaidSemanticsFromRedirect(
  _checkout: ProviderCheckoutResult,
): PaidSemanticsDecision {
  return { paidSemantics: false, source: 'redirect' }
}

export function decidePaidSemanticsFromVerifiedEvent(
  _event: VerifiedProviderEvent,
): PaidSemanticsDecision {
  return { paidSemantics: false, source: 'verified_event' }
}

export function decidePaidSemanticsFromPayment(
  expected: ExpectedFinancialSnapshot,
  payment: ProviderPayment,
): PaidSemanticsDecision {
  if (payment.normalizedStatus === 'UNKNOWN') {
    return { paidSemantics: false, source: 'unknown_status' }
  }
  const correspondence = correspondFinancially(expected, payment)
  if (!correspondence.ok) {
    return {
      paidSemantics: false,
      source: 'financial_mismatch',
      reason: correspondence.reason,
    }
  }
  if (payment.normalizedStatus !== 'APPROVED') {
    return {
      paidSemantics: false,
      source: 'non_approved',
      normalizedStatus: payment.normalizedStatus,
    }
  }
  if (!hasProviderTransactionId(payment.providerTransactionId)) {
    return { paidSemantics: false, source: 'missing_transaction_id' }
  }
  return {
    paidSemantics: 'eligible_for_domain_tx',
    source: 'financial_resolution',
    normalizedStatus: 'APPROVED',
  }
}

function hasProviderTransactionId(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}
