/**
 * Public projection per SPEC-031 OP-PUB-05 / Appendix A.5.
 * Internal states from ck_orders_state (migration 0002).
 */

export type InternalOrderState =
  | 'CREATED'
  | 'PREFERENCE_PENDING'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REQUIRES_REVIEW'
  | 'REFUNDED'
  | 'CHARGED_BACK'

/** SPEC-031 public order states (not the IMPL prompt shorthand). */
export type PublicOrderStatus =
  | 'CREATING'
  | 'AWAITING_PAYMENT'
  | 'CONFIRMING'
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REQUIRES_ACTION'
  | 'REFUNDED'
  | 'CHARGED_BACK'

export type PublicOrderProjection = {
  status: PublicOrderStatus
  terminal: boolean
  next_poll_after_seconds: number | null
}

const INTERNAL_TO_PUBLIC: Record<InternalOrderState, PublicOrderStatus> = {
  CREATED: 'CREATING',
  PREFERENCE_PENDING: 'AWAITING_PAYMENT',
  PAYMENT_PENDING: 'AWAITING_PAYMENT',
  PAID: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  REQUIRES_REVIEW: 'REQUIRES_ACTION',
  REFUNDED: 'REFUNDED',
  CHARGED_BACK: 'CHARGED_BACK',
}

/** Payment-confirmation UX: stop polling when payment outcome is settled. */
const TERMINAL_PUBLIC: ReadonlySet<PublicOrderStatus> = new Set([
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'CHARGED_BACK',
])

export function isKnownInternalOrderState(state: string): state is InternalOrderState {
  return Object.prototype.hasOwnProperty.call(INTERNAL_TO_PUBLIC, state)
}

export function projectPublicOrderStatus(
  internalState: string,
  pollSeconds: number,
): PublicOrderProjection {
  if (!isKnownInternalOrderState(internalState)) {
    // Fail-closed: unknown internal state must not look confirmed.
    return {
      status: 'REQUIRES_ACTION',
      terminal: false,
      next_poll_after_seconds: pollSeconds,
    }
  }

  const status = INTERNAL_TO_PUBLIC[internalState]
  const terminal = TERMINAL_PUBLIC.has(status)
  return {
    status,
    terminal,
    next_poll_after_seconds: terminal ? null : pollSeconds,
  }
}
