/**
 * Shared claim for a new payment attempt. The SQL function is the only
 * writer; this module is the same decision, tested without a database.
 * A timeout is UNKNOWN and stays non-terminal until a provider GET says
 * the attempt is terminal and not captured.
 */

export const NON_TERMINAL_ATTEMPT_STATES = ['UNKNOWN', 'PENDING'] as const

export type PaymentProvider = 'MERCADOPAGO' | 'OPENPAY'

export type ClaimPayment = {
  id?: string
  provider?: string
  normalizedState: string
}

export type ClaimOrder = {
  state: string
  holdState: string | null
  holdExpiresAt: string | null
  payments: ClaimPayment[]
}

export type ClaimRefusal =
  | 'ALREADY_PAID'
  | 'APPROVED_EXISTS'
  | 'ATTEMPT_OPEN'
  | 'HOLD_NOT_ACTIVE'
  | 'HOLD_EXPIRED'
  | 'ORDER_NOT_CHARGEABLE'

export function claimPaymentAttempt(
  order: ClaimOrder,
  nowIso: string,
  provider: PaymentProvider = 'MERCADOPAGO',
): { ok: true; reused?: boolean; attemptId?: string } | { ok: false; code: ClaimRefusal } {
  if (order.state === 'PAID') return { ok: false, code: 'ALREADY_PAID' }
  if (!['CREATED', 'PREFERENCE_PENDING', 'PAYMENT_PENDING'].includes(order.state)) {
    return { ok: false, code: 'ORDER_NOT_CHARGEABLE' }
  }
  if (order.payments.some((row) => row.normalizedState === 'APPROVED')) {
    return { ok: false, code: 'APPROVED_EXISTS' }
  }
  const open = order.payments.filter((row) =>
    (NON_TERMINAL_ATTEMPT_STATES as readonly string[]).includes(row.normalizedState),
  )
  if (open.length > 0) {
    const same = open.find((row) => row.provider === provider)
    if (same && open.every((row) => row.provider === provider)) {
      return { ok: true, reused: true, attemptId: same.id }
    }
    return { ok: false, code: 'ATTEMPT_OPEN' }
  }
  if (order.holdState !== 'ACTIVE') return { ok: false, code: 'HOLD_NOT_ACTIVE' }
  if (!order.holdExpiresAt || Date.parse(order.holdExpiresAt) <= Date.parse(nowIso)) {
    return { ok: false, code: 'HOLD_EXPIRED' }
  }
  return { ok: true }
}
