import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ClipCheckoutHttpClient } from '../../../insforge/functions/_shared/clip/checkout-client'
import type {
  ClipCreateCheckoutRequest,
  ClipGetCheckoutResponse,
} from '../../../insforge/functions/_shared/clip/types'
import { createMockPaymentClient } from '../../../insforge/functions/_shared/mercadopago/payments'
import {
  CLIP_STORAGE_ID,
  PaymentContractError,
  correspondFinancially,
  createClipPaymentAdapter,
  createMercadoPagoPaymentAdapter,
  decidePaidSemanticsFromPayment,
  decidePaidSemanticsFromRedirect,
  decidePaidSemanticsFromVerifiedEvent,
  fromClipStorageId,
  parseResolvedPaymentCheckoutInput,
  selectPaymentProviderAdapter,
  toClipStorageId,
} from '../../../insforge/functions/_shared/payments'
import type { ResolvedPaymentCheckoutInput } from '../../../insforge/functions/_shared/payments'

const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const EXPIRES_AT = '2026-08-24T18:00:00.000Z'
const ADAPTER_SRC = resolve(process.cwd(), 'insforge/functions/_shared/payments/clip-adapter.ts')
const CLIENT_SRC = resolve(process.cwd(), 'insforge/functions/_shared/clip/checkout-client.ts')

function resolvedCheckout(overrides: Record<string, unknown> = {}): ResolvedPaymentCheckoutInput {
  return parseResolvedPaymentCheckoutInput({
    eligibility: 'PAYMENT_ELIGIBLE',
    orderId: ORDER_ID,
    provider: 'CLIP',
    amountCents: 140000,
    currency: 'MXN',
    reference: 'R2H-CLIP-1',
    description: 'Ready2Hybrid checkout',
    returnUrls: {
      success: 'https://app.test/success',
      failure: 'https://app.test/failure',
      pending: 'https://app.test/pending',
    },
    expiresAt: EXPIRES_AT,
    ...overrides,
  })
}

function mockClient(getImpl?: (id: string) => Promise<ClipGetCheckoutResponse>): ClipCheckoutHttpClient & {
  creates: ClipCreateCheckoutRequest[]
  gets: string[]
} {
  const creates: ClipCreateCheckoutRequest[] = []
  const gets: string[] = []
  return {
    creates,
    gets,
    async createCheckout(request) {
      creates.push(request)
      return {
        payment_request_id: 'req-clip-1',
        payment_request_url: 'https://hosted.payclip.com/r/req-clip-1',
      }
    },
    async getCheckout(paymentRequestId) {
      gets.push(paymentRequestId)
      if (getImpl) return getImpl(paymentRequestId)
      return {
        payment_request_id: paymentRequestId,
        status: 'CHECKOUT_COMPLETED',
        amount: 1400,
        currency: 'MXN',
        metadata: { external_reference: ORDER_ID },
        receipt_no: 'RCP-1',
      }
    },
  }
}

function adapterWith(client = mockClient()) {
  return {
    adapter: createClipPaymentAdapter({
      client,
      getWebhookUrl: () => 'https://api.ready2hybrid.test/functions/clip-webhook',
    }),
    client,
  }
}

describe('MULTI-PAY-5 Clip adapter identity and storage mapping', () => {
  it('identifies as CLIP and maps storage id clip explicitly', () => {
    const { adapter } = adapterWith()
    expect(adapter.provider).toBe('CLIP')
    expect(CLIP_STORAGE_ID).toBe('clip')
    expect(toClipStorageId('CLIP')).toBe('clip')
    expect(fromClipStorageId('clip')).toBe('CLIP')
  })

  it('fails closed on unknown storage/provider mapping', () => {
    expect(() => toClipStorageId('MERCADO_PAGO')).toThrow(PaymentContractError)
    expect(() => toClipStorageId('OPENPAY')).toThrow(PaymentContractError)
    expect(() => fromClipStorageId('clippay')).toThrow(PaymentContractError)
    expect(() => fromClipStorageId('CLIP')).toThrow(PaymentContractError)
  })
})

describe('MULTI-PAY-5 createCheckout', () => {
  it('consumes canonical resolved input and does not calculate price', async () => {
    const { adapter, client } = adapterWith()
    const checkout = await adapter.createCheckout(resolvedCheckout())
    expect(client.creates).toHaveLength(1)
    expect(client.creates[0]?.amount).toBe(1400)
    expect(client.creates[0]?.currency).toBe('MXN')
    expect(client.creates[0]?.metadata.external_reference).toBe(ORDER_ID)
    const serialized = JSON.parse(JSON.stringify(client.creates[0])) as Record<string, unknown>
    expect((serialized.override_settings as { tip_enabled?: boolean }).tip_enabled).toBe(false)
    expect(serialized.tip_enabled).toBeUndefined()
    expect(serialized).not.toHaveProperty('tip_enabled')
    expect(JSON.stringify(client.creates[0])).not.toMatch(/installments_msi/)
    expect(checkout.provider).toBe('CLIP')
    expect(checkout.checkoutHandle).toBe('req-clip-1')
    expect(checkout.redirectUrl).toContain('payclip.com')
    expect(checkout.financialAuthority).toBe(false)
  })

  it('RUNTIME_CLIP_BLOCKED_UNTIL_CANONICAL_EXPIRY_WIRING: missing expiresAt fails before HTTP', async () => {
    const { adapter, client } = adapterWith()
    const input = parseResolvedPaymentCheckoutInput({
      eligibility: 'PAYMENT_ELIGIBLE',
      orderId: ORDER_ID,
      provider: 'CLIP',
      amountCents: 140000,
      currency: 'MXN',
      reference: 'R2H-CLIP-1',
      description: 'Ready2Hybrid checkout',
      returnUrls: {
        success: 'https://app.test/success',
        failure: 'https://app.test/failure',
        pending: 'https://app.test/pending',
      },
    })
    await expect(adapter.createCheckout(input)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(client.creates).toHaveLength(0)
  })

  it('forwards already-resolved expiresAt and does not invent a hold duration', async () => {
    const { adapter, client } = adapterWith()
    await adapter.createCheckout(resolvedCheckout({ expiresAt: EXPIRES_AT }))
    expect(client.creates[0]?.expires_at).toBe('2026-08-24T18:00:00Z')
    expect(client.creates[0]?.expires_at).toHaveLength(20)
    expect(client.creates[0]?.expires_at).not.toContain('.000Z')
  })

  it('rejects sub-minimum amount before HTTP and does not clamp', async () => {
    const { adapter, client } = adapterWith()
    await expect(adapter.createCheckout(resolvedCheckout({ amountCents: 1 }))).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    await expect(adapter.createCheckout(resolvedCheckout({ amountCents: 99 }))).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    expect(client.creates).toHaveLength(0)
    await adapter.createCheckout(resolvedCheckout({ amountCents: 100 }))
    await adapter.createCheckout(resolvedCheckout({ amountCents: 101 }))
    expect(client.creates[0]?.amount).toBe(1)
    expect(client.creates[1]?.amount).toBe(1.01)
  })

  it('rejects metadata.external_reference longer than 36 and does not truncate', async () => {
    const { adapter, client } = adapterWith()
    const exact36 = 'a'.repeat(36)
    await adapter.createCheckout(resolvedCheckout({ orderId: exact36 }))
    expect(client.creates[0]?.metadata.external_reference).toBe(exact36)
    expect(client.creates[0]?.metadata.external_reference).toHaveLength(36)
    await expect(
      adapter.createCheckout(resolvedCheckout({ orderId: 'a'.repeat(37) })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(client.creates).toHaveLength(1)
  })

  it('rejects purchase_description over 250 and does not truncate', async () => {
    const { adapter, client } = adapterWith()
    await adapter.createCheckout(resolvedCheckout({ description: 'x' }))
    await adapter.createCheckout(resolvedCheckout({ description: 'd'.repeat(250) }))
    expect(client.creates[1]?.purchase_description).toHaveLength(250)
    await expect(
      adapter.createCheckout(resolvedCheckout({ description: 'd'.repeat(251) })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(client.creates).toHaveLength(2)
  })

  it('rejects empty/whitespace purchase_description before HTTP', async () => {
    const { client } = adapterWith()
    expect(() => resolvedCheckout({ description: '   ' })).toThrow()
    expect(client.creates).toHaveLength(0)
  })

  it('rejects invalid expiresAt before HTTP', async () => {
    const { adapter, client } = adapterWith()
    await expect(
      adapter.createCheckout({
        ...resolvedCheckout(),
        expiresAt: 'not-a-timestamp',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(client.creates).toHaveLength(0)
  })

})

describe('MULTI-PAY-5 verifyEvent', () => {
  it('accepts event_handle, extracts payment_request_id, and remains non-financial', async () => {
    const { adapter } = adapterWith()
    const event = await adapter.verifyEvent({
      provider: 'CLIP',
      authenticity: {
        mechanism: 'event_handle',
        paymentRequestId: 'req-9',
        notificationId: 'ntf-9',
        resource: 'checkout',
        resourceStatus: 'COMPLETED',
      },
      eventId: 'ntf-9',
      transactionHandle: 'req-9',
    })
    expect(event.authenticity).toBe('accepted')
    expect(event.financialAuthority).toBe(false)
    expect(event.transactionHandle).toBe('req-9')
    expect(event.notificationId).toBe('ntf-9')
    expect(decidePaidSemanticsFromVerifiedEvent(event)).toEqual({
      paidSemantics: false,
      source: 'verified_event',
    })
  })

  it('rejects wrong provider, refund resource, and blank event id', async () => {
    const { adapter } = adapterWith()
    await expect(
      adapter.verifyEvent({
        provider: 'MERCADO_PAGO',
        authenticity: { mechanism: 'x-signature' },
        eventId: 'e',
        transactionHandle: 't',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
    await expect(
      adapter.verifyEvent({
        provider: 'CLIP',
        authenticity: { mechanism: 'event_handle', resource: 'refund' },
        eventId: 'e',
        transactionHandle: 'req-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
    await expect(
      adapter.verifyEvent({
        provider: 'CLIP',
        authenticity: { mechanism: 'event_handle' },
        eventId: '   ',
        transactionHandle: 'req-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
  })
})

describe('MULTI-PAY-5 getPayment and correspondence', () => {
  const expected = {
    provider: 'CLIP' as const,
    orderId: ORDER_ID,
    amountCents: 140000,
    currency: 'MXN' as const,
  }

  it('delegates to Clip GET and maps CHECKOUT_COMPLETED from GET evidence', async () => {
    const { adapter, client } = adapterWith()
    const payment = await adapter.getPayment('req-clip-1')
    expect(client.gets).toEqual(['req-clip-1'])
    expect(payment.provider).toBe('CLIP')
    expect(payment.providerTransactionId).toBe('RCP-1')
    expect(payment.orderCorrelation).toBe(ORDER_ID)
    expect(payment.amountCents).toBe(140000)
    expect(payment.currency).toBe('MXN')
    expect(payment.normalizedStatus).toBe('APPROVED')
    expect(adapter.normalizeStatus('CHECKOUT_PENDING')).toBe('PENDING')
    expect(adapter.normalizeStatus('CHECKOUT_CREATED')).toBe('PENDING')
    expect(adapter.normalizeStatus('CHECKOUT_CANCELLED')).toBe('CANCELLED')
    expect(adapter.normalizeStatus('CHECKOUT_EXPIRED')).toBe('CANCELLED')
    expect(adapter.normalizeStatus('TOTALLY_UNKNOWN')).toBe('UNKNOWN')
  })

  it('allows eligible_for_domain_tx only after matching authoritative GET', async () => {
    const { adapter } = adapterWith()
    const payment = await adapter.getPayment('req-clip-1')
    expect(correspondFinancially(expected, payment)).toEqual({ ok: true })
    expect(decidePaidSemanticsFromPayment(expected, payment)).toEqual({
      paidSemantics: 'eligible_for_domain_tx',
      source: 'financial_resolution',
      normalizedStatus: 'APPROVED',
    })
  })

  it('fails closed on amount, currency, provider, correlation, and missing receipt', async () => {
    const { adapter } = adapterWith()
    const payment = await adapter.getPayment('req-clip-1')
    expect(decidePaidSemanticsFromPayment({ ...expected, amountCents: 1 }, payment)).toMatchObject({
      paidSemantics: false,
      reason: 'AMOUNT_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment(expected, { ...payment, currency: 'USD' })).toMatchObject({
      paidSemantics: false,
      reason: 'CURRENCY_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment({ ...expected, provider: 'MERCADO_PAGO' }, payment)).toMatchObject({
      paidSemantics: false,
      reason: 'PROVIDER_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment(expected, { ...payment, orderCorrelation: 'other' })).toMatchObject({
      paidSemantics: false,
      reason: 'CORRELATION_MISMATCH',
    })
    const incomplete = mockClient(async () => ({
      payment_request_id: 'req-clip-1',
      status: 'CHECKOUT_COMPLETED',
      amount: 1400,
      currency: 'MXN',
      metadata: { external_reference: ORDER_ID },
      receipt_no: '   ',
    }))
    await expect(adapterWith(incomplete).adapter.getPayment('req-clip-1')).rejects.toMatchObject({
      code: 'FINANCIAL_RESOLUTION_FAILURE',
    })
  })

  it('cannot reach eligible_for_domain_tx from redirect or event', async () => {
    const { adapter } = adapterWith()
    const checkout = await adapter.createCheckout(resolvedCheckout())
    expect(decidePaidSemanticsFromRedirect(checkout).paidSemantics).toBe(false)
    const event = await adapter.verifyEvent({
      provider: 'CLIP',
      authenticity: { mechanism: 'event_handle', resourceStatus: 'COMPLETED' },
      eventId: 'ntf',
      transactionHandle: 'req-clip-1',
    })
    expect(decidePaidSemanticsFromVerifiedEvent(event).paidSemantics).toBe(false)
  })
})

describe('MULTI-PAY-5 no silent fallback and no business effects', () => {
  it('does not substitute Mercado Pago when CLIP is selected without a Clip adapter', () => {
    const mp = createMercadoPagoPaymentAdapter({
      preferences: {
        async createCheckoutProPreference() {
          return { preferenceId: 'pref', initPoint: 'https://www.mercadopago.com.mx/x' }
        },
      },
      payments: createMockPaymentClient(),
      getAccessToken: () => 't',
      getWebhookSecret: () => 's',
    })
    expect(() =>
      selectPaymentProviderAdapter('CLIP', { CLIP: true, MERCADO_PAGO: true }, { MERCADO_PAGO: mp }),
    ).toThrow(PaymentContractError)
  })

  it('contains no ticket/registration/capacity effects, card capture, or PayPal/Openpay HTTP', () => {
    const src = `${readFileSync(ADAPTER_SRC, 'utf8')}\n${readFileSync(CLIENT_SRC, 'utf8')}`
    expect(src).not.toContain('webhook_apply_payment_tx')
    expect(src).not.toContain('insertTicket')
    expect(src).not.toContain('confirmRegistration')
    expect(src).not.toMatch(/card_number|cvv|pan\b/i)
    expect(src).not.toMatch(/paypal/i)
    expect(src).not.toContain('api.openpay.mx')
    expect(src).not.toContain('VITE_')
    expect(src).not.toMatch(/x-clip-signature|CLIP_HMAC|CLIP_WEBHOOK_SECRET/)
  })
})
