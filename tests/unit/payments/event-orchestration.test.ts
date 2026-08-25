import { describe, expect, it } from 'vitest'
import {
  PaymentContractError,
  decidePaidSemanticsFromRedirect,
  requiredEventMechanism,
  resolveProviderEvent,
} from '../../../insforge/functions/_shared/payments'
import type {
  PaymentProviderAdapter,
  ProviderEnablement,
  PaymentProviderRegistry,
  ProviderEventInput,
  ExpectedFinancialSnapshot,
} from '../../../insforge/functions/_shared/payments'
import { createInMemoryPaymentAdapter } from '../../../insforge/functions/_shared/payments/mocks/in-memory-adapter'

const ORDER_ID = '11111111-1111-1111-1111-111111111111'
const AMOUNT = 140000

const ALL_ENABLED: ProviderEnablement = {
  MERCADO_PAGO: true,
  CLIP: true,
  OPENPAY: true,
}

const EXPECTED: ExpectedFinancialSnapshot = {
  provider: 'MERCADO_PAGO',
  orderId: ORDER_ID,
  amountCents: AMOUNT,
  currency: 'MXN',
}

function wrap(adapter: PaymentProviderAdapter) {
  const calls = { createCheckout: 0, verifyEvent: 0, getPayment: 0 }
  const wrapped: PaymentProviderAdapter = {
    provider: adapter.provider,
    createCheckout: async (input) => {
      calls.createCheckout += 1
      return adapter.createCheckout(input)
    },
    verifyEvent: async (event) => {
      calls.verifyEvent += 1
      return adapter.verifyEvent(event)
    },
    getPayment: async (handle) => {
      calls.getPayment += 1
      return adapter.getPayment(handle)
    },
    normalizeStatus: (raw) => adapter.normalizeStatus(raw),
  }
  return { adapter: wrapped, calls }
}

function registryOf(wrappers: Record<string, { adapter: PaymentProviderAdapter }>) {
  return {
    MERCADO_PAGO: wrappers.MERCADO_PAGO?.adapter,
    CLIP: wrappers.CLIP?.adapter,
    OPENPAY: wrappers.OPENPAY?.adapter,
  } as PaymentProviderRegistry
}

function approvedAdapter(provider: 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY', handle: string) {
  return createInMemoryPaymentAdapter(provider, {
    checkoutHandle: handle,
    payment: {
      providerTransactionId: handle,
      providerRawStatus: 'approved',
      normalizedStatus: 'APPROVED',
      amountCents: AMOUNT,
      currency: 'MXN',
      orderCorrelation: ORDER_ID,
    },
  })
}

function mpEvent(overrides: Partial<Extract<ProviderEventInput, { provider: 'MERCADO_PAGO' }>> = {}): ProviderEventInput {
  return {
    provider: 'MERCADO_PAGO',
    authenticity: { mechanism: 'x-signature' },
    eventId: 'mp-evt-1',
    transactionHandle: 'mp-pay-1',
    ...overrides,
  }
}

function clipEvent(overrides: Partial<Extract<ProviderEventInput, { provider: 'CLIP' }>> = {}): ProviderEventInput {
  return {
    provider: 'CLIP',
    authenticity: { mechanism: 'event_handle' },
    eventId: 'clip-evt-1',
    transactionHandle: 'clip-pay-1',
    ...overrides,
  }
}

function openpayEvent(
  overrides: Partial<Extract<ProviderEventInput, { provider: 'OPENPAY' }>> = {},
): ProviderEventInput {
  return {
    provider: 'OPENPAY',
    authenticity: { mechanism: 'http_basic_ingress', eventType: 'charge.succeeded' },
    eventId: 'op-evt-1',
    transactionHandle: 'op-pay-1',
    ...overrides,
  }
}

describe('MULTI-PAY-7 event orchestration', () => {
  it('selects only Mercado Pago for x-signature ingress', async () => {
    const mp = wrap(approvedAdapter('MERCADO_PAGO', 'mp-pay-1'))
    const clip = wrap(approvedAdapter('CLIP', 'clip-pay-1'))
    const openpay = wrap(approvedAdapter('OPENPAY', 'op-pay-1'))
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip, OPENPAY: openpay }),
    })
    expect(result.kind).toBe('PAYMENT_SIGNAL')
    expect(mp.calls.verifyEvent).toBe(1)
    expect(mp.calls.getPayment).toBe(1)
    expect(clip.calls.verifyEvent).toBe(0)
    expect(openpay.calls.verifyEvent).toBe(0)
  })

  it('selects only Clip for event_handle ingress', async () => {
    const mp = wrap(approvedAdapter('MERCADO_PAGO', 'mp-pay-1'))
    const clip = wrap(approvedAdapter('CLIP', 'clip-pay-1'))
    const openpay = wrap(approvedAdapter('OPENPAY', 'op-pay-1'))
    await resolveProviderEvent({
      event: clipEvent(),
      expected: { ...EXPECTED, provider: 'CLIP' },
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip, OPENPAY: openpay }),
    })
    expect(clip.calls.verifyEvent).toBe(1)
    expect(clip.calls.getPayment).toBe(1)
    expect(mp.calls.verifyEvent).toBe(0)
    expect(openpay.calls.verifyEvent).toBe(0)
  })

  it('selects only Openpay for http_basic_ingress', async () => {
    const mp = wrap(approvedAdapter('MERCADO_PAGO', 'mp-pay-1'))
    const clip = wrap(approvedAdapter('CLIP', 'clip-pay-1'))
    const openpay = wrap(approvedAdapter('OPENPAY', 'op-pay-1'))
    await resolveProviderEvent({
      event: openpayEvent(),
      expected: { ...EXPECTED, provider: 'OPENPAY' },
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip, OPENPAY: openpay }),
    })
    expect(openpay.calls.verifyEvent).toBe(1)
    expect(openpay.calls.getPayment).toBe(1)
    expect(mp.calls.verifyEvent).toBe(0)
    expect(clip.calls.verifyEvent).toBe(0)
  })

  it('rejects the wrong authenticity mechanism without calling another adapter', async () => {
    const mp = wrap(approvedAdapter('MERCADO_PAGO', 'mp-pay-1'))
    const clip = wrap(approvedAdapter('CLIP', 'clip-pay-1'))
    await expect(
      resolveProviderEvent({
        event: {
          provider: 'CLIP',
          authenticity: { mechanism: 'x-signature' },
          eventId: 'evt',
          transactionHandle: 'pay',
        } as never,
        expected: { ...EXPECTED, provider: 'CLIP' },
        enablement: ALL_ENABLED,
        registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip }),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
    expect(mp.calls.verifyEvent).toBe(0)
    expect(clip.calls.verifyEvent).toBe(0)
  })

  it('keeps a verified event non-financial', async () => {
    const mp = wrap(approvedAdapter('MERCADO_PAGO', 'mp-pay-1'))
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    expect(result.event.financialAuthority).toBe(false)
    expect(result.event.authenticity).toBe('accepted')
    expect(result.event).not.toHaveProperty('normalizedStatus')
  })

  it('performs authoritative GET for a Mercado Pago financial event', async () => {
    const mp = wrap(approvedAdapter('MERCADO_PAGO', 'mp-pay-1'))
    await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    expect(mp.calls.getPayment).toBe(1)
  })

  it('performs authoritative GET for a Clip financial event', async () => {
    const clip = wrap(approvedAdapter('CLIP', 'clip-pay-1'))
    await resolveProviderEvent({
      event: clipEvent(),
      expected: { ...EXPECTED, provider: 'CLIP' },
      enablement: ALL_ENABLED,
      registry: registryOf({ CLIP: clip }),
    })
    expect(clip.calls.getPayment).toBe(1)
  })

  it('performs authoritative GET for an Openpay financial event', async () => {
    const openpay = wrap(approvedAdapter('OPENPAY', 'op-pay-1'))
    await resolveProviderEvent({
      event: openpayEvent(),
      expected: { ...EXPECTED, provider: 'OPENPAY' },
      enablement: ALL_ENABLED,
      registry: registryOf({ OPENPAY: openpay }),
    })
    expect(openpay.calls.getPayment).toBe(1)
  })

  it('does not GET on an Openpay verification handshake', async () => {
    const openpay = wrap(approvedAdapter('OPENPAY', 'op-pay-1'))
    const result = await resolveProviderEvent({
      event: openpayEvent({
        authenticity: {
          mechanism: 'http_basic_ingress',
          eventType: 'verification',
          verificationCode: 'abc123',
        },
        eventId: 'verify-1',
        transactionHandle: 'verify-1',
      }),
      expected: { ...EXPECTED, provider: 'OPENPAY' },
      enablement: ALL_ENABLED,
      registry: registryOf({ OPENPAY: openpay }),
    })
    expect(result.kind).toBe('VERIFICATION_HANDSHAKE')
    expect(result.financialAuthority).toBe(false)
    expect(result.paidSemantics).toBe(false)
    expect(openpay.calls.verifyEvent).toBe(1)
    expect(openpay.calls.getPayment).toBe(0)
  })

  it('does not treat a redirect as a paid path', () => {
    const decision = decidePaidSemanticsFromRedirect({
      provider: 'MERCADO_PAGO',
      checkoutHandle: 'pref-1',
      redirectUrl: 'https://mp.test/checkout',
      financialAuthority: false,
    })
    expect(decision.paidSemantics).toBe(false)
    expect(decision.source).toBe('redirect')
  })

  it('does not mark paid from webhook/event status alone', async () => {
    const mp = wrap(
      createInMemoryPaymentAdapter('MERCADO_PAGO', {
        checkoutHandle: 'mp-pay-1',
        payment: {
          providerTransactionId: 'mp-pay-1',
          providerRawStatus: 'approved',
          normalizedStatus: 'PENDING',
          amountCents: AMOUNT,
          currency: 'MXN',
          orderCorrelation: ORDER_ID,
        },
      }),
    )
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    expect(result.kind).toBe('PAYMENT_SIGNAL')
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe(false)
    }
    expect(mp.calls.getPayment).toBe(1)
  })

  it('cannot mark paid from an unknown provider status', async () => {
    const mp = wrap(
      createInMemoryPaymentAdapter('MERCADO_PAGO', {
        checkoutHandle: 'mp-pay-1',
        payment: {
          providerTransactionId: 'mp-pay-1',
          providerRawStatus: 'weird',
          normalizedStatus: 'UNKNOWN',
          amountCents: AMOUNT,
          currency: 'MXN',
          orderCorrelation: ORDER_ID,
        },
      }),
    )
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe(false)
      expect(result.decision.source).toBe('unknown_status')
    }
  })

  it('fails correspondence on amount mismatch', async () => {
    const mp = wrap(
      createInMemoryPaymentAdapter('MERCADO_PAGO', {
        checkoutHandle: 'mp-pay-1',
        payment: {
          providerTransactionId: 'mp-pay-1',
          providerRawStatus: 'approved',
          normalizedStatus: 'APPROVED',
          amountCents: 1,
          currency: 'MXN',
          orderCorrelation: ORDER_ID,
        },
      }),
    )
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe(false)
      expect(result.decision).toMatchObject({ source: 'financial_mismatch', reason: 'AMOUNT_MISMATCH' })
    }
  })

  it('fails correspondence on currency mismatch', async () => {
    const mp = wrap(
      createInMemoryPaymentAdapter('MERCADO_PAGO', {
        checkoutHandle: 'mp-pay-1',
        payment: {
          providerTransactionId: 'mp-pay-1',
          providerRawStatus: 'approved',
          normalizedStatus: 'APPROVED',
          amountCents: AMOUNT,
          currency: 'USD',
          orderCorrelation: ORDER_ID,
        },
      }),
    )
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision).toMatchObject({
        paidSemantics: false,
        source: 'financial_mismatch',
        reason: 'CURRENCY_MISMATCH',
      })
    }
  })

  it('fails correspondence on order correlation mismatch', async () => {
    const mp = wrap(
      createInMemoryPaymentAdapter('MERCADO_PAGO', {
        checkoutHandle: 'mp-pay-1',
        payment: {
          providerTransactionId: 'mp-pay-1',
          providerRawStatus: 'approved',
          normalizedStatus: 'APPROVED',
          amountCents: AMOUNT,
          currency: 'MXN',
          orderCorrelation: 'other-order',
        },
      }),
    )
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision).toMatchObject({
        paidSemantics: false,
        source: 'financial_mismatch',
        reason: 'CORRELATION_MISMATCH',
      })
    }
  })

  it('fails closed on a blank provider transaction id', async () => {
    const inner = approvedAdapter('MERCADO_PAGO', 'mp-pay-1')
    const mp = wrap({
      ...inner,
      async getPayment(handle: string) {
        const found = await inner.getPayment(handle)
        return { ...found, providerTransactionId: '   ' }
      },
    })
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe(false)
      expect(result.decision.source).toBe('missing_transaction_id')
    }
  })

  it('rejects an event whose provider does not match the expected snapshot', async () => {
    await expect(
      resolveProviderEvent({
        event: clipEvent(),
        expected: EXPECTED,
        enablement: ALL_ENABLED,
        registry: {
          CLIP: approvedAdapter('CLIP', 'clip-pay-1'),
          MERCADO_PAGO: approvedAdapter('MERCADO_PAGO', 'mp-pay-1'),
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_EVENT' })
  })

  it('fails closed on provider-specific GET failure', async () => {
    const failing: PaymentProviderAdapter = {
      ...approvedAdapter('OPENPAY', 'op-pay-1'),
      provider: 'OPENPAY',
      async getPayment() {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'not an original card charge')
      },
    }
    await expect(
      resolveProviderEvent({
        event: openpayEvent(),
        expected: { ...EXPECTED, provider: 'OPENPAY' },
        enablement: ALL_ENABLED,
        registry: { OPENPAY: failing },
      }),
    ).rejects.toMatchObject({ code: 'FINANCIAL_RESOLUTION_FAILURE' })
  })

  it('may produce eligible_for_domain_tx for matching Mercado Pago evidence', async () => {
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: { MERCADO_PAGO: approvedAdapter('MERCADO_PAGO', 'mp-pay-1') },
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe('eligible_for_domain_tx')
    }
  })

  it('may produce eligible_for_domain_tx for matching Clip evidence', async () => {
    const result = await resolveProviderEvent({
      event: clipEvent(),
      expected: { ...EXPECTED, provider: 'CLIP' },
      enablement: ALL_ENABLED,
      registry: { CLIP: approvedAdapter('CLIP', 'clip-pay-1') },
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe('eligible_for_domain_tx')
    }
  })

  it('may produce eligible_for_domain_tx for matching Openpay evidence', async () => {
    const result = await resolveProviderEvent({
      event: openpayEvent(),
      expected: { ...EXPECTED, provider: 'OPENPAY' },
      enablement: ALL_ENABLED,
      registry: { OPENPAY: approvedAdapter('OPENPAY', 'op-pay-1') },
    })
    if (result.kind === 'PAYMENT_SIGNAL') {
      expect(result.decision.paidSemantics).toBe('eligible_for_domain_tx')
    }
  })

  it('does not issue tickets, registrations, or order transitions in the event layer', async () => {
    const result = await resolveProviderEvent({
      event: mpEvent(),
      expected: EXPECTED,
      enablement: ALL_ENABLED,
      registry: { MERCADO_PAGO: approvedAdapter('MERCADO_PAGO', 'mp-pay-1') },
    })
    expect(result).not.toHaveProperty('ticketId')
    expect(result).not.toHaveProperty('registrationId')
    expect(result).not.toHaveProperty('orderStatus')
    expect(requiredEventMechanism('MERCADO_PAGO')).toBe('x-signature')
    expect(requiredEventMechanism('CLIP')).toBe('event_handle')
    expect(requiredEventMechanism('OPENPAY')).toBe('http_basic_ingress')
  })
})
