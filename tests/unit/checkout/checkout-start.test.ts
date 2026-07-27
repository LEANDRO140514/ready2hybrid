import { describe, expect, it, vi } from 'vitest'
import { loadCheckoutRuntimeConfig } from '../../../insforge/functions/_shared/checkout/config'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { createMockMercadoPagoClient } from '../../../insforge/functions/_shared/checkout/mp-client'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
  type CheckoutTxResult,
} from '../../../insforge/functions/_shared/checkout/orchestrate'
import { buildPriceSnapshot } from '../../../insforge/functions/_shared/checkout/pricing'
import { assertSalesOpen } from '../../../insforge/functions/_shared/checkout/sales'
import { parseCheckoutRequest } from '../../../insforge/functions/_shared/checkout/validate'
import { journeyForProductCode } from '../../../insforge/functions/_shared/checkout/journeys'

const baseProduct = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'IND-H',
  name: 'Individual Hombre Open',
  block: 'COMPITE',
  kind: 'competitor',
  sale_state: null,
  visibility: null,
  cupo: 60,
  price_cents: 140000,
  currency: 'MXN',
  team_size: 1,
  event_code: 'HEX-2026',
  has_chip: true,
  has_insurance: true,
  day: '2026-10-11',
}

const openEvent = {
  code: 'HEX-2026',
  status: 'EN_VENTA',
  sales_open_at: '2026-01-01T00:00:00.000Z',
  sales_close_at: null,
}

const configuredEvent = {
  code: 'HEX-2026',
  status: 'CONFIGURADO',
  sales_open_at: null,
  sales_close_at: null,
}

function envMap(map: Record<string, string>) {
  return (key: string) => map[key]
}

const requiredEnv = {
  MERCADOPAGO_ACCESS_TOKEN: 'TEST_TOKEN_NOT_REAL',
  CHECKOUT_HOLD_DURATION_SECONDS: '900',
  CHECKOUT_IDEMPOTENCY_TTL_SECONDS: '86400',
  CHECKOUT_BACK_URL_SUCCESS: 'https://example.com/success',
  CHECKOUT_BACK_URL_FAILURE: 'https://example.com/failure',
  CHECKOUT_BACK_URL_PENDING: 'https://example.com/pending',
  CHECKOUT_NOTIFICATION_URL: 'https://example.com/notify',
  CHECKOUT_WAIVER_DOCUMENT_TYPE: 'SPORTS_WAIVER',
  CHECKOUT_WAIVER_VERSION: '2026.1',
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    product_code: 'IND-H',
    idempotency_key: 'idem-key-12345678',
    waiver: {
      document_type: 'SPORTS_WAIVER',
      version: '2026.1',
      accepted: true,
    },
    ...overrides,
  }
}

function memoryRepo(seed?: Partial<CheckoutTxResult>): CheckoutRepository {
  const store = {
    calls: [] as string[],
    tx: {
      orderId: '22222222-2222-2222-2222-222222222222',
      trackingRef: 'trk_test',
      orderItemId: '33333333-3333-3333-3333-333333333333',
      holdId: '44444444-4444-4444-4444-444444444444',
      expiresAt: '2026-07-25T12:00:00.000Z',
      replay: false,
      priorResponse: null,
      invitationTokens: [],
      ...seed,
    } satisfies CheckoutTxResult,
  }
  return {
    async startCheckoutTx() {
      store.calls.push('start')
      return store.tx
    },
    async attachPreference() {
      store.calls.push('attach')
    },
    async compensatePreferenceFailure() {
      store.calls.push('compensate')
    },
  }
}

describe('checkout validate', () => {
  it('accepts a valid payload', () => {
    const parsed = parseCheckoutRequest(validBody())
    expect(parsed.quantity).toBe(1)
    expect(parsed.product_code).toBe('IND-H')
  })

  it('rejects invalid payload', () => {
    expect(() => parseCheckoutRequest({ product_code: 'IND-H' })).toThrow(CheckoutError)
  })

  it('rejects client price authority', () => {
    expect(() => parseCheckoutRequest(validBody({ price_cents: 1 }))).toThrow(/price_cents|INVALID/)
  })

  it('rejects client currency authority', () => {
    expect(() => parseCheckoutRequest(validBody({ currency: 'USD' }))).toThrow(CheckoutError)
  })
})

describe('sales gate', () => {
  it('rejects CONFIGURADO as SALES_NOT_OPEN', () => {
    try {
      assertSalesOpen(configuredEvent)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError)
      expect((e as CheckoutError).code).toBe('SALES_NOT_OPEN')
    }
  })
})

describe('pricing', () => {
  it('prices Individual once', () => {
    const snap = buildPriceSnapshot(baseProduct, 'J1', 1)
    expect(snap.total_cents).toBe(140000)
    expect(snap.chip_extra_cents).toBe(0)
    expect(snap.insurance_extra_cents).toBe(0)
  })

  it('prices Dobles as full pair unit', () => {
    const dobles = {
      ...baseProduct,
      code: 'DOB-VIE-MM',
      price_cents: 240000,
      team_size: 2,
    }
    const snap = buildPriceSnapshot(dobles, 'J2', 1)
    expect(snap.total_cents).toBe(240000)
    expect(snap.economic_unit).toBe('pair')
  })

  it('prices Relay as full team unit', () => {
    const relay = {
      ...baseProduct,
      code: 'REL-4H',
      price_cents: 320000,
      team_size: 4,
    }
    const snap = buildPriceSnapshot(relay, 'J3', 1)
    expect(snap.total_cents).toBe(320000)
    expect(snap.economic_unit).toBe('team')
  })
})

describe('config fail-closed', () => {
  it('fails when return URL missing', () => {
    const env = { ...requiredEnv }
    delete (env as { CHECKOUT_BACK_URL_SUCCESS?: string }).CHECKOUT_BACK_URL_SUCCESS
    expect(() => loadCheckoutRuntimeConfig(envMap(env))).toThrow(CheckoutError)
  })

  it('fails when hold duration missing', () => {
    const env = { ...requiredEnv }
    delete (env as { CHECKOUT_HOLD_DURATION_SECONDS?: string }).CHECKOUT_HOLD_DURATION_SECONDS
    expect(() => loadCheckoutRuntimeConfig(envMap(env))).toThrow(CheckoutError)
  })

  it('fails when MP secret missing', () => {
    const env = { ...requiredEnv }
    delete (env as { MERCADOPAGO_ACCESS_TOKEN?: string }).MERCADOPAGO_ACCESS_TOKEN
    expect(() => loadCheckoutRuntimeConfig(envMap(env))).toThrow(CheckoutError)
  })
})

describe('orchestrateCheckoutStart', () => {
  it('returns SALES_NOT_OPEN for CONFIGURADO without creating tx or MP preference', async () => {
    const catalog: CatalogPort = {
      async getProductWithEvent() {
        return { product: baseProduct, event: configuredEvent }
      },
    }
    const repo = memoryRepo()
    const mp = createMockMercadoPagoClient(async () => {
      throw new Error('MP should not be called')
    })
    const startSpy = vi.spyOn(repo, 'startCheckoutTx')
    const result = await orchestrateCheckoutStart(validBody(), {
      env: envMap(requiredEnv),
      catalog,
      repo,
      mp,
    })
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ error: { code: 'SALES_NOT_OPEN' } })
    expect(startSpy).not.toHaveBeenCalled()
  })

  it('rejects unknown product', async () => {
    const result = await orchestrateCheckoutStart(validBody({ product_code: 'NOPE' }), {
      env: envMap(requiredEnv),
      catalog: { async getProductWithEvent() { return null } },
      repo: memoryRepo(),
      mp: createMockMercadoPagoClient(),
    })
    expect(result.status).toBe(404)
  })

  it('rejects inactive product', async () => {
    const result = await orchestrateCheckoutStart(validBody(), {
      env: envMap(requiredEnv),
      catalog: {
        async getProductWithEvent() {
          return {
            product: { ...baseProduct, sale_state: 'INACTIVE' },
            event: openEvent,
          }
        },
      },
      repo: memoryRepo(),
      mp: createMockMercadoPagoClient(),
    })
    expect(result.body).toMatchObject({ error: { code: 'PRODUCT_NOT_AVAILABLE' } })
  })

  it('creates checkout when sales are open', async () => {
    const repo = memoryRepo()
    const result = await orchestrateCheckoutStart(validBody(), {
      env: envMap(requiredEnv),
      catalog: {
        async getProductWithEvent() {
          return { product: baseProduct, event: openEvent }
        },
      },
      repo,
      mp: createMockMercadoPagoClient(),
    })
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      checkout_url: expect.stringContaining('mercadopago'),
      public_order_reference: 'trk_test',
    })
    expect(JSON.stringify(result.body)).not.toContain('TEST_TOKEN')
    expect(JSON.stringify(result.body)).not.toContain('MERCADOPAGO')
    expect(result.body).not.toHaveProperty('order_id')
    expect(result.body).not.toHaveProperty('preference_id')
  })

  it('compensates when Mercado Pago fails', async () => {
    const repo = memoryRepo()
    const compensate = vi.spyOn(repo, 'compensatePreferenceFailure')
    const result = await orchestrateCheckoutStart(validBody(), {
      env: envMap(requiredEnv),
      catalog: {
        async getProductWithEvent() {
          return { product: baseProduct, event: openEvent }
        },
      },
      repo,
      mp: createMockMercadoPagoClient(async () => {
        throw new CheckoutError('CHECKOUT_CREATION_FAILED')
      }),
    })
    expect(result.body).toMatchObject({ error: { code: 'CHECKOUT_CREATION_FAILED' } })
    expect(compensate).toHaveBeenCalledOnce()
  })

  it('replays identical idempotent response', async () => {
    const prior = {
      checkout_url: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_replay',
      public_order_reference: 'trk_replay',
      expires_at: '2026-07-25T12:00:00.000Z',
    }
    const repo = memoryRepo({
      replay: true,
      priorResponse: prior,
    })
    const mp = createMockMercadoPagoClient(async () => {
      throw new Error('should not create preference on replay')
    })
    const result = await orchestrateCheckoutStart(validBody(), {
      env: envMap(requiredEnv),
      catalog: {
        async getProductWithEvent() {
          return { product: baseProduct, event: openEvent }
        },
      },
      repo,
      mp,
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual(prior)
  })

  it('maps journeys for catalog codes', () => {
    expect(journeyForProductCode('IND-H')).toBe('J1')
    expect(journeyForProductCode('DOB-VIE-MM')).toBe('J2')
    expect(journeyForProductCode('REL-4H')).toBe('J3')
    expect(journeyForProductCode('WOD-M')).toBe('J4')
    expect(journeyForProductCode('PUB-VIE')).toBe('J5')
  })
})
