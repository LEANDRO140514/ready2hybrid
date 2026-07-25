import { WebhookError } from './errors'

/** Internal payment.normalized_state literals (ck_payments_normalized_state). */
export type NormalizedPaymentState =
  | 'UNKNOWN'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'CHARGED_BACK'

const MAP: Record<string, NormalizedPaymentState> = {
  approved: 'APPROVED',
  pending: 'PENDING',
  in_process: 'PENDING',
  in_mediation: 'PENDING',
  authorized: 'PENDING',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  refunded: 'REFUNDED',
  charged_back: 'CHARGED_BACK',
}

export function normalizeProviderPaymentStatus(status: string): NormalizedPaymentState {
  const key = status.trim().toLowerCase()
  const mapped = MAP[key]
  if (!mapped) return 'UNKNOWN'
  return mapped
}

export function extractPaymentTopic(queryType: string | null, body: Record<string, unknown>): string | null {
  const fromQuery = queryType?.trim().toLowerCase() || null
  const fromBodyType = typeof body.type === 'string' ? body.type.trim().toLowerCase() : null
  const fromBodyTopic = typeof body.topic === 'string' ? body.topic.trim().toLowerCase() : null
  return fromQuery || fromBodyType || fromBodyTopic
}

export function assertSupportedPaymentTopic(topic: string | null): void {
  if (!topic || topic !== 'payment') {
    throw new WebhookError('UNSUPPORTED_TOPIC')
  }
}

export function extractDataId(url: URL, body: Record<string, unknown>): string | null {
  const fromQuery = url.searchParams.get('data.id') || url.searchParams.get('id')
  if (fromQuery?.trim()) return fromQuery.trim()
  const data = body.data
  if (data && typeof data === 'object' && data !== null && 'id' in data) {
    const id = (data as { id?: unknown }).id
    if (id !== undefined && id !== null && String(id).trim()) return String(id).trim()
  }
  return null
}

/** Rank for monotonic payment state updates (higher wins; equal is idempotent). */
export function paymentStateRank(state: NormalizedPaymentState): number {
  switch (state) {
    case 'UNKNOWN':
      return 0
    case 'PENDING':
      return 1
    case 'REJECTED':
    case 'CANCELLED':
      return 2
    case 'APPROVED':
      return 3
    case 'REFUNDED':
    case 'CHARGED_BACK':
      return 4
    default:
      return 0
  }
}
