import { describe, expect, it } from 'vitest'
import {
  PaymentContractError,
  SAFE_RUNTIME_ENABLEMENT,
  createPaymentCheckout,
  describeProviderAvailability,
  parseResolvedPaymentCheckoutInput,
} from '../../../insforge/functions/_shared/payments'
import type {
  PaymentProviderAdapter,
  ProviderEnablement,
  PaymentProviderRegistry,
  ResolvedPaymentCheckoutInput,
} from '../../../insforge/functions/_shared/payments'
import { createInMemoryPaymentAdapter } from '../../../insforge/functions/_shared/payments/mocks/in-memory-adapter'

const ORDER_ID = '11111111-1111-1111-1111-111111111111'

function resolvedInput(overrides: Record<string, unknown> = {}) {
  return {
    eligibility: 'PAYMENT_ELIGIBLE',
    orderId: ORDER_ID,
    provider: 'MERCADO_PAGO',
    amountCents: 140000,
    currency: 'MXN',
    reference: 'R2H-ORDER-1',
    description: 'Ready2Hybrid checkout',
    returnUrls: {
      success: 'https://app.test/success',
      failure: 'https://app.test/failure',
      pending: 'https://app.test/pending',
    },
    ...overrides,
  }
}

function wrap(adapter: PaymentProviderAdapter) {
  const calls = {
    createCheckout: 0,
    verifyEvent: 0,
    getPayment: 0,
    lastCheckoutInput: null as ResolvedPaymentCheckoutInput | null,
  }
  const wrapped: PaymentProviderAdapter = {
    provider: adapter.provider,
    async createCheckout(input) {
      calls.createCheckout += 1
      calls.lastCheckoutInput = input
      return adapter.createCheckout(input)
    },
    async verifyEvent(event) {
      calls.verifyEvent += 1
      return adapter.verifyEvent(event)
    },
    async getPayment(handle) {
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

const ALL_ENABLED: ProviderEnablement = {
  MERCADO_PAGO: true,
  CLIP: true,
  OPENPAY: true,
}

describe('MULTI-PAY-7 checkout orchestration', () => {
  it('routes selected MERCADO_PAGO to the Mercado Pago adapter only', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    const clip = wrap(createInMemoryPaymentAdapter('CLIP'))
    const openpay = wrap(createInMemoryPaymentAdapter('OPENPAY'))
    const result = await createPaymentCheckout({
      input: resolvedInput({ provider: 'MERCADO_PAGO' }),
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip, OPENPAY: openpay }),
    })
    expect(result.provider).toBe('MERCADO_PAGO')
    expect(mp.calls.createCheckout).toBe(1)
    expect(clip.calls.createCheckout).toBe(0)
    expect(openpay.calls.createCheckout).toBe(0)
  })

  it('routes selected CLIP to the Clip adapter only', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    const clip = wrap(createInMemoryPaymentAdapter('CLIP'))
    const openpay = wrap(createInMemoryPaymentAdapter('OPENPAY'))
    const result = await createPaymentCheckout({
      input: resolvedInput({ provider: 'CLIP' }),
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip, OPENPAY: openpay }),
    })
    expect(result.provider).toBe('CLIP')
    expect(clip.calls.createCheckout).toBe(1)
    expect(mp.calls.createCheckout).toBe(0)
    expect(openpay.calls.createCheckout).toBe(0)
  })

  it('routes selected OPENPAY to the Openpay adapter only', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    const clip = wrap(createInMemoryPaymentAdapter('CLIP'))
    const openpay = wrap(createInMemoryPaymentAdapter('OPENPAY'))
    const result = await createPaymentCheckout({
      input: resolvedInput({ provider: 'OPENPAY' }),
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip, OPENPAY: openpay }),
    })
    expect(result.provider).toBe('OPENPAY')
    expect(openpay.calls.createCheckout).toBe(1)
    expect(mp.calls.createCheckout).toBe(0)
    expect(clip.calls.createCheckout).toBe(0)
  })

  it('fails closed when MERCADO_PAGO is selected but disabled', async () => {
    await expect(
      createPaymentCheckout({
        input: resolvedInput({ provider: 'MERCADO_PAGO' }),
        enablement: { MERCADO_PAGO: false, CLIP: true, OPENPAY: true },
        registry: {
          MERCADO_PAGO: createInMemoryPaymentAdapter('MERCADO_PAGO'),
          CLIP: createInMemoryPaymentAdapter('CLIP'),
          OPENPAY: createInMemoryPaymentAdapter('OPENPAY'),
        },
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
  })

  it('fails closed when CLIP is selected but disabled', async () => {
    await expect(
      createPaymentCheckout({
        input: resolvedInput({ provider: 'CLIP' }),
        enablement: { MERCADO_PAGO: true, CLIP: false, OPENPAY: true },
        registry: { CLIP: createInMemoryPaymentAdapter('CLIP') },
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
  })

  it('fails closed when OPENPAY is selected but disabled', async () => {
    await expect(
      createPaymentCheckout({
        input: resolvedInput({ provider: 'OPENPAY' }),
        enablement: { MERCADO_PAGO: true, CLIP: true, OPENPAY: false },
        registry: { OPENPAY: createInMemoryPaymentAdapter('OPENPAY') },
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
  })

  it('fails closed when the selected adapter is missing from the registry', async () => {
    await expect(
      createPaymentCheckout({
        input: resolvedInput({ provider: 'CLIP' }),
        enablement: ALL_ENABLED,
        registry: { MERCADO_PAGO: createInMemoryPaymentAdapter('MERCADO_PAGO') },
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
  })

  it('fails closed when the registered adapter provider does not match the selection', async () => {
    const mismatched = createInMemoryPaymentAdapter('MERCADO_PAGO')
    await expect(
      createPaymentCheckout({
        input: resolvedInput({ provider: 'CLIP' }),
        enablement: ALL_ENABLED,
        registry: { CLIP: mismatched },
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
  })

  it('does not fall back to Mercado Pago when Clip is selected', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    const clip = wrap(createInMemoryPaymentAdapter('CLIP'))
    await createPaymentCheckout({
      input: resolvedInput({ provider: 'CLIP' }),
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, CLIP: clip }),
    })
    expect(mp.calls.createCheckout).toBe(0)
    expect(clip.calls.createCheckout).toBe(1)
  })

  it('does not fall back to Clip when Openpay is selected', async () => {
    const clip = wrap(createInMemoryPaymentAdapter('CLIP'))
    const openpay = wrap(createInMemoryPaymentAdapter('OPENPAY'))
    await createPaymentCheckout({
      input: resolvedInput({ provider: 'OPENPAY' }),
      enablement: ALL_ENABLED,
      registry: registryOf({ CLIP: clip, OPENPAY: openpay }),
    })
    expect(clip.calls.createCheckout).toBe(0)
    expect(openpay.calls.createCheckout).toBe(1)
  })

  it('does not fall back to Openpay when Mercado Pago is selected', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    const openpay = wrap(createInMemoryPaymentAdapter('OPENPAY'))
    await createPaymentCheckout({
      input: resolvedInput({ provider: 'MERCADO_PAGO' }),
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp, OPENPAY: openpay }),
    })
    expect(openpay.calls.createCheckout).toBe(0)
    expect(mp.calls.createCheckout).toBe(1)
  })

  it('preserves canonical order id, amount, and currency without recomputation', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    await createPaymentCheckout({
      input: resolvedInput({
        provider: 'MERCADO_PAGO',
        orderId: ORDER_ID,
        amountCents: 140000,
        currency: 'MXN',
      }),
      enablement: ALL_ENABLED,
      registry: registryOf({ MERCADO_PAGO: mp }),
    })
    expect(mp.calls.lastCheckoutInput?.orderId).toBe(ORDER_ID)
    expect(mp.calls.lastCheckoutInput?.amountCents).toBe(140000)
    expect(mp.calls.lastCheckoutInput?.currency).toBe('MXN')
    expect(mp.calls.lastCheckoutInput?.eligibility).toBe('PAYMENT_ELIGIBLE')
  })

  it('requires PAYMENT_ELIGIBLE before selecting an adapter', async () => {
    const mp = wrap(createInMemoryPaymentAdapter('MERCADO_PAGO'))
    await expect(
      createPaymentCheckout({
        input: resolvedInput({ eligibility: 'MAYBE' }),
        enablement: ALL_ENABLED,
        registry: registryOf({ MERCADO_PAGO: mp }),
      }),
    ).rejects.toBeInstanceOf(PaymentContractError)
    expect(mp.calls.createCheckout).toBe(0)
  })

  it('returns checkout handle and redirect URL with financialAuthority false', async () => {
    const result = await createPaymentCheckout({
      input: resolvedInput({ provider: 'CLIP' }),
      enablement: ALL_ENABLED,
      registry: { CLIP: createInMemoryPaymentAdapter('CLIP', { checkoutHandle: 'clip-h', redirectUrl: 'https://clip.test/pay' }) },
    })
    expect(result.checkoutHandle).toBe('clip-h')
    expect(result.redirectUrl).toBe('https://clip.test/pay')
    expect(result.financialAuthority).toBe(false)
    expect(result).not.toHaveProperty('normalizedStatus')
    expect(result).not.toHaveProperty('ticketId')
    expect(result).not.toHaveProperty('registrationId')
  })

  it('never places provider secrets or PII on the shared checkout DTO', async () => {
    const result = await createPaymentCheckout({
      input: resolvedInput({ provider: 'OPENPAY' }),
      enablement: ALL_ENABLED,
      registry: { OPENPAY: createInMemoryPaymentAdapter('OPENPAY') },
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/access_token|secret|password|private_key|pan|cvv|email|phone/i)
    expect(result).not.toHaveProperty('customer')
    expect(result).not.toHaveProperty('clientIp')
  })

  it('rejects catalog and price authority keys before orchestration', () => {
    expect(() => parseResolvedPaymentCheckoutInput(resolvedInput({ unit_price_cents: 1 }))).toThrow(
      PaymentContractError,
    )
    expect(() => parseResolvedPaymentCheckoutInput(resolvedInput({ sku: 'X' }))).toThrow(
      PaymentContractError,
    )
  })

  it('does not treat adapter existence as runtime enablement', () => {
    const availability = describeProviderAvailability(SAFE_RUNTIME_ENABLEMENT)
    expect(availability.MERCADO_PAGO.implemented).toBe(true)
    expect(availability.CLIP.implemented).toBe(true)
    expect(availability.OPENPAY.implemented).toBe(true)
    expect(availability.MERCADO_PAGO.runtimeEnabled).toBe(false)
    expect(availability.CLIP.runtimeEnabled).toBe(false)
    expect(availability.OPENPAY.runtimeEnabled).toBe(false)
    expect(SAFE_RUNTIME_ENABLEMENT).toEqual({
      MERCADO_PAGO: false,
      CLIP: false,
      OPENPAY: false,
    })
  })
})
