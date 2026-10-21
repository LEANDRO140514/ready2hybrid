import type { NormalizedPaymentState } from './normalize'

export type TicketToRevoke = { id: string; state: string }

export type RevokeTicketResult = {
  ok: boolean
  replay?: boolean
  error_code?: string
}

export type ReversalRevokePort = {
  listTicketsForOrder: (orderId: string) => Promise<TicketToRevoke[]>
  revokeTicket: (ticketId: string) => Promise<RevokeTicketResult>
}

export function isReversalState(state: string | undefined): boolean {
  return state === 'REFUNDED' || state === 'CHARGED_BACK'
}

/**
 * After webhook_apply_payment_tx records a refund or chargeback, revoke every
 * ISSUED/REISSUED ticket on that order so the QR stops validating at check-in.
 * ticket_revoke_tx is already idempotent: a second refund is a no-op replay.
 * Never called from inside webhook_apply_payment_tx.
 */
export async function revokeTicketsAfterReversal(input: {
  orderId: string | undefined
  normalizedState: NormalizedPaymentState | string | undefined
  tickets: ReversalRevokePort
}): Promise<{ revoked: number; replayed: number; skipped: number }> {
  if (!input.orderId || !isReversalState(input.normalizedState)) {
    return { revoked: 0, replayed: 0, skipped: 0 }
  }
  const rows = await input.tickets.listTicketsForOrder(input.orderId)
  let revoked = 0
  let replayed = 0
  let skipped = 0
  for (const row of rows) {
    if (row.state !== 'ISSUED' && row.state !== 'REISSUED' && row.state !== 'REVOKED') {
      skipped += 1
      continue
    }
    const result = await input.tickets.revokeTicket(row.id)
    if (!result.ok && result.error_code === 'TICKET_NOT_REVOCABLE') {
      skipped += 1
      continue
    }
    if (!result.ok) {
      throw new Error(result.error_code ?? 'REVOKE_FAILED')
    }
    if (result.replay) replayed += 1
    else revoked += 1
  }
  return { revoked, replayed, skipped }
}
