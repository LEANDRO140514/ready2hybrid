import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assessHolds,
  assessOrder,
  browserSuppliedAmount,
  browserSuppliedCard,
  chargeIdDecision,
  nextAttemptAction,
  parsePaymentMode,
  paymentPathAllowed,
  sandboxChargeRedirect,
  shouldApplyVerified,
  shouldSendTicketEmail,
  verifiedApplyPayload,
} from '../../../insforge/functions/_shared/openpay/attempt'
import { buildOpenpayCharge, openpayOrderId } from '../../../insforge/functions/_shared/openpay/charge'
import { trustedClientIp } from '../../../insforge/functions/_shared/openpay/client-ip'
import { verifyOpenpayCharge } from '../../../insforge/functions/_shared/openpay/verify'
import { basicAuthMatches } from '../../../insforge/functions/_shared/openpay/webhook-auth'

const ORDER_ID = '292eab4e-3957-4811-a9d0-5248de4633eb'
const DEVICE = 'device-session-id-32-characters'
const NOW = '2026-09-26T08:00:00.000Z'

function chargeDraft(installments: number, totalCents = 90_000) {
  return buildOpenpayCharge({
    attemptId: ORDER_ID,
    totalCents,
    installments,
    sourceId: 'tok_test',
    deviceSessionId: DEVICE,
    redirectUrl: 'https://example.invalid/retorno',
    customer: { name: 'Sandbox Buyer', email: 'buyer@example.invalid', phone_number: '5550000000' },
  })
}

describe('openpay 0037 create-charge decisions', () => {
  it('uses the server amount, requires MXN, and rejects a browser amount or card', () => {
    expect(browserSuppliedAmount({ amount: 1 })).toBe(true)
    expect(browserSuppliedAmount({ order_id: ORDER_ID, mode: 'ONE_TIME' })).toBe(false)
    expect(browserSuppliedCard({ pan: '4111111111111111' })).toBe(true)
    expect(assessOrder({ state: 'PREFERENCE_PENDING', currency: 'USD', totalCents: 90_000 })).toEqual({
      ok: false,
      code: 'CURRENCY_MISMATCH',
    })
    expect(assessOrder({ state: 'PREFERENCE_PENDING', currency: 'MXN', totalCents: 90_000 })).toEqual({ ok: true })
    const oneTime = chargeDraft(1)
    expect(oneTime.ok).toBe(true)
    if (oneTime.ok) {
      expect(oneTime.body.amount).toBe(900)
      expect(oneTime.body.currency).toBe('MXN')
      expect(oneTime.body.payment_plan).toBeUndefined()
      expect(oneTime.body.use_3d_secure).toBe(true)
      expect(oneTime.body.device_session_id).toBe(DEVICE)
      expect(oneTime.body.order_id).toBe(openpayOrderId(ORDER_ID))
    }
  })

  it('sends exactly three payments for THREE_MSI and rejects a charge below MXN 300', () => {
    expect(parsePaymentMode({ mode: 'THREE_MSI' })).toEqual({ ok: true, mode: 'THREE_MSI', installments: 3 })
    expect(parsePaymentMode({ mode: 'ONE_TIME' })).toEqual({ ok: true, mode: 'ONE_TIME', installments: 1 })
    expect(parsePaymentMode({ mode: 'SIX_MSI' }).ok).toBe(false)
    expect(parsePaymentMode({ mode: 'THREE_MSI', installments: 12 })).toEqual({ ok: false, code: 'MSI_NOT_OFFERED' })
    const three = chargeDraft(3)
    expect(three.ok).toBe(true)
    if (three.ok) expect(three.body.payment_plan).toEqual({ payments: 3 })
    expect(chargeDraft(3, 29_999)).toEqual({ ok: false, code: 'MSI_BELOW_MINIMUM' })
    expect(buildOpenpayCharge({
      attemptId: ORDER_ID,
      totalCents: 90_000,
      installments: 1,
      sourceId: 'tok_test',
      deviceSessionId: '',
      redirectUrl: 'https://example.invalid/retorno',
    })).toEqual({ ok: false, code: 'MISSING_DEVICE' })
  })

  it('keeps one stable order reference and does not open a second charge', () => {
    const ref = openpayOrderId(ORDER_ID)
    expect(nextAttemptAction(null, ORDER_ID)).toEqual({ action: 'create_attempt', openpayOrderRef: ref })
    expect(nextAttemptAction({ openpayOrderRef: ref, openpayChargeId: null }, ORDER_ID)).toEqual({
      action: 'create_charge',
      openpayOrderRef: ref,
    })
    expect(nextAttemptAction({ openpayOrderRef: ref, openpayChargeId: 'tr_existing' }, ORDER_ID)).toEqual({
      action: 'reuse_charge',
      openpayOrderRef: ref,
      chargeId: 'tr_existing',
    })
    expect(chargeIdDecision(null, 'tr_existing')).toBe('set')
    expect(chargeIdDecision('tr_existing', 'tr_existing')).toBe('same')
    expect(chargeIdDecision('tr_existing', 'tr_other')).toBe('mismatch')
  })

  it('refuses a Mercado Pago payment and an unconvertible hold before a charge starts', () => {
    expect(paymentPathAllowed([{ provider: 'MERCADOPAGO' }])).toEqual({ ok: false, code: 'PROVIDER_CONFLICT' })
    expect(paymentPathAllowed([])).toEqual({ ok: true })
    expect(assessHolds([{ state: 'ACTIVE', expiresAt: '2026-09-26T09:00:00.000Z' }], NOW)).toEqual({ ok: true })
    expect(assessHolds([{ state: 'EXPIRED', expiresAt: null }], NOW)).toEqual({
      ok: false,
      code: 'HOLD_NOT_CONVERTIBLE',
    })
    expect(trustedClientIp(new Headers({ 'cf-connecting-ip': '198.51.100.10', 'x-real-ip': '203.0.113.9' }))).toBe('198.51.100.10')
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '203.0.113.8' }))).toBeNull()
  })

  it('returns only a sandbox 3DS redirect from the provider response', () => {
    expect(sandboxChargeRedirect({ url: 'https://sandbox-api.openpay.mx/v1/charges/redirect' })).toBe(
      'https://sandbox-api.openpay.mx/v1/charges/redirect',
    )
    expect(sandboxChargeRedirect({ url: 'https://api.openpay.mx/v1/charges/redirect' })).toBeNull()
    expect(sandboxChargeRedirect({ url: 'https://evil.example/paid?status=paid' })).toBeNull()
  })
})

describe('openpay 0037 verification and webhook decisions', () => {
  const charge = {
    id: 'tr_verified',
    status: 'COMPLETED',
    amount: 900,
    currency: 'MXN',
    order_id: openpayOrderId(ORDER_ID),
  }

  it('requires webhook basic auth and does not treat the payload as payment truth', () => {
    const header = `Basic ${btoa('hook-user:hook-secret')}`
    expect(basicAuthMatches(header, 'hook-user', 'hook-secret')).toBe(true)
    expect(basicAuthMatches(header, 'hook-user', 'wrong')).toBe(false)
    expect(basicAuthMatches(null, 'hook-user', 'hook-secret')).toBe(false)
    expect(shouldApplyVerified('APPROVED')).toBe(true)
    expect(shouldApplyVerified('PENDING')).toBe(false)
    expect(shouldApplyVerified('REJECTED')).toBe(false)
    expect(shouldApplyVerified('CANCELLED')).toBe(false)
    expect(shouldSendTicketEmail('PAID')).toBe(true)
    expect(shouldSendTicketEmail('ALREADY_PAID')).toBe(false)
  })

  it('rejects amount and currency mismatches and builds an approved apply payload from server cents', () => {
    expect(verifyOpenpayCharge(charge, { attemptId: ORDER_ID, totalCents: 90_000 })).toMatchObject({
      ok: true,
      normalized: 'APPROVED',
    })
    expect(verifyOpenpayCharge({ ...charge, amount: 1 }, { attemptId: ORDER_ID, totalCents: 90_000 })).toEqual({
      ok: false,
      code: 'AMOUNT_MISMATCH',
    })
    expect(verifyOpenpayCharge({ ...charge, currency: 'USD' }, { attemptId: ORDER_ID, totalCents: 90_000 })).toEqual({
      ok: false,
      code: 'CURRENCY_MISMATCH',
    })
    expect(verifyOpenpayCharge({ ...charge, status: 'FAILED' }, { attemptId: ORDER_ID, totalCents: 90_000 })).toMatchObject({
      normalized: 'REJECTED',
    })
    const payload = verifiedApplyPayload({
      openpayOrderRef: openpayOrderId(ORDER_ID),
      chargeId: 'tr_verified',
      orderId: ORDER_ID,
      amountCents: 90_000,
      externalState: 'COMPLETED',
      correlationId: 'tr_verified:charge.succeeded',
      verifiedAt: NOW,
    })
    expect(payload.normalized_state).toBe('APPROVED')
    expect(payload.amount_cents).toBe(90_000)
    expect(payload.currency).toBe('MXN')
    expect(payload).not.toHaveProperty('pan')
    expect(payload).not.toHaveProperty('cvv')
  })
})

describe('openpay runtime no longer uses the 0032 contract', () => {
  const create = readFileSync('insforge/functions/openpay-create-charge/index.ts', 'utf8')
  const webhook = readFileSync('insforge/functions/openpay-webhook/index.ts', 'utf8')
  const mercadoPago = readFileSync('insforge/functions/mp-webhook/index.ts', 'utf8')

  it('persists attempts, verifies with GET, and leaves Mercado Pago on its own function', () => {
    expect(create).not.toContain('claim_payment_attempt')
    expect(create).toContain('openpay_payment_attempts')
    expect(create.indexOf("body.intent === 'preview'")).toBeGreaterThan(0)
    expect(create.indexOf("body.intent === 'preview'")).toBeLessThan(create.indexOf("from('openpay_payment_attempts').insert"))
    expect(create).toContain("'X-Forwarded-For': clientIp")
    expect(create).not.toContain('webhook_apply_payment_tx')
    expect(webhook).not.toContain('webhook_apply_payment_tx')
    expect(webhook).not.toContain('claim_payment_attempt')
    expect(webhook).toContain('openpay_apply_verified_charge')
    expect(webhook.indexOf('fetch(')).toBeLessThan(webhook.indexOf('openpay_apply_verified_charge'))
    expect(webhook.indexOf('basicAuthMatches')).toBeLessThan(webhook.indexOf('req.json'))
    expect(webhook).toContain("shouldSendTicketEmail(row.outcome)")
    expect(mercadoPago).toContain('webhook_apply_payment_tx')
    expect(mercadoPago).not.toContain('openpay_apply_verified_charge')
  })

  it('keeps the sandbox page on the real order path and off private secrets', () => {
    const page = readFileSync('insforge/functions/openpay-e2e-page/index.ts', 'utf8')
    expect(page).toContain('Pago de contado')
    expect(page).toContain('3 meses sin intereses')
    expect(page).toContain('Estamos verificando tu pago.')
    expect(page).toContain('/functions/openpay-create-charge')
    expect(page).not.toContain('openpay-cert-create-charge')
    expect(page).not.toContain('openpay_apply_verified_charge')
    expect(page).not.toContain('OPENPAY_PRIVATE_KEY')
    expect(page).not.toContain('OPENPAY_WEBHOOK_PASSWORD')
    expect(page).not.toContain('TICKET_OPERATOR_BEARER')
    expect(page).not.toContain('6 meses')
    expect(page).not.toContain('amount_cents')
    expect(page).toContain('source_id: sourceId')
    expect(page).toContain('device_session_id: deviceSessionId')
  })
})
