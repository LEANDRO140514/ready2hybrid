export type SandboxReturnOutcome = 'approved' | 'pending' | 'failed' | 'unknown'

const FAILED_ORDER = new Set(['REJECTED', 'CANCELLED', 'EXPIRED'])
const OPEN_ORDER = new Set(['CREATED', 'PREFERENCE_PENDING', 'PAYMENT_PENDING'])
const FAILED_ATTEMPT = new Set(['failed', 'FAILED', 'cancelled', 'CANCELLED', 'REJECTED'])

/** Outcome for the 3DS return page. No charge, no buyer data. */
export function sandboxReturnOutcome(input: {
  orderState: string | null
  attemptStatus: string | null
  providerErrorCode: string | null
}): SandboxReturnOutcome {
  if (!input.orderState) return 'unknown'
  if (input.orderState === 'PAID') return 'approved'
  if (FAILED_ORDER.has(input.orderState)) return 'failed'
  if (input.providerErrorCode || (input.attemptStatus != null && FAILED_ATTEMPT.has(input.attemptStatus))) {
    return 'failed'
  }
  if (OPEN_ORDER.has(input.orderState)) return 'pending'
  return 'unknown'
}
