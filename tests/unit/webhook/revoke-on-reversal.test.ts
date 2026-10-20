import { describe, expect, it } from 'vitest'
import {
  isReversalState,
  revokeTicketsAfterReversal,
  type TicketToRevoke,
} from '../../../insforge/functions/_shared/webhook/revoke-on-reversal'

function port(rows: TicketToRevoke[], revoke: (id: string) => { ok: boolean; replay?: boolean; error_code?: string }) {
  const revoked: string[] = []
  return {
    revoked,
    tickets: {
      async listTicketsForOrder() {
        return rows
      },
      async revokeTicket(ticketId: string) {
        revoked.push(ticketId)
        return revoke(ticketId)
      },
    },
  }
}

describe('revokeTicketsAfterReversal', () => {
  it('revokes ISSUED tickets on refunded', async () => {
    const { tickets, revoked } = port(
      [{ id: 't1', state: 'ISSUED' }],
      () => ({ ok: true, replay: false }),
    )
    const result = await revokeTicketsAfterReversal({
      orderId: 'o1',
      normalizedState: 'REFUNDED',
      tickets,
    })
    expect(revoked).toEqual(['t1'])
    expect(result).toEqual({ revoked: 1, replayed: 0, skipped: 0 })
  })

  it('revokes REISSUED tickets on charged_back', async () => {
    const { tickets, revoked } = port(
      [{ id: 't2', state: 'REISSUED' }],
      () => ({ ok: true, replay: false }),
    )
    const result = await revokeTicketsAfterReversal({
      orderId: 'o1',
      normalizedState: 'CHARGED_BACK',
      tickets,
    })
    expect(revoked).toEqual(['t2'])
    expect(result.revoked).toBe(1)
  })

  it('a repeated refund is a no-op replay', async () => {
    const { tickets, revoked } = port(
      [{ id: 't1', state: 'REVOKED' }],
      () => ({ ok: true, replay: true }),
    )
    const first = await revokeTicketsAfterReversal({
      orderId: 'o1',
      normalizedState: 'REFUNDED',
      tickets,
    })
    const second = await revokeTicketsAfterReversal({
      orderId: 'o1',
      normalizedState: 'REFUNDED',
      tickets,
    })
    expect(revoked).toEqual(['t1', 't1'])
    expect(first.replayed).toBe(1)
    expect(second.replayed).toBe(1)
    expect(first.revoked).toBe(0)
    expect(second.revoked).toBe(0)
  })

  it('does nothing on approved', async () => {
    const { tickets, revoked } = port(
      [{ id: 't1', state: 'ISSUED' }],
      () => ({ ok: true }),
    )
    const result = await revokeTicketsAfterReversal({
      orderId: 'o1',
      normalizedState: 'APPROVED',
      tickets,
    })
    expect(revoked).toEqual([])
    expect(result.revoked).toBe(0)
  })
})

describe('isReversalState', () => {
  it('is true only for refund and chargeback', () => {
    expect(isReversalState('REFUNDED')).toBe(true)
    expect(isReversalState('CHARGED_BACK')).toBe(true)
    expect(isReversalState('APPROVED')).toBe(false)
    expect(isReversalState('PENDING')).toBe(false)
  })
})
