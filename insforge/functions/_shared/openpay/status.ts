import { isNormalizedPaymentStatus, type NormalizedPaymentStatus } from '../payments/status'

/**
 * SPEC-041-R031 Openpay charge mapping after authoritative GET.
 * Webhook event aliases are included only for normalizeStatus;
 * they never grant financial authority by themselves.
 */
const OPENPAY_STATUS_MAP: Readonly<Record<string, NormalizedPaymentStatus>> = {
  completed: 'APPROVED',
  'charge.succeeded': 'APPROVED',
  in_progress: 'PENDING',
  'charge.created': 'PENDING',
  charge_pending: 'PENDING',
  failed: 'REJECTED',
  'charge.failed': 'REJECTED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  'charge.cancelled': 'CANCELLED',
  refunded: 'REFUNDED',
  'charge.refunded': 'REFUNDED',
  'chargeback.accepted': 'CHARGED_BACK',
  chargeback_accepted: 'CHARGED_BACK',
}

export function normalizeOpenpayChargeStatus(rawStatus: string): NormalizedPaymentStatus {
  const key = rawStatus.trim().toLowerCase()
  const mapped = OPENPAY_STATUS_MAP[key]
  if (mapped && isNormalizedPaymentStatus(mapped)) return mapped
  return 'UNKNOWN'
}
