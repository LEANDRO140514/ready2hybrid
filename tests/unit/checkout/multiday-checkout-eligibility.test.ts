import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertCheckoutProductAvailable,
  isMultidayCheckoutBlocked,
} from '../../../insforge/functions/_shared/checkout/eligibility'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
  type CheckoutTxResult,
} from '../../../insforge/functions/_shared/checkout/orchestrate'
import { createMockMercadoPagoClient } from '../../../insforge/functions/_shared/checkout/mp-client'
import type { ProductSalesRow } from '../../../insforge/functions/_shared/checkout/sales'

const configuredEvent = {
  code: 'HEX-2026',
  status: 'CONFIGURADO',
  sales_open_at: null,
  sales_close_at: null,
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

function envMap(map: Record<string, string>) {
  return (key: string) => map[key]
}

function asiste(overrides: Partial<ProductSalesRow>): ProductSalesRow {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    code: 'PUB-VIE',
    name: 'Público',
    block: 'ASISTE',
    kind: 'spectator',
    sale_state: null,
    visibility: null,
    cupo: 500,
    price_cents: 25000,
    currency: 'MXN',
    team_size: 1,
    event_code: 'HEX-2026',
    has_chip: false,
    has_insurance: false,
    day: '2026-10-09',
    ...overrides,
  }
}

const products: Record<string, ProductSalesRow> = {
  'PUB-VIE': asiste({ code: 'PUB-VIE', day: '2026-10-09', price_cents: 25000 }),
  'PUB-SAB': asiste({ code: 'PUB-SAB', day: '2026-10-10', price_cents: 25000 }),
  'PUB-DOM': asiste({ code: 'PUB-DOM', day: '2026-10-11', price_cents: 25000 }),
  'PUB-3D': asiste({ code: 'PUB-3D', day: null, cupo: 300, price_cents: 60000 }),
  'FOT-VIE': asiste({
    code: 'FOT-VIE',
    kind: 'press',
    day: '2026-10-09',
    cupo: 30,
    price_cents: 35000,
  }),
  'FOT-SAB': asiste({
    code: 'FOT-SAB',
    kind: 'press',
    day: '2026-10-10',
    cupo: 30,
    price_cents: 35000,
  }),
  'FOT-DOM': asiste({
    code: 'FOT-DOM',
    kind: 'press',
    day: '2026-10-11',
    cupo: 30,
    price_cents: 35000,
  }),
  'FOT-3D': asiste({
    code: 'FOT-3D',
    kind: 'press',
    day: null,
    cupo: 20,
    price_cents: 80000,
  }),
}

function body(product_code: string, quantity = 1) {
  return {
    product_code,
    quantity,
    idempotency_key: `impl13e0-${product_code}-${quantity}-xxxxxxxx`,
  }
}

function memoryRepo(): CheckoutRepository & { calls: string[] } {
  const calls: string[] = []
  const tx = {
    orderId: '22222222-2222-2222-2222-222222222222',
    trackingRef: 'trk_test',
    orderItemId: '33333333-3333-3333-3333-333333333333',
    holdId: '44444444-4444-4444-4444-444444444444',
    expiresAt: '2026-07-26T12:00:00.000Z',
    replay: false,
    priorResponse: null,
    invitationTokens: [],
  } satisfies CheckoutTxResult
  return {
    calls,
    async startCheckoutTx() {
      calls.push('startCheckoutTx')
      return tx
    },
    async attachPreference() {
      calls.push('attachPreference')
    },
    async compensatePreferenceFailure() {
      calls.push('compensatePreferenceFailure')
    },
  }
}

describe('isMultidayCheckoutBlocked / assertCheckoutProductAvailable', () => {
  it('blocks spectator/press with null day (PUB-3D / FOT-3D)', () => {
    expect(isMultidayCheckoutBlocked(products['PUB-3D'])).toBe(true)
    expect(isMultidayCheckoutBlocked(products['FOT-3D'])).toBe(true)
    expect(() => assertCheckoutProductAvailable(products['PUB-3D'])).toThrow(CheckoutError)
    try {
      assertCheckoutProductAvailable(products['FOT-3D'])
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError)
      expect((e as CheckoutError).code).toBe('PRODUCT_NOT_AVAILABLE')
      expect((e as CheckoutError).status).toBe(409)
      expect((e as CheckoutError).toPublicBody().error.message).toBe(
        'This product is not available for checkout.',
      )
    }
  })

  it('allows single-day spectator and press', () => {
    for (const code of ['PUB-VIE', 'PUB-SAB', 'PUB-DOM', 'FOT-VIE', 'FOT-SAB', 'FOT-DOM']) {
      expect(isMultidayCheckoutBlocked(products[code])).toBe(false)
      expect(() => assertCheckoutProductAvailable(products[code])).not.toThrow()
    }
  })

  it('does not block competitors with null day via multiday policy', () => {
    const competitor = asiste({
      code: 'IND-H',
      kind: 'competitor',
      day: null,
      block: 'COMPITE',
    })
    expect(isMultidayCheckoutBlocked(competitor)).toBe(false)
  })
})

describe('orchestrate multiday fail-closed before writes/MP', () => {
  async function run(code: string, quantity = 1) {
    const catalog: CatalogPort = {
      async getProductWithEvent(productCode) {
        const product = products[productCode]
        if (!product) return null
        return { product, event: configuredEvent }
      },
    }
    const repo = memoryRepo()
    const createPreference = vi.fn(async () => {
      throw new Error('MP should not be called')
    })
    const mp = createMockMercadoPagoClient(createPreference)
    const result = await orchestrateCheckoutStart(body(code, quantity), {
      env: envMap(requiredEnv),
      catalog,
      repo,
      mp,
    })
    return { result, repo, createPreference }
  }

  it('PUB-3D → PRODUCT_NOT_AVAILABLE with zero repo/MP calls', async () => {
    const { result, repo, createPreference } = await run('PUB-3D', 1)
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({
      error: {
        code: 'PRODUCT_NOT_AVAILABLE',
        message: 'This product is not available for checkout.',
      },
    })
    expect(repo.calls).toEqual([])
    expect(createPreference).not.toHaveBeenCalled()
  })

  it('FOT-3D → PRODUCT_NOT_AVAILABLE with zero repo/MP calls', async () => {
    const { result, repo, createPreference } = await run('FOT-3D', 1)
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ error: { code: 'PRODUCT_NOT_AVAILABLE' } })
    expect(repo.calls).toEqual([])
    expect(createPreference).not.toHaveBeenCalled()
  })

  it('single-day products remain SALES_NOT_OPEN under CONFIGURADO', async () => {
    const cases: Array<[string, number]> = [
      ['PUB-VIE', 1],
      ['PUB-SAB', 1],
      ['PUB-SAB', 2],
      ['PUB-DOM', 1],
      ['FOT-VIE', 1],
      ['FOT-SAB', 1],
      ['FOT-DOM', 1],
    ]
    for (const [code, qty] of cases) {
      const { result, repo, createPreference } = await run(code, qty)
      expect(result.status).toBe(409)
      expect(result.body).toMatchObject({ error: { code: 'SALES_NOT_OPEN' } })
      expect(repo.calls).toEqual([])
      expect(createPreference).not.toHaveBeenCalled()
    }
  })

  it('unknown product keeps PRODUCT_NOT_FOUND', async () => {
    const { result, repo, createPreference } = await run('NOPE-CODE', 1)
    expect(result.status).toBe(404)
    expect(result.body).toMatchObject({ error: { code: 'PRODUCT_NOT_FOUND' } })
    expect(repo.calls).toEqual([])
    expect(createPreference).not.toHaveBeenCalled()
  })

  it('invalid payload keeps structural precedence', async () => {
    const catalog: CatalogPort = {
      async getProductWithEvent() {
        throw new Error('catalog must not run for invalid payload')
      },
    }
    const repo = memoryRepo()
    const mp = createMockMercadoPagoClient(async () => {
      throw new Error('MP should not be called')
    })
    const result = await orchestrateCheckoutStart(
      { product_code: 'PUB-3D', quantity: 1 },
      { env: envMap(requiredEnv), catalog, repo, mp },
    )
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ error: { code: 'INVALID_REQUEST' } })
    expect(repo.calls).toEqual([])
  })
})

describe('source order: multiday before sales/idempotency/MP', () => {
  it('orchestrate calls eligibility before assertSalesOpen and tx', () => {
    const bodySrc = readFileSync(
      resolve(process.cwd(), 'insforge/functions/_shared/checkout/orchestrate.ts'),
      'utf8',
    )
    const eligibility = bodySrc.indexOf('assertCheckoutProductAvailable(')
    const sales = bodySrc.indexOf('assertSalesOpen(')
    const tx = bodySrc.indexOf('startCheckoutTx(')
    const mp = bodySrc.indexOf('createCheckoutProPreference(')
    expect(eligibility).toBeGreaterThan(-1)
    expect(sales).toBeGreaterThan(eligibility)
    expect(tx).toBeGreaterThan(sales)
    expect(mp).toBeGreaterThan(tx)
  })

  it('handler Origin gate remains before orchestrate (product guard unreachable on bad Origin)', () => {
    const bodySrc = readFileSync(
      resolve(process.cwd(), 'insforge/functions/mp-create-checkout/index.ts'),
      'utf8',
    )
    const origin = bodySrc.indexOf('gateOrigin(req)')
    const orch = bodySrc.indexOf('orchestrateCheckoutStart(')
    expect(origin).toBeGreaterThan(-1)
    expect(orch).toBeGreaterThan(origin)
  })
})
