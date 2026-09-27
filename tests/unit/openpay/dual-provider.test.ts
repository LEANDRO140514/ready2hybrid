import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyApprovedCharge, staleEventKeepsPaid } from '../../../insforge/functions/_shared/payments/apply-outcome'
import { claimPaymentAttempt, type ClaimOrder } from '../../../insforge/functions/_shared/payments/claim'
import { trustedClientIp } from '../../../insforge/functions/_shared/openpay/client-ip'
import { buildOpenpayCharge, openpayOrderId } from '../../../insforge/functions/_shared/openpay/charge'
import { OPENPAY_MAX_CHARGE_CENTS } from '../../../insforge/functions/_shared/openpay/msi'
import { openpaySandboxEnabled } from '../../../insforge/functions/_shared/openpay/gate'
import { openpayChoicesForAmount } from '../../../insforge/functions/_shared/openpay/msi'
import { normalizeOpenpayChargeStatus, openpayEventShouldFetch } from '../../../insforge/functions/_shared/openpay/status'
import { verifyOpenpayCharge } from '../../../insforge/functions/_shared/openpay/verify'
import { approvedPayment, type SalesOrder } from '../../../src/sales-dashboard/model'

const NOW = '2026-09-24T12:00:00.000Z'
const LATER = '2026-09-24T12:15:00.000Z'

function order(patch: Partial<ClaimOrder> = {}): ClaimOrder {
  return {
    state: 'PAYMENT_PENDING',
    holdState: 'ACTIVE',
    holdExpiresAt: LATER,
    payments: [],
    ...patch,
  }
}

describe('claim_payment_attempt', () => {
  it('allows one claim and blocks a second open attempt on the same order', () => {
    const current = order()
    const first = claimPaymentAttempt(current, NOW)
    expect(first.ok).toBe(true)
    current.payments.push({ normalizedState: 'PENDING' })
    expect(claimPaymentAttempt(current, NOW)).toEqual({ ok: false, code: 'ATTEMPT_OPEN' })
  })

  it('blocks a paid order, an approved payment, pending, and unknown', () => {
    expect(claimPaymentAttempt(order({ state: 'PAID' }), NOW).ok).toBe(false)
    expect(claimPaymentAttempt(order({ payments: [{ normalizedState: 'APPROVED' }] }), NOW)).toEqual({
      ok: false,
      code: 'APPROVED_EXISTS',
    })
    expect(claimPaymentAttempt(order({ payments: [{ normalizedState: 'PENDING' }] }), NOW).ok).toBe(false)
    expect(claimPaymentAttempt(order({ payments: [{ normalizedState: 'UNKNOWN' }] }), NOW)).toEqual({
      ok: false,
      code: 'ATTEMPT_OPEN',
    })
  })

  it('refuses a released or expired hold', () => {
    expect(claimPaymentAttempt(order({ holdState: 'RELEASED' }), NOW)).toEqual({
      ok: false,
      code: 'HOLD_NOT_ACTIVE',
    })
    expect(claimPaymentAttempt(order({ holdState: 'EXPIRED' }), NOW).ok).toBe(false)
    expect(claimPaymentAttempt(order({ holdExpiresAt: '2026-09-24T11:00:00.000Z' }), NOW)).toEqual({
      ok: false,
      code: 'HOLD_EXPIRED',
    })
  })

  it('treats a timeout as UNKNOWN, which keeps the other provider closed', () => {
    const current = order({ payments: [{ normalizedState: 'UNKNOWN' }] })
    expect(claimPaymentAttempt(current, NOW).ok).toBe(false)
  })
})

describe('openpay charge and verification', () => {
  const attemptId = '11111111-1111-4111-8111-111111111111'

  it('maps charge statuses and ignores the event name as financial truth', () => {
    expect(normalizeOpenpayChargeStatus('COMPLETED')).toBe('APPROVED')
    expect(normalizeOpenpayChargeStatus('IN_PROGRESS')).toBe('PENDING')
    expect(normalizeOpenpayChargeStatus('CHARGE_PENDING')).toBe('PENDING')
    expect(normalizeOpenpayChargeStatus('FAILED')).toBe('REJECTED')
    expect(normalizeOpenpayChargeStatus('CANCELLED')).toBe('CANCELLED')
    expect(normalizeOpenpayChargeStatus('REFUNDED')).toBe('REFUNDED')
    expect(normalizeOpenpayChargeStatus('CHARGEBACK_PENDING')).toBe('CHARGED_BACK')
    expect(openpayEventShouldFetch('charge.succeeded')).toBe(true)
    expect(normalizeOpenpayChargeStatus('charge.succeeded')).toBe('UNKNOWN')
  })

  it('allows 3 MSI only at or above MXN 300 and never 6, 9, 12, or 18', () => {
    expect(openpayChoicesForAmount(29_999)).toEqual([1])
    expect(openpayChoicesForAmount(30_000)).toEqual([1, 3])
    const small = buildOpenpayCharge({
      attemptId,
      totalCents: 29_999,
      installments: 3,
      sourceId: 'tok',
      deviceSessionId: 'device-session-id-32-characters',
      redirectUrl: 'https://hybrid-experience.enforma.mx/retorno',
    })
    expect(small).toEqual({ ok: false, code: 'MSI_BELOW_MINIMUM' })
    for (const term of [6, 9, 12, 18]) {
      expect(buildOpenpayCharge({
        attemptId,
        totalCents: 50_000,
        installments: term,
        sourceId: 'tok',
        deviceSessionId: 'device-session-id-32-characters',
        redirectUrl: 'https://hybrid-experience.enforma.mx/retorno',
      }).ok).toBe(false)
    }
    const three = buildOpenpayCharge({
      attemptId,
      totalCents: 30_000,
      installments: 3,
      sourceId: 'tok',
      deviceSessionId: 'device-session-id-32-characters',
      redirectUrl: 'https://hybrid-experience.enforma.mx/retorno',
    })
    expect(three.ok).toBe(true)
    if (three.ok) {
      expect(three.body.payment_plan).toEqual({ payments: 3 })
      expect(three.body.confirm).toBeUndefined()
      expect(three.body.use_3d_secure).toBe(true)
      expect(three.body.amount).toBe(300)
      expect(three.body.order_id).toBe(openpayOrderId(attemptId))
      expect(three.body.order_id).not.toBe(attemptId)
    }
    expect(buildOpenpayCharge({
      attemptId,
      totalCents: OPENPAY_MAX_CHARGE_CENTS + 1,
      installments: 1,
      sourceId: 'tok',
      deviceSessionId: 'device-session-id-32-characters',
      redirectUrl: 'https://hybrid-experience.enforma.mx/retorno',
    })).toEqual({ ok: false, code: 'AMOUNT_ABOVE_LIMIT' })
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.8', 'cf-connecting-ip': '198.51.100.10' })
    expect(trustedClientIp(headers)).toBe('198.51.100.10')
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '203.0.113.8' }))).toBeNull()
  })

  it('rejects a mismatched amount, currency, or reference, and a repeated approved apply', () => {
    const expected = { attemptId, totalCents: 30_000 }
    const base = {
      id: 'tr1',
      status: 'COMPLETED',
      amount: 300,
      currency: 'MXN',
      order_id: openpayOrderId(attemptId),
    }
    expect(verifyOpenpayCharge(base, expected).ok).toBe(true)
    expect(verifyOpenpayCharge({ ...base, amount: 299 }, expected)).toEqual({ ok: false, code: 'AMOUNT_MISMATCH' })
    expect(verifyOpenpayCharge({ ...base, currency: 'USD' }, expected)).toEqual({ ok: false, code: 'CURRENCY_MISMATCH' })
    expect(verifyOpenpayCharge({ ...base, order_id: 'other' }, expected)).toEqual({ ok: false, code: 'REFERENCE_MISMATCH' })
    expect(verifyOpenpayCharge({ ...base, status: 'FAILED' }, expected)).toMatchObject({ ok: true, normalized: 'REJECTED' })
    expect(verifyOpenpayCharge({ ...base, status: 'IN_PROGRESS' }, expected)).toMatchObject({ ok: true, normalized: 'PENDING' })
    expect(verifyOpenpayCharge({ ...base, status: 'CANCELLED' }, expected)).toMatchObject({ ok: true, normalized: 'CANCELLED' })

    const first = applyApprovedCharge('PAYMENT_PENDING')
    const second = applyApprovedCharge('PAID')
    expect(first).toMatchObject({ outcome: 'PAID', issueTicket: true, sendEmail: true, countRevenue: true })
    expect(second).toMatchObject({
      outcome: 'ALREADY_PAID',
      issueTicket: false,
      sendEmail: false,
      countRevenue: false,
    })
    expect(staleEventKeepsPaid('PAID', 'PAYMENT_PENDING')).toBe(true)
  })

  it('stays off unless sandbox and the feature flag are both set', () => {
    expect(openpaySandboxEnabled({})).toBe(false)
    expect(openpaySandboxEnabled({ OPENPAY_ENABLED: 'true' })).toBe(false)
    expect(openpaySandboxEnabled({ OPENPAY_SANDBOX: 'true' })).toBe(false)
    expect(openpaySandboxEnabled({ OPENPAY_ENABLED: 'true', OPENPAY_SANDBOX: 'true' })).toBe(true)
  })
})

describe('winning payment', () => {
  it('uses paid_payment_id instead of the latest approved attempt', () => {
    const order = {
      paidPaymentId: 'pay-openpay',
      payments: [
        { id: 'pay-mp', provider: 'MERCADOPAGO', providerPaymentId: 'mp-1', normalizedState: 'APPROVED', amountCents: 30000, providerUpdatedAt: '2026-09-24T18:00:00.000Z', createdAt: null },
        { id: 'pay-openpay', provider: 'OPENPAY', providerPaymentId: 'op-1', normalizedState: 'APPROVED', amountCents: 30000, providerUpdatedAt: '2026-09-24T12:00:00.000Z', createdAt: null },
      ],
      activity: [],
    } as unknown as SalesOrder
    expect(approvedPayment(order)?.provider).toBe('OPENPAY')
  })
})

describe('openpay endpoints stay on the sandbox host', () => {
  const charge = readFileSync('insforge/functions/openpay-create-charge/index.ts', 'utf8')
  const webhook = readFileSync('insforge/functions/openpay-webhook/index.ts', 'utf8')

  it('does not call the production API', () => {
    expect(charge).toContain('https://sandbox-api.openpay.mx')
    expect(webhook).toContain('https://sandbox-api.openpay.mx')
    expect(charge).not.toContain('https://api.openpay.mx')
    expect(webhook).not.toContain('https://api.openpay.mx')
    expect(charge).toContain('OPENPAY_DISABLED')
    expect(webhook).toContain('OPENPAY_DISABLED')
  })
})

describe('proposed claim SQL', () => {
  const sql = readFileSync('insforge/migrations/0032_dual-provider-payment-core.sql', 'utf8')

  it('locks the order and refuses paid, approved, and open attempts', () => {
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('ALREADY_PAID')
    expect(sql).toContain('APPROVED_EXISTS')
    expect(sql).toContain('ATTEMPT_OPEN')
    expect(sql).toContain('HOLD_NOT_ACTIVE')
    expect(sql).toContain('HOLD_EXPIRED')
    expect(sql).toContain("'UNKNOWN', 'PENDING'")
    expect(sql).toContain('Do not apply')
  })
})
