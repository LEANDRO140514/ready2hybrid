import { isNormalizedPaymentStatus, type NormalizedPaymentStatus } from '../payments/status'

/**
 * SPEC-041-R031 Clip Checkout Redirect mapping after authoritative GET.
 * Webhook resource_status aliases are included only for normalizeStatus;
 * they never grant financial authority by themselves.
 */
const CLIP_STATUS_MAP: Readonly<Record<string, NormalizedPaymentStatus>> = {
  CHECKOUT_CREATED: 'PENDING',
  CREATED: 'PENDING',
  CHECKOUT_PENDING: 'PENDING',
  PENDING: 'PENDING',
  CHECKOUT_COMPLETED: 'APPROVED',
  COMPLETED: 'APPROVED',
  CHECKOUT_CANCELLED: 'CANCELLED',
  CHECKOUT_CANCELED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED',
  CHECKOUT_EXPIRED: 'CANCELLED',
  EXPIRED: 'CANCELLED',
}

export function normalizeClipCheckoutStatus(rawStatus: string): NormalizedPaymentStatus {
  const key = rawStatus.trim().toUpperCase()
  const mapped = CLIP_STATUS_MAP[key]
  if (mapped && isNormalizedPaymentStatus(mapped)) return mapped
  return 'UNKNOWN'
}
