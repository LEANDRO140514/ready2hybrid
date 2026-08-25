import { describe, expect, it } from 'vitest'
import {
  correspondFinancially,
  decidePaidSemanticsFromPayment,
  decidePaidSemanticsFromRedirect,
  decidePaidSemanticsFromVerifiedEvent,
  normalizeMockContractStatus,
  parseResolvedPaymentCheckoutInput,
} from '../../../insforge/functions/_shared/payments'
import type {
  ExpectedFinancialSnapshot,
  ProviderPayment,
} from '../../../insforge/functions/_shared/payments'
import { createInMemoryEventEffectGate } from '../../../insforge/functions/_shared/payments/mocks/event-gate'
import { createInMemoryPaymentAdapter } from '../../../insforge/functions/_shared/payments/mocks/in-memory-adapter'

const expected: ExpectedFinancialSnapshot = {
  provider: 'CLIP',
  orderId: 'order-1',
  amountCents: 140000,
  currency: 'MXN',
}

function payment(overrides: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    provider: 'CLIP',
    providerTransactionId: 'pay-1',
    providerRawStatus: 'mock_approved',
    normalizedStatus: 'APPROVED',
    amountCents: 140000,
    currency: 'MXN',
    orderCorrelation: 'order-1',
    ...overrides,
  }
}

const checkoutInput = {
  eligibility: 'PAYMENT_ELIGIBLE',
  orderId: 'order-1',
  provider: 'CLIP' as const,
  amountCents: 140000,
  currency: 'MXN' as const,
  reference: 'ref',
  description: 'desc',
  returnUrls: {
    success: 'https://app.test/s',
    failure: 'https://app.test/f',
    pending: 'https://app.test/p',
  },
}

describe('MULTI-PAY-3 redirect and event are not financial authority', () => {
  it('cannot mark PAID from redirect or verified event', async () => {
    const adapter = createInMemoryPaymentAdapter('CLIP')
    const checkout = await adapter.createCheckout(parseResolvedPaymentCheckoutInput(checkoutInput))
    expect(decidePaidSemanticsFromRedirect(checkout)).toEqual({
      paidSemantics: false,
      source: 'redirect',
    })

    const event = await adapter.verifyEvent({
      provider: 'CLIP',
      authenticity: { mechanism: 'event_handle' },
      eventId: 'evt-1',
      transactionHandle: checkout.checkoutHandle,
    })
    expect(decidePaidSemanticsFromVerifiedEvent(event)).toEqual({
      paidSemantics: false,
      source: 'verified_event',
    })
  })

  it('represents APPROVED only as financial-resolution output', async () => {
    const adapter = createInMemoryPaymentAdapter('MERCADO_PAGO', {
      payment: {
        providerTransactionId: 'pay-approved',
        providerRawStatus: 'mock_approved',
        normalizedStatus: 'APPROVED',
        amountCents: 140000,
        currency: 'MXN',
        orderCorrelation: 'order-1',
      },
    })
    const resolved = await adapter.getPayment('pay-approved')
    expect(resolved.normalizedStatus).toBe('APPROVED')
    expect(
      decidePaidSemanticsFromPayment(
        { provider: 'MERCADO_PAGO', orderId: 'order-1', amountCents: 140000, currency: 'MXN' },
        resolved,
      ),
    ).toEqual({
      paidSemantics: 'eligible_for_domain_tx',
      source: 'financial_resolution',
      normalizedStatus: 'APPROVED',
    })
  })
})

describe('MULTI-PAY-3 fail-closed financial correspondence', () => {
  it('keeps UNKNOWN fail-closed', () => {
    expect(normalizeMockContractStatus('totally-unlisted-status')).toBe('UNKNOWN')
    expect(
      decidePaidSemanticsFromPayment(expected, payment({ normalizedStatus: 'UNKNOWN' })),
    ).toEqual({ paidSemantics: false, source: 'unknown_status' })
  })

  it('detects amount mismatch', () => {
    expect(correspondFinancially(expected, payment({ amountCents: 1 }))).toEqual({
      ok: false,
      reason: 'AMOUNT_MISMATCH',
    })
    expect(decidePaidSemanticsFromPayment(expected, payment({ amountCents: 1 }))).toMatchObject({
      paidSemantics: false,
      source: 'financial_mismatch',
      reason: 'AMOUNT_MISMATCH',
    })
  })

  it('detects currency mismatch and missing currency', () => {
    expect(correspondFinancially(expected, payment({ currency: 'USD' }))).toEqual({
      ok: false,
      reason: 'CURRENCY_MISMATCH',
    })
    expect(correspondFinancially(expected, payment({ currency: null }))).toEqual({
      ok: false,
      reason: 'MISSING_CURRENCY',
    })
  })

  it('detects provider mismatch', () => {
    expect(correspondFinancially(expected, payment({ provider: 'OPENPAY' }))).toEqual({
      ok: false,
      reason: 'PROVIDER_MISMATCH',
    })
  })

  it('detects correlation mismatch and missing correlation', () => {
    expect(correspondFinancially(expected, payment({ orderCorrelation: 'other' }))).toEqual({
      ok: false,
      reason: 'CORRELATION_MISMATCH',
    })
    expect(correspondFinancially(expected, payment({ orderCorrelation: null }))).toEqual({
      ok: false,
      reason: 'MISSING_CORRELATION',
    })
  })

  it('does not treat pending, rejected, refunded, or charged-back as PAID-eligible', () => {
    for (const status of ['PENDING', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'] as const) {
      expect(decidePaidSemanticsFromPayment(expected, payment({ normalizedStatus: status }))).toEqual({
        paidSemantics: false,
        source: 'non_approved',
        normalizedStatus: status,
      })
    }
  })
})

describe('MULTI-PAY-3C provider transaction identity fail-closed', () => {
  it('rejects empty providerTransactionId before eligible_for_domain_tx', () => {
    expect(
      decidePaidSemanticsFromPayment(expected, payment({ providerTransactionId: '' })),
    ).toEqual({ paidSemantics: false, source: 'missing_transaction_id' })
  })

  it('rejects whitespace-only providerTransactionId before eligible_for_domain_tx', () => {
    expect(
      decidePaidSemanticsFromPayment(expected, payment({ providerTransactionId: '   ' })),
    ).toEqual({ paidSemantics: false, source: 'missing_transaction_id' })
  })

  it('rejects missing providerTransactionId even if loosely constructed', () => {
    expect(
      decidePaidSemanticsFromPayment(
        expected,
        payment({ providerTransactionId: undefined as unknown as string }),
      ),
    ).toEqual({ paidSemantics: false, source: 'missing_transaction_id' })
  })

  it('allows eligible_for_domain_tx only with a non-empty transaction id and full correspondence', () => {
    expect(decidePaidSemanticsFromPayment(expected, payment({ providerTransactionId: 'pay-ok' }))).toEqual({
      paidSemantics: 'eligible_for_domain_tx',
      source: 'financial_resolution',
      normalizedStatus: 'APPROVED',
    })
  })

  it('cannot bypass missing transaction identity via redirect', async () => {
    const adapter = createInMemoryPaymentAdapter('CLIP')
    const checkout = await adapter.createCheckout(parseResolvedPaymentCheckoutInput(checkoutInput))
    expect(decidePaidSemanticsFromRedirect(checkout).paidSemantics).toBe(false)
  })

  it('cannot bypass missing transaction identity via verified event', async () => {
    const adapter = createInMemoryPaymentAdapter('CLIP')
    const event = await adapter.verifyEvent({
      provider: 'CLIP',
      authenticity: { mechanism: 'event_handle' },
      eventId: 'evt-missing-tx',
      transactionHandle: 'pay-1',
    })
    expect(decidePaidSemanticsFromVerifiedEvent(event).paidSemantics).toBe(false)
  })
})

describe('MULTI-PAY-3 duplicate event boundary', () => {
  it('represents a duplicate event without repeating the business effect', () => {
    const gate = createInMemoryEventEffectGate()
    let effects = 0
    expect(
      gate.applyOnce('CLIP', 'evt-9', () => {
        effects += 1
      }),
    ).toEqual({ applied: true, duplicate: false })
    expect(
      gate.applyOnce('CLIP', 'evt-9', () => {
        effects += 1
      }),
    ).toEqual({ applied: false, duplicate: true })
    expect(
      gate.applyOnce('OPENPAY', 'evt-9', () => {
        effects += 1
      }),
    ).toEqual({ applied: true, duplicate: false })
    expect(effects).toBe(2)
  })
})
