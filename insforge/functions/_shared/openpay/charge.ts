import { OPENPAY_MAX_CHARGE_CENTS, openpayInstallmentChoice } from './msi'

export type OpenpayChargeDraft = {
  attemptId: string
  totalCents: number
  installments: number
  sourceId: string
  deviceSessionId: string
  redirectUrl: string
  customer?: { name: string; email: string; phone_number?: string }
}

/** Unique per attempt. Not the order id, so a retry cannot collide. No PII. */
export function openpayOrderId(attemptId: string): string {
  return `r2h_${attemptId.replace(/-/g, '')}`
}

export function attemptIdFromOpenpayOrderId(orderId: string): string | null {
  if (!orderId.startsWith('r2h_') || orderId.length !== 36) return null
  const hex = orderId.slice(4)
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function buildOpenpayCharge(draft: OpenpayChargeDraft):
  | { ok: false; code: 'MSI_NOT_OFFERED' | 'MSI_BELOW_MINIMUM' | 'MISSING_TOKEN' | 'MISSING_DEVICE' | 'AMOUNT_ABOVE_LIMIT' }
  | { ok: true; body: Record<string, unknown> } {
  const plan = openpayInstallmentChoice(draft.totalCents, draft.installments)
  if (!plan.ok) return plan
  if (draft.totalCents > OPENPAY_MAX_CHARGE_CENTS) return { ok: false, code: 'AMOUNT_ABOVE_LIMIT' }
  if (!draft.sourceId) return { ok: false, code: 'MISSING_TOKEN' }
  if (!draft.deviceSessionId) return { ok: false, code: 'MISSING_DEVICE' }
  const body: Record<string, unknown> = {
    method: 'card',
    source_id: draft.sourceId,
    amount: draft.totalCents / 100,
    currency: 'MXN',
    description: 'Hybrid Event Experience',
    order_id: openpayOrderId(draft.attemptId),
    device_session_id: draft.deviceSessionId,
    use_3d_secure: true,
    redirect_url: draft.redirectUrl,
  }
  if (draft.customer) body.customer = draft.customer
  if (plan.installments === 3) body.payment_plan = { payments: 3 }
  return { ok: true, body }
}
