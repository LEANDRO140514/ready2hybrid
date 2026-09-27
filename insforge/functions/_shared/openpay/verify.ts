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
  expected: { attemptId: string; totalCents: number },
): OpenpayVerification {
  if (charge.order_id !== openpayOrderId(expected.attemptId)) {
    return { ok: false, code: 'REFERENCE_MISMATCH' }
  }
  if (charge.currency !== 'MXN') return { ok: false, code: 'CURRENCY_MISMATCH' }
  const cents = Math.round(charge.amount * 100)
  if (cents !== expected.totalCents) return { ok: false, code: 'AMOUNT_MISMATCH' }
  return { ok: true, normalized: normalizeOpenpayChargeStatus(charge.status) }
}
