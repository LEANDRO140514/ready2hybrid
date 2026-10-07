import { normalizeOpenpayChargeStatus, type NormalizedPaymentState } from './status'
import { openpayOrderId } from './charge'

export type OpenpayChargeResource = {
  id: string
  status: string
  amount: number
  currency: string
  order_id: string | null
}

export type OpenpayVerification =
  | { ok: true; normalized: NormalizedPaymentState }
  | { ok: false; code: 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH' | 'REFERENCE_MISMATCH' }

export function verifyOpenpayCharge(
  charge: OpenpayChargeResource,
  expected: { attemptId?: string; orderRef?: string; totalCents: number },
): OpenpayVerification {
  const orderRef = expected.orderRef ?? (expected.attemptId ? openpayOrderId(expected.attemptId) : null)
  if (!orderRef || charge.order_id !== orderRef) {
    return { ok: false, code: 'REFERENCE_MISMATCH' }
  }
  if (charge.currency !== 'MXN') return { ok: false, code: 'CURRENCY_MISMATCH' }
  const cents = Math.round(charge.amount * 100)
  if (cents !== expected.totalCents) return { ok: false, code: 'AMOUNT_MISMATCH' }
  return { ok: true, normalized: normalizeOpenpayChargeStatus(charge.status) }
}
