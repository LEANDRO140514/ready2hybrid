import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { claimPaymentAttempt } from '../../../insforge/functions/_shared/payments/claim'
import { approvedPayment, anomaliesFor, type SalesOrder } from '../../../src/sales-dashboard/model'

const sql = readFileSync('insforge/migrations/0032_dual-provider-payment-core.sql', 'utf8')
const apply = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx'))

describe('0032 candidate', () => {
  it('fails closed on an unknown provider and defaults a missing one to Mercado Pago', () => {
    expect(apply).toContain("COALESCE(NULLIF(btrim(p->>'provider'), ''), 'MERCADOPAGO')")
    expect(apply).toContain("'UNKNOWN_PROVIDER'")
    expect(apply.includes("v_provider text := 'MERCADOPAGO'")).toBe(false)
  })

  it('keeps the Mercado Pago effects and does not release the hold on a terminal miss', () => {
    expect(apply).toContain('PERFORM public.team_apply_payment_outcome')
    expect(apply).toContain('PERFORM public.ticket_issue_after_payment')
    expect(apply).toContain("'REQUIRES_REVIEW'")
    expect(apply).toContain("'ALREADY_PAID'")
    expect(apply).toContain('PAYMENT_REQUIRES_REVIEW')
    expect(apply).toContain('paid_payment_id')
    const rejected = apply.slice(apply.indexOf("ELSIF v_payment_target IN ('REJECTED', 'CANCELLED')"))
    expect(rejected.slice(0, 700)).not.toContain("v_hold_target := 'RELEASED'")
    expect(rejected.slice(0, 700)).toContain("v_order_target := 'PAYMENT_PENDING'")
  })

  it('guards the partial index with a preflight that does not change rows', () => {
    expect(sql).toContain('uq_payments_one_open_attempt')
    expect(sql).toContain('active payment attempt conflicts, no data changed')
    expect(sql.indexOf('active payment attempt conflicts')).toBeLessThan(sql.indexOf('ADD COLUMN paid_payment_id'))
  })
})

describe('claim and winner', () => {
  const now = '2026-09-24T12:00:00.000Z'
  const base = {
    state: 'PAYMENT_PENDING',
    holdState: 'ACTIVE',
    holdExpiresAt: '2026-09-24T12:15:00.000Z',
    payments: [] as { id?: string; provider?: string; normalizedState: string }[],
  }

  it('reuses the same provider attempt and blocks the other while UNKNOWN', () => {
    const order = {
      ...base,
      payments: [{ id: 'a', provider: 'MERCADOPAGO', normalizedState: 'UNKNOWN' }],
    }
    expect(claimPaymentAttempt(order, now, 'MERCADOPAGO')).toMatchObject({ ok: true, reused: true, attemptId: 'a' })
    expect(claimPaymentAttempt(order, now, 'OPENPAY')).toEqual({ ok: false, code: 'ATTEMPT_OPEN' })
  })

  it('does not guess a winner when several approved payments exist', () => {
    const order = {
      id: 'o',
      state: 'PAID',
      totalCents: 30000,
      updatedAt: now,
      payments: [
        { id: 'mp', provider: 'MERCADOPAGO', providerPaymentId: '1', normalizedState: 'APPROVED', amountCents: 30000, providerUpdatedAt: now, createdAt: null },
        { id: 'op', provider: 'OPENPAY', providerPaymentId: '2', normalizedState: 'APPROVED', amountCents: 30000, providerUpdatedAt: now, createdAt: null },
      ],
      activity: [],
      tickets: [],
      expiresAt: null,
      verifications: [],
    } as unknown as SalesOrder
    expect(approvedPayment(order)).toBeNull()
    expect(anomaliesFor(order, Date.parse(now)).map((row) => row.type)).toContain('Proveedor ganador no determinado')
  })

  it('uses paid_payment_id and otherwise the only approved payment', () => {
    const winner = {
      id: 'o',
      state: 'PAID',
      totalCents: 30000,
      updatedAt: now,
      paidPaymentId: 'op',
      payments: [
        { id: 'mp', provider: 'MERCADOPAGO', providerPaymentId: '1', normalizedState: 'REJECTED', amountCents: 30000, providerUpdatedAt: now, createdAt: null },
        { id: 'op', provider: 'OPENPAY', providerPaymentId: '2', normalizedState: 'APPROVED', amountCents: 30000, providerUpdatedAt: now, createdAt: null },
      ],
      activity: [],
      tickets: [{ issuedAt: now }],
      expiresAt: null,
      verifications: [],
    } as unknown as SalesOrder
    expect(approvedPayment(winner)?.provider).toBe('OPENPAY')
    const legacy = {
      ...winner,
      paidPaymentId: null,
      payments: [winner.payments[1]],
    } as SalesOrder
    expect(approvedPayment(legacy)?.id).toBe('op')
  })
})
