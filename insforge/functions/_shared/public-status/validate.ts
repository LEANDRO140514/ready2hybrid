import { OrderStatusError } from './errors'

/** IMPL-7 public_order_reference / tracking_ref: trk_ + UUID hex (no hyphens). */
export const PUBLIC_ORDER_REFERENCE_PATTERN = /^trk_[0-9a-f]{32}$/

export function parsePublicOrderReference(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || !String(raw).trim()) {
    throw new OrderStatusError('INVALID_REFERENCE')
  }
  const value = String(raw).trim().toLowerCase()
  if (!PUBLIC_ORDER_REFERENCE_PATTERN.test(value)) {
    throw new OrderStatusError('INVALID_REFERENCE')
  }
  return value
}
