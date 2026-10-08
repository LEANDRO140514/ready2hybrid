/** Charge status and webhook events stay in separate namespaces. */

export type NormalizedPaymentState =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'CHARGED_BACK'
  | 'UNKNOWN'

const CHARGE_STATUS: Record<string, NormalizedPaymentState> = {
  COMPLETED: 'APPROVED',
  IN_PROGRESS: 'PENDING',
  CHARGE_PENDING: 'PENDING',
  FAILED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  CHARGEBACK_PENDING: 'CHARGED_BACK',
  CHARGEBACK_ACCEPTED: 'CHARGED_BACK',
  CHARGEBACK_ADJUSTMENT: 'CHARGED_BACK',
}

export const OPENPAY_WEBHOOK_EVENTS = [
  'charge.succeeded',
  'charge.failed',
  'charge.cancelled',
  'charge.refunded',
  'charge.rescored.to.decline',
  'chargeback.created',
  'chargeback.rejected',
  'chargeback.accepted',
] as const

export function normalizeOpenpayChargeStatus(status: string): NormalizedPaymentState {
  if (typeof status !== 'string') return 'UNKNOWN'
  return CHARGE_STATUS[status.trim().toUpperCase()] ?? 'UNKNOWN'
}

export function openpayEventShouldFetch(eventType: string): boolean {
  return (OPENPAY_WEBHOOK_EVENTS as readonly string[]).includes(eventType)
}
