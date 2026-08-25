/**
 * Canonical payment.normalized_state literals (SPEC-032 / ck_payments_normalized_state).
 * Do not invent additional business statuses here.
 */
export const NORMALIZED_PAYMENT_STATUSES = [
  'UNKNOWN',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'REFUNDED',
  'CHARGED_BACK',
] as const

export type NormalizedPaymentStatus = (typeof NORMALIZED_PAYMENT_STATUSES)[number]

export function isNormalizedPaymentStatus(value: string): value is NormalizedPaymentStatus {
  return (NORMALIZED_PAYMENT_STATUSES as readonly string[]).includes(value)
}

/**
 * Contract-test fixture map only. Not Mercado Pago, Clip, or Openpay production
 * mappings (those belong to MULTI-PAY-4/5/6). Unlisted raw values → UNKNOWN.
 */
export const MOCK_CONTRACT_STATUS_FIXTURES: Readonly<Record<string, NormalizedPaymentStatus>> = {
  mock_approved: 'APPROVED',
  mock_pending: 'PENDING',
  mock_rejected: 'REJECTED',
  mock_cancelled: 'CANCELLED',
  mock_refunded: 'REFUNDED',
  mock_charged_back: 'CHARGED_BACK',
}

export function normalizeMockContractStatus(rawStatus: string): NormalizedPaymentStatus {
  const key = rawStatus.trim().toLowerCase()
  return MOCK_CONTRACT_STATUS_FIXTURES[key] ?? 'UNKNOWN'
}
