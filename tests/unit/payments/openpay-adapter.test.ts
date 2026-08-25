import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { OpenpayChargeHttpClient } from '../../../insforge/functions/_shared/openpay/charge-client'
import type {
  OpenpayCheckoutContext,
  OpenpayCreateChargeRequest,
  OpenpayGetChargeResponse,
} from '../../../insforge/functions/_shared/openpay/types'
import { createMockPaymentClient } from '../../../insforge/functions/_shared/mercadopago/payments'
import {
  OPENPAY_STORAGE_ID,
  PaymentContractError,
  correspondFinancially,
  createMercadoPagoPaymentAdapter,
  createOpenpayPaymentAdapter,
  decidePaidSemanticsFromPayment,
  decidePaidSemanticsFromRedirect,
  decidePaidSemanticsFromVerifiedEvent,
  fromOpenpayStorageId,
  parseResolvedPaymentCheckoutInput,
  selectPaymentProviderAdapter,
  toOpenpayStorageId,
} from '../../../insforge/functions/_shared/payments'
import type { ResolvedPaymentCheckoutInput } from '../../../insforge/functions/_shared/payments'

const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const CHARGE_ID = 'tr6uvyqwqjtmzburr3ew'
const REDIRECT_URL = 'https://sandbox-api.openpay.mx/v1/redirect/abc'
const ADAPTER_SRC = resolve(process.cwd(), 'insforge/functions/_shared/payments/openpay-adapter.ts')
const CLIENT_SRC = resolve(process.cwd(), 'insforge/functions/_shared/openpay/charge-client.ts')
const CHECKOUT_INPUT_SRC = resolve(process.cwd(), 'insforge/functions/_shared/payments/checkout-input.ts')

function resolvedCheckout(overrides: Record<string, unknown> = {}): ResolvedPaymentCheckoutInput {
  return parseResolvedPaymentCheckoutInput({
    eligibility: 'PAYMENT_ELIGIBLE',
    orderId: ORDER_ID,
    provider: 'OPENPAY',
    amountCents: 12345,
    currency: 'MXN',
    reference: 'R2H-OP-1',
    description: 'Ready2Hybrid checkout',
    returnUrls: {
      success: 'https://app.test/openpay/return',
      failure: 'https://app.test/failure',
      pending: 'https://app.test/pending',
    },
    ...overrides,
  })
}

function checkoutContext(overrides: Partial<OpenpayCheckoutContext> = {}): OpenpayCheckoutContext {
  return {
    clientIp: '203.0.113.10',
    customer: {
      name: 'Test',
      last_name: 'Buyer',
      phone_number: '5512345678',
      email: 'buyer@example.test',
    },
    ...overrides,
  }
}

function mockClient(getImpl?: (id: string) => Promise<OpenpayGetChargeResponse>): OpenpayChargeHttpClient & {
  creates: OpenpayCreateChargeRequest[]
  gets: string[]
} {
  const creates: OpenpayCreateChargeRequest[] = []
  const gets: string[] = []
  return {
    creates,
    gets,
    async createCharge(request) {
      creates.push(request)
      return {
        id: CHARGE_ID,
        status: 'charge_pending',
        payment_method: { type: 'redirect', url: REDIRECT_URL },
      }
    },
    async getCharge(transactionId) {
      gets.push(transactionId)
      if (getImpl) return getImpl(transactionId)
      return {
        id: transactionId,
        status: 'completed',
        amount: 123.45,
        currency: 'MXN',
        order_id: ORDER_ID,
        transaction_type: 'charge',
        operation_type: 'in',
        method: 'card',
      }
    },
  }
}

function adapterWith(
  client = mockClient(),
  context: OpenpayCheckoutContext = checkoutContext(),
  basic = { username: 'hook-user', password: 'hook-pass' },
) {
  return {
    adapter: createOpenpayPaymentAdapter({
      client,
      getCheckoutContext: () => context,
      getWebhookBasicAuth: () => basic,
    }),
    client,
  }
}

describe('MULTI-PAY-6 Openpay adapter identity and storage mapping', () => {
  it('identifies as OPENPAY and maps storage id openpay explicitly', () => {
    const { adapter } = adapterWith()
    expect(adapter.provider).toBe('OPENPAY')
    expect(OPENPAY_STORAGE_ID).toBe('openpay')
    expect(toOpenpayStorageId('OPENPAY')).toBe('openpay')
    expect(fromOpenpayStorageId('openpay')).toBe('OPENPAY')
  })

  it('fails closed on unknown storage/provider mapping', () => {
    expect(() => toOpenpayStorageId('MERCADO_PAGO')).toThrow(PaymentContractError)
    expect(() => toOpenpayStorageId('CLIP')).toThrow(PaymentContractError)
    expect(() => fromOpenpayStorageId('openpaymx')).toThrow(PaymentContractError)
    expect(() => fromOpenpayStorageId('OPENPAY')).toThrow(PaymentContractError)
  })
})

describe('MULTI-PAY-6 createCheckout', () => {
  it('consumes canonical resolved input, server customer context, and does not calculate price', async () => {
    const { adapter, client } = adapterWith()
    const checkout = await adapter.createCheckout(resolvedCheckout())
    expect(client.creates).toHaveLength(1)
    expect(client.creates[0]?.amount).toBe(123.45)
    expect(client.creates[0]?.currency).toBe('MXN')
    expect(client.creates[0]?.order_id).toBe(ORDER_ID)
    expect(client.creates[0]?.method).toBe('card')
    expect(client.creates[0]?.confirm).toBe(false)
    expect(client.creates[0]?.send_email).toBe(false)
    expect(client.creates[0]?.redirect_url).toBe('https://app.test/openpay/return')
    expect(client.creates[0]?.customer).toEqual({
      name: 'Test',
      last_name: 'Buyer',
      phone_number: '5512345678',
      email: 'buyer@example.test',
    })
    const serialized = JSON.stringify(client.creates[0])
    expect(serialized).not.toMatch(/source_id|card_number|cvv|payment_plan|use_3d_secure/)
    expect(checkout.provider).toBe('OPENPAY')
    expect(checkout.checkoutHandle).toBe(CHARGE_ID)
    expect(checkout.redirectUrl).toBe(REDIRECT_URL)
    expect(checkout.financialAuthority).toBe(false)
    expect(checkout).not.toHaveProperty('customer')
    expect(checkout).not.toHaveProperty('email')
  })

  it('does not put customer PII on the shared checkout DTO', () => {
    const src = readFileSync(CHECKOUT_INPUT_SRC, 'utf8')
    expect(src).not.toMatch(/\bemail\b/)
    expect(src).not.toMatch(/\bphone_number\b/)
    expect(src).not.toMatch(/\blast_name\b/)
    expect(src).not.toMatch(/\bclientIp\b/)
  })

  it('rejects order_id longer than 100 and does not truncate', async () => {
    const { adapter, client } = adapterWith()
    const exact100 = 'a'.repeat(100)
    await adapter.createCheckout(resolvedCheckout({ orderId: exact100 }))
    expect(client.creates[0]?.order_id).toBe(exact100)
    await expect(
      adapter.createCheckout(resolvedCheckout({ orderId: 'a'.repeat(101) })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(client.creates).toHaveLength(1)
  })

  it('rejects description over 250 and does not truncate', async () => {
    const { adapter, client } = adapterWith()
    await adapter.createCheckout(resolvedCheckout({ description: 'd'.repeat(250) }))
    expect(client.creates[0]?.description).toHaveLength(250)
    await expect(
      adapter.createCheckout(resolvedCheckout({ description: 'd'.repeat(251) })),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(client.creates).toHaveLength(1)
  })

  it('fails closed when customer or client IP context is missing', async () => {
    const { adapter: noCustomer, client } = adapterWith(
      mockClient(),
      checkoutContext({ customer: { name: '', last_name: '', phone_number: '', email: '' } }),
    )
    await expect(noCustomer.createCheckout(resolvedCheckout())).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    const { adapter: noIp } = adapterWith(mockClient(), checkoutContext({ clientIp: 'unknown' }))
    await expect(noIp.createCheckout(resolvedCheckout())).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    expect(client.creates).toHaveLength(0)
  })
})

describe('MULTI-PAY-6 verifyEvent', () => {
  it('accepts only OPENPAY/http_basic_ingress and remains non-financial', async () => {
    const { adapter } = adapterWith()
    const event = await adapter.verifyEvent({
      provider: 'OPENPAY',
      authenticity: {
        mechanism: 'http_basic_ingress',
        username: 'hook-user',
        password: 'hook-pass',
        eventType: 'charge.succeeded',
        transactionId: CHARGE_ID,
      },
      eventId: 'evt-1',
      transactionHandle: CHARGE_ID,
    })
    expect(event.authenticity).toBe('accepted')
    expect(event.financialAuthority).toBe(false)
    expect(event.transactionHandle).toBe(CHARGE_ID)
    expect(decidePaidSemanticsFromVerifiedEvent(event)).toEqual({
      paidSemantics: false,
      source: 'verified_event',
    })
  })

  it('treats verification handshake as non-financial configuration', async () => {
    const { adapter } = adapterWith()
    const event = await adapter.verifyEvent({
      provider: 'OPENPAY',
      authenticity: {
        mechanism: 'http_basic_ingress',
        username: 'hook-user',
        password: 'hook-pass',
        eventType: 'verification',
        verificationCode: 'abc123',
      },
      eventId: 'verify-1',
      transactionHandle: 'verify-1',
    })
    expect(event.financialAuthority).toBe(false)
    expect(event.transactionHandle).toBe('verify-1')
  })

  it('rejects wrong provider, wrong mechanism, and invalid Basic auth', async () => {
    const { adapter } = adapterWith()
    await expect(
      adapter.verifyEvent({
        provider: 'CLIP',
        authenticity: { mechanism: 'event_handle' },
        eventId: 'e',
        transactionHandle: 't',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
    await expect(
      adapter.verifyEvent({
        provider: 'OPENPAY',
        authenticity: { mechanism: 'event_handle' as never },
        eventId: 'e',
        transactionHandle: CHARGE_ID,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
    await expect(
      adapter.verifyEvent({
        provider: 'OPENPAY',
        authenticity: {
          mechanism: 'http_basic_ingress',
          username: 'hook-user',
          password: 'wrong',
          eventType: 'charge.succeeded',
          transactionId: CHARGE_ID,
        },
        eventId: 'e',
        transactionHandle: CHARGE_ID,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
  })

  it('extracts transaction.id as GET handle only for charge events, including unknown future types', async () => {
    const { adapter } = adapterWith()
    for (const eventType of [
      'charge.created',
      'charge.succeeded',
      'charge.failed',
      'charge.cancelled',
      'charge.refunded',
      'charge.future_unknown',
    ]) {
      const event = await adapter.verifyEvent({
        provider: 'OPENPAY',
        authenticity: {
          mechanism: 'http_basic_ingress',
          username: 'hook-user',
          password: 'hook-pass',
          eventType,
          transactionId: CHARGE_ID,
        },
        eventId: `evt-${eventType}`,
        transactionHandle: 'ignored',
      })
      expect(event.transactionHandle).toBe(CHARGE_ID)
      expect(event.financialAuthority).toBe(false)
    }
  })

  it('duplicate/retried webhook verify does not imply duplicate business effects', async () => {
    const { adapter } = adapterWith()
    const payload = {
      provider: 'OPENPAY' as const,
      authenticity: {
        mechanism: 'http_basic_ingress' as const,
        username: 'hook-user',
        password: 'hook-pass',
        eventType: 'charge.succeeded',
        transactionId: CHARGE_ID,
      },
      eventId: 'evt-dup',
      transactionHandle: CHARGE_ID,
    }
    const first = await adapter.verifyEvent(payload)
    const second = await adapter.verifyEvent(payload)
    expect(first.eventId).toBe(second.eventId)
    expect(first.financialAuthority).toBe(false)
    expect(second.financialAuthority).toBe(false)
  })
})

describe('MULTI-PAY-6 getPayment and correspondence', () => {
  const expected = {
    provider: 'OPENPAY' as const,
    orderId: ORDER_ID,
    amountCents: 12345,
    currency: 'MXN' as const,
  }

  it('delegates to Openpay GET and maps SPEC-041 statuses from GET evidence', async () => {
    const { adapter, client } = adapterWith()
    const payment = await adapter.getPayment(CHARGE_ID)
    expect(client.gets).toEqual([CHARGE_ID])
    expect(payment.provider).toBe('OPENPAY')
    expect(payment.providerTransactionId).toBe(CHARGE_ID)
    expect(payment.orderCorrelation).toBe(ORDER_ID)
    expect(payment.amountCents).toBe(12345)
    expect(payment.currency).toBe('MXN')
    expect(payment.normalizedStatus).toBe('APPROVED')
    expect(adapter.normalizeStatus('completed')).toBe('APPROVED')
    expect(adapter.normalizeStatus('charge.succeeded')).toBe('APPROVED')
    expect(adapter.normalizeStatus('in_progress')).toBe('PENDING')
    expect(adapter.normalizeStatus('charge.created')).toBe('PENDING')
    expect(adapter.normalizeStatus('charge_pending')).toBe('PENDING')
    expect(adapter.normalizeStatus('CHARGE_PENDING')).toBe('PENDING')
    expect(adapter.normalizeStatus('failed')).toBe('REJECTED')
    expect(adapter.normalizeStatus('charge.failed')).toBe('REJECTED')
    expect(adapter.normalizeStatus('cancelled')).toBe('CANCELLED')
    expect(adapter.normalizeStatus('charge.cancelled')).toBe('CANCELLED')
    expect(adapter.normalizeStatus('refunded')).toBe('REFUNDED')
    expect(adapter.normalizeStatus('charge.refunded')).toBe('REFUNDED')
    expect(adapter.normalizeStatus('chargeback.accepted')).toBe('CHARGED_BACK')
    expect(adapter.normalizeStatus('CHARGEBACK_ACCEPTED')).toBe('CHARGED_BACK')
    expect(adapter.normalizeStatus('CHARGEBACK_PENDING')).toBe('UNKNOWN')
    expect(adapter.normalizeStatus('CHARGEBACK_ADJUSTMENT')).toBe('UNKNOWN')
    expect(adapter.normalizeStatus('totally_unknown')).toBe('UNKNOWN')
  })

  it('allows eligible_for_domain_tx only after matching authoritative completed GET', async () => {
    const { adapter } = adapterWith()
    const payment = await adapter.getPayment(CHARGE_ID)
    expect(correspondFinancially(expected, payment)).toEqual({ ok: true })
    expect(decidePaidSemanticsFromPayment(expected, payment)).toEqual({
      paidSemantics: 'eligible_for_domain_tx',
      source: 'financial_resolution',
      normalizedStatus: 'APPROVED',
    })
  })

  it('fails closed on amount, currency, provider, correlation, and wrong transaction shape', async () => {
    const { adapter } = adapterWith()
    const payment = await adapter.getPayment(CHARGE_ID)
    expect(decidePaidSemanticsFromPayment({ ...expected, amountCents: 1 }, payment)).toMatchObject({
      paidSemantics: false,
      reason: 'AMOUNT_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment(expected, { ...payment, currency: 'USD' })).toMatchObject({
      paidSemantics: false,
      reason: 'CURRENCY_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment({ ...expected, provider: 'CLIP' }, payment)).toMatchObject({
      paidSemantics: false,
      reason: 'PROVIDER_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment(expected, { ...payment, orderCorrelation: 'other' })).toMatchObject({
      paidSemantics: false,
      reason: 'CORRELATION_MISMATCH',
    })
    const refundShape = mockClient(async () => ({
      id: CHARGE_ID,
      status: 'completed',
      amount: 123.45,
      currency: 'MXN',
      order_id: ORDER_ID,
      transaction_type: 'refund',
      operation_type: 'out',
      method: 'card',
    }))
    await expect(adapterWith(refundShape).adapter.getPayment(CHARGE_ID)).rejects.toMatchObject({
      code: 'FINANCIAL_RESOLUTION_FAILURE',
    })
  })

  it('cannot reach eligible_for_domain_tx from redirect or webhook event', async () => {
    const { adapter } = adapterWith()
    const checkout = await adapter.createCheckout(resolvedCheckout())
    expect(decidePaidSemanticsFromRedirect(checkout).paidSemantics).toBe(false)
    const event = await adapter.verifyEvent({
      provider: 'OPENPAY',
      authenticity: {
        mechanism: 'http_basic_ingress',
        username: 'hook-user',
        password: 'hook-pass',
        eventType: 'charge.succeeded',
        transactionId: CHARGE_ID,
      },
      eventId: 'evt',
      transactionHandle: CHARGE_ID,
    })
    expect(decidePaidSemanticsFromVerifiedEvent(event).paidSemantics).toBe(false)
  })
})

describe('MULTI-PAY-6 no silent fallback and no business effects', () => {
  it('does not substitute Mercado Pago or Clip when OPENPAY is selected without an Openpay adapter', () => {
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
      selectPaymentProviderAdapter(
        'OPENPAY',
        { OPENPAY: true, MERCADO_PAGO: true, CLIP: true },
        { MERCADO_PAGO: mp },
      ),
    ).toThrow(PaymentContractError)
  })

  it('contains no ticket/registration/capacity effects, card capture, MSI, PayPal, or customer creation', () => {
    const src = `${readFileSync(ADAPTER_SRC, 'utf8')}\n${readFileSync(CLIENT_SRC, 'utf8')}`
    expect(src).not.toContain('webhook_apply_payment_tx')
    expect(src).not.toContain('insertTicket')
    expect(src).not.toContain('confirmRegistration')
    expect(src).not.toMatch(/\bpan\b/i)
    expect(src).toContain("'card_number'")
    expect(src).toContain("'cvv'")
    expect(src).not.toMatch(/paypal/i)
    expect(src).not.toContain('/customers')
    expect(src).toContain("'payment_plan'")
    expect(src).not.toMatch(/payment_plan\s*:/)
    expect(src).not.toContain('VITE_')
    expect(src).not.toContain('openpay.co')
    expect(src).not.toContain('/checkouts')
  })
})
