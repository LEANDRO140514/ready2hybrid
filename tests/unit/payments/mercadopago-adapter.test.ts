import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMockPaymentClient } from '../../../insforge/functions/_shared/mercadopago/payments'
import {
  buildManifest,
  normalizeDataId,
} from '../../../insforge/functions/_shared/mercadopago/signature'
import {
  PaymentContractError,
  correspondFinancially,
  createMercadoPagoPaymentAdapter,
  decidePaidSemanticsFromPayment,
  decidePaidSemanticsFromRedirect,
  decidePaidSemanticsFromVerifiedEvent,
  fromMercadoPagoStorageId,
  MERCADO_PAGO_STORAGE_ID,
  parseResolvedPaymentCheckoutInput,
  toMercadoPagoStorageId,
} from '../../../insforge/functions/_shared/payments'
import type {
  MercadoPagoPreferencePort,
  MercadoPagoPreferencePortInput,
} from '../../../insforge/functions/_shared/payments'
import type { ResolvedPaymentCheckoutInput } from '../../../insforge/functions/_shared/payments'

const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TEST_SECRET = 'test_webhook_secret_not_real'
const ACCESS_TOKEN = 'TEST_ACCESS_TOKEN_NOT_REAL'
const ADAPTER_SRC = resolve(process.cwd(), 'insforge/functions/_shared/payments/mercadopago-adapter.ts')

function sign(dataId: string, requestId: string, ts = '1704908010'): string {
  const manifest = buildManifest(normalizeDataId(dataId), requestId, ts)
  const v1 = createHmac('sha256', TEST_SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function resolvedCheckout(overrides: Partial<ResolvedPaymentCheckoutInput> = {}): ResolvedPaymentCheckoutInput {
  return parseResolvedPaymentCheckoutInput({
    eligibility: 'PAYMENT_ELIGIBLE',
    orderId: ORDER_ID,
    provider: 'MERCADO_PAGO',
    amountCents: 140000,
    currency: 'MXN',
    reference: 'R2H-MP-1',
    description: 'Ready2Hybrid checkout',
    returnUrls: {
      success: 'https://app.test/success',
      failure: 'https://app.test/failure',
      pending: 'https://app.test/pending',
    },
    ...overrides,
  })
}

function spyPreferences(): MercadoPagoPreferencePort & { calls: MercadoPagoPreferencePortInput[] } {
  const calls: MercadoPagoPreferencePortInput[] = []
  return {
    calls,
    async createCheckoutProPreference(input) {
      calls.push(input)
      return { preferenceId: 'pref-1', initPoint: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-1' }
    },
  }
}

function adapterWith(
  preferences: MercadoPagoPreferencePort,
  payments = createMockPaymentClient(),
) {
  return createMercadoPagoPaymentAdapter({
    preferences,
    payments,
    getAccessToken: () => ACCESS_TOKEN,
    getWebhookSecret: () => TEST_SECRET,
  })
}

describe('MULTI-PAY-4 Mercado Pago adapter identity and storage mapping', () => {
  it('identifies as MERCADO_PAGO and maps storage id mercadopago explicitly', () => {
    const adapter = adapterWith(spyPreferences())
    expect(adapter.provider).toBe('MERCADO_PAGO')
    expect(MERCADO_PAGO_STORAGE_ID).toBe('mercadopago')
    expect(toMercadoPagoStorageId('MERCADO_PAGO')).toBe('mercadopago')
    expect(fromMercadoPagoStorageId('mercadopago')).toBe('MERCADO_PAGO')
  })

  it('fails closed on unknown storage/provider mapping', () => {
    expect(() => toMercadoPagoStorageId('CLIP')).toThrow(PaymentContractError)
    expect(() => toMercadoPagoStorageId('OPENPAY')).toThrow(PaymentContractError)
    expect(() => fromMercadoPagoStorageId('clip')).toThrow(PaymentContractError)
    expect(() => fromMercadoPagoStorageId('MERCADO_PAGO')).toThrow(PaymentContractError)
    expect(() => fromMercadoPagoStorageId('paypal')).toThrow(PaymentContractError)
  })
})

describe('MULTI-PAY-4 createCheckout reuses existing MP checkout seam', () => {
  it('delegates amount, currency, and order reference unchanged and remains non-authoritative', async () => {
    const preferences = spyPreferences()
    const adapter = adapterWith(preferences)
    const input = resolvedCheckout()
    const checkout = await adapter.createCheckout(input)

    expect(preferences.calls).toHaveLength(1)
    expect(preferences.calls[0]?.orderId).toBe(ORDER_ID)
    expect(preferences.calls[0]?.amountCents).toBe(140000)
    expect(preferences.calls[0]?.currency).toBe('MXN')
    expect(preferences.calls[0]?.backUrls).toEqual(input.returnUrls)
    expect(checkout.provider).toBe('MERCADO_PAGO')
    expect(checkout.checkoutHandle).toBe('pref-1')
    expect(checkout.redirectUrl).toContain('mercadopago')
    expect(checkout.financialAuthority).toBe(false)
    expect(decidePaidSemanticsFromRedirect(checkout)).toEqual({
      paidSemantics: false,
      source: 'redirect',
    })
  })

  it('does not treat redirect as eligible_for_domain_tx', async () => {
    const checkout = await adapterWith(spyPreferences()).createCheckout(resolvedCheckout())
    expect(decidePaidSemanticsFromRedirect(checkout).paidSemantics).toBe(false)
  })
})

describe('MULTI-PAY-4 verifyEvent reuses existing x-signature seam', () => {
  it('accepts a valid MP signature as a non-financial handle', async () => {
    const dataId = '999888777'
    const requestId = 'req-mp-1'
    const adapter = adapterWith(spyPreferences())
    const event = await adapter.verifyEvent({
      provider: 'MERCADO_PAGO',
      authenticity: {
        mechanism: 'x-signature',
        xSignature: sign(dataId, requestId),
        xRequestId: requestId,
        dataId,
      },
      eventId: 'evt-1',
      transactionHandle: dataId,
    })
    expect(event.authenticity).toBe('accepted')
    expect(event.financialAuthority).toBe(false)
    expect(event.transactionHandle).toBe(dataId)
    expect(event).not.toHaveProperty('normalizedStatus')
    expect(decidePaidSemanticsFromVerifiedEvent(event)).toEqual({
      paidSemantics: false,
      source: 'verified_event',
    })
  })

  it('rejects invalid signatures and foreign provider events', async () => {
    const adapter = adapterWith(spyPreferences())
    await expect(
      adapter.verifyEvent({
        provider: 'MERCADO_PAGO',
        authenticity: {
          mechanism: 'x-signature',
          xSignature: 'ts=1704908010,v1=0000000000000000000000000000000000000000000000000000000000000000',
          xRequestId: 'req-1',
          dataId: '1',
        },
        eventId: 'evt',
        transactionHandle: '1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })

    await expect(
      adapter.verifyEvent({
        provider: 'CLIP',
        authenticity: { mechanism: 'event_handle' },
        eventId: 'evt',
        transactionHandle: 'pay',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
  })

  it('cannot produce eligible_for_domain_tx from event evidence alone', async () => {
    const adapter = adapterWith(spyPreferences())
    const event = await adapter.verifyEvent({
      provider: 'MERCADO_PAGO',
      authenticity: {
        mechanism: 'x-signature',
        xSignature: sign('1', 'r1'),
        xRequestId: 'r1',
        dataId: '1',
      },
      eventId: 'evt',
      transactionHandle: '1',
    })
    expect(decidePaidSemanticsFromVerifiedEvent(event).paidSemantics).toBe(false)
  })
})

describe('MULTI-PAY-4 getPayment reuses existing MP GET and normalize', () => {
  it('preserves transaction id, external_reference, amount, currency, and APPROVED mapping', async () => {
    const payments = createMockPaymentClient(async () => ({
      id: 'pay-77',
      status: 'approved',
      external_reference: ORDER_ID,
      transaction_amount: 1400,
      currency_id: 'MXN',
    }))
    const adapter = adapterWith(spyPreferences(), payments)
    const payment = await adapter.getPayment('pay-77')
    expect(payment.provider).toBe('MERCADO_PAGO')
    expect(payment.providerTransactionId).toBe('pay-77')
    expect(payment.orderCorrelation).toBe(ORDER_ID)
    expect(payment.amountCents).toBe(140000)
    expect(payment.currency).toBe('MXN')
    expect(payment.normalizedStatus).toBe('APPROVED')
    expect(adapter.normalizeStatus('approved')).toBe('APPROVED')
  })

  it('maps unknown MP status to UNKNOWN', async () => {
    const adapter = adapterWith(spyPreferences())
    expect(adapter.normalizeStatus('totally_unknown_mp_status')).toBe('UNKNOWN')
  })

  it('fails closed on blank transaction id from provider payload', async () => {
    const payments = createMockPaymentClient(async () => ({
      id: '   ',
      status: 'approved',
      external_reference: ORDER_ID,
      transaction_amount: 1400,
      currency_id: 'MXN',
    }))
    await expect(adapterWith(spyPreferences(), payments).getPayment('pay-77')).rejects.toMatchObject({
      code: 'FINANCIAL_RESOLUTION_FAILURE',
    })
  })
})

describe('MULTI-PAY-4 financial correspondence', () => {
  const expected = {
    provider: 'MERCADO_PAGO' as const,
    orderId: ORDER_ID,
    amountCents: 140000,
    currency: 'MXN' as const,
  }

  it('allows eligible_for_domain_tx only after authoritative APPROVED correspondence', async () => {
    const payments = createMockPaymentClient(async () => ({
      id: 'pay-ok',
      status: 'approved',
      external_reference: ORDER_ID,
      transaction_amount: 1400,
      currency_id: 'MXN',
    }))
    const payment = await adapterWith(spyPreferences(), payments).getPayment('pay-ok')
    expect(correspondFinancially(expected, payment)).toEqual({ ok: true })
    expect(decidePaidSemanticsFromPayment(expected, payment)).toEqual({
      paidSemantics: 'eligible_for_domain_tx',
      source: 'financial_resolution',
      normalizedStatus: 'APPROVED',
    })
  })

  it('fails closed on amount, currency, provider, and correlation mismatch', async () => {
    const payments = createMockPaymentClient(async () => ({
      id: 'pay-ok',
      status: 'approved',
      external_reference: ORDER_ID,
      transaction_amount: 1400,
      currency_id: 'MXN',
    }))
    const payment = await adapterWith(spyPreferences(), payments).getPayment('pay-ok')
    expect(decidePaidSemanticsFromPayment({ ...expected, amountCents: 1 }, payment)).toMatchObject({
      paidSemantics: false,
      reason: 'AMOUNT_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment({ ...expected, currency: 'MXN' }, { ...payment, currency: 'USD' })).toMatchObject({
      paidSemantics: false,
      reason: 'CURRENCY_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment({ ...expected, provider: 'CLIP' }, payment)).toMatchObject({
      paidSemantics: false,
      reason: 'PROVIDER_MISMATCH',
    })
    expect(
      decidePaidSemanticsFromPayment(expected, { ...payment, orderCorrelation: 'other-order' }),
    ).toMatchObject({ paidSemantics: false, reason: 'CORRELATION_MISMATCH' })
    expect(
      decidePaidSemanticsFromPayment(expected, { ...payment, providerTransactionId: '  ' }),
    ).toMatchObject({ paidSemantics: false, source: 'missing_transaction_id' })
  })
})

describe('MULTI-PAY-4 static reuse and exclusion', () => {
  it('reuses existing MP primitives and does not add Clip/Openpay/PayPal/business-effect/HTTP duplicates', () => {
    const src = readFileSync(ADAPTER_SRC, 'utf8')
    expect(src).toContain("from '../mercadopago/signature'")
    expect(src).toContain('validateMercadoPagoWebhookSignature')
    expect(src).toContain("from '../mercadopago/payments'")
    expect(src).toContain('amountToCents')
    expect(src).toContain("from '../webhook/normalize'")
    expect(src).toContain('normalizeProviderPaymentStatus')
    expect(src).not.toContain('api.mercadopago.com/checkout/preferences')
    expect(src).not.toContain('webhook_apply_payment_tx')
    expect(src).not.toContain('insertTicket')
    expect(src).not.toContain('confirmRegistration')
    expect(src).not.toContain('applyCapacityEffect')
    expect(src).not.toMatch(/paypal/i)
    expect(src).not.toContain('api.clip.mx')
    expect(src).not.toContain('openpay.mx')
    expect(src).not.toContain('VITE_')
  })
})
