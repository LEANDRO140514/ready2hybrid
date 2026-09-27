import { openpayOrderId } from './charge'
import { openpayInstallmentChoice } from './msi'

export const PAYABLE_ORDER_STATES = ['CREATED', 'PREFERENCE_PENDING', 'PAYMENT_PENDING'] as const

export type OpenpayMode = 'ONE_TIME' | 'THREE_MSI'

const BROWSER_AMOUNT_KEYS = ['amount', 'amount_cents', 'total_cents', 'unit_price_cents', 'item_total_cents']
const CARD_KEYS = ['card_number', 'cvv', 'cvv2', 'pan', 'card']

export function browserSuppliedAmount(body: object): boolean {
  return BROWSER_AMOUNT_KEYS.some((key) => key in body && (body as Record<string, unknown>)[key] != null)
}

export function browserSuppliedCard(body: object): boolean {
  return CARD_KEYS.some((key) => key in body)
}

export function parsePaymentMode(input: {
  mode?: unknown
  installments?: unknown
}): { ok: true; mode: OpenpayMode; installments: 1 | 3 } | { ok: false; code: 'MODE_NOT_ALLOWED' | 'MSI_NOT_OFFERED' } {
  if (input.mode !== 'ONE_TIME' && input.mode !== 'THREE_MSI') {
    return { ok: false, code: 'MODE_NOT_ALLOWED' }
  }
  const installments = input.mode === 'THREE_MSI' ? 3 : 1
  if (input.installments != null && input.installments !== installments) {
    const choice = openpayInstallmentChoice(30_000, Number(input.installments))
    return { ok: false, code: choice.ok ? 'MODE_NOT_ALLOWED' : 'MSI_NOT_OFFERED' }
  }
  return { ok: true, mode: input.mode, installments }
}

export function readCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return null
}

export function assessOrder(order: {
  state: string
  currency: string | null
  totalCents: number
}): { ok: true } | { ok: false; code: 'ORDER_ALREADY_PAID' | 'ORDER_NOT_PAYABLE' | 'CURRENCY_MISMATCH' | 'ORDER_AMOUNT_MISMATCH' } {
  if (order.currency !== 'MXN') return { ok: false, code: 'CURRENCY_MISMATCH' }
  if (!Number.isSafeInteger(order.totalCents) || order.totalCents <= 0) {
    return { ok: false, code: 'ORDER_AMOUNT_MISMATCH' }
  }
  if (order.state === 'PAID') return { ok: false, code: 'ORDER_ALREADY_PAID' }
  if (!(PAYABLE_ORDER_STATES as readonly string[]).includes(order.state)) {
    return { ok: false, code: 'ORDER_NOT_PAYABLE' }
  }
  return { ok: true }
}

export function assessHolds(
  holds: { state: string; expiresAt: string | null }[],
  nowIso: string,
): { ok: true } | { ok: false; code: 'HOLD_NOT_CONVERTIBLE' } {
  const now = Date.parse(nowIso)
  for (const hold of holds) {
    if (hold.state === 'CONVERTED') continue
    const unexpired = hold.expiresAt == null || Date.parse(hold.expiresAt) >= now
    if (hold.state === 'ACTIVE' && unexpired) continue
    return { ok: false, code: 'HOLD_NOT_CONVERTIBLE' }
  }
  return { ok: true }
}

export function paymentPathAllowed(payments: { provider: string }[]): { ok: true } | { ok: false; code: 'PROVIDER_CONFLICT' } {
  if (payments.some((payment) => payment.provider !== 'OPENPAY')) {
    return { ok: false, code: 'PROVIDER_CONFLICT' }
  }
  return { ok: true }
}

export type AttemptRow = {
  openpayOrderRef: string
  openpayChargeId: string | null
}

export function nextAttemptAction(
  existing: AttemptRow | null,
  orderId: string,
):
  | { action: 'create_attempt'; openpayOrderRef: string }
  | { action: 'create_charge'; openpayOrderRef: string }
  | { action: 'reuse_charge'; openpayOrderRef: string; chargeId: string }
  | { action: 'ref_mismatch' } {
  const openpayOrderRef = openpayOrderId(orderId)
  if (!existing) return { action: 'create_attempt', openpayOrderRef }
  if (existing.openpayOrderRef !== openpayOrderRef) return { action: 'ref_mismatch' }
  if (existing.openpayChargeId) {
    return { action: 'reuse_charge', openpayOrderRef, chargeId: existing.openpayChargeId }
  }
  return { action: 'create_charge', openpayOrderRef }
}

export function chargeIdDecision(current: string | null, incoming: string): 'set' | 'same' | 'mismatch' {
  if (current == null || current === '') return 'set'
  if (current === incoming) return 'same'
  return 'mismatch'
}

export function safeTechnicalStatus(status: unknown): string | null {
  if (typeof status !== 'string') return null
  const trimmed = status.trim()
  if (!/^[A-Za-z0-9_]{1,64}$/.test(trimmed)) return null
  return trimmed
}

export function sandboxChargeRedirect(paymentMethod: unknown): string | null {
  if (!paymentMethod || typeof paymentMethod !== 'object' || !('url' in paymentMethod)) return null
  const url = (paymentMethod as { url?: unknown }).url
  if (typeof url !== 'string' || !url.startsWith('https://sandbox-api.openpay.mx/')) return null
  return url
}

export function shouldApplyVerified(normalized: string): boolean {
  return normalized === 'APPROVED'
}

export function shouldSendTicketEmail(outcome: string | null | undefined): boolean {
  return outcome === 'PAID'
}

export function correlationId(eventType: string, transactionId: string): string {
  return `${transactionId}:${eventType}`.slice(0, 64)
}

export function verifiedApplyPayload(input: {
  openpayOrderRef: string
  chargeId: string
  orderId: string
  amountCents: number
  externalState: string
  correlationId: string
  verifiedAt: string
}): Record<string, string | number> {
  return {
    openpay_order_ref: input.openpayOrderRef,
    openpay_charge_id: input.chargeId,
    order_id: input.orderId,
    normalized_state: 'APPROVED',
    amount_cents: input.amountCents,
    currency: 'MXN',
    verified_at: input.verifiedAt,
    external_state: input.externalState.slice(0, 64),
    correlation_id: input.correlationId.slice(0, 64),
  }
}
