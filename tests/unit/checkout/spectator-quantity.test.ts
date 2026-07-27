import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
  type CheckoutTxResult,
} from '../../../insforge/functions/_shared/checkout/orchestrate'
import { createMockMercadoPagoClient } from '../../../insforge/functions/_shared/checkout/mp-client'
import { buildPriceSnapshot } from '../../../insforge/functions/_shared/checkout/pricing'
import {
  assertQuantityForProduct,
  capacityUnitsForQuantity,
} from '../../../insforge/functions/_shared/checkout/quantity'
import { parseCheckoutRequest } from '../../../insforge/functions/_shared/checkout/validate'

const spectator = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  code: 'PUB-VIE',
  name: 'Público Viernes',
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
}

const competitor = {
  ...spectator,
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  code: 'IND-H',
  name: 'Individual Hombre',
  block: 'COMPITE',
  kind: 'competitor',
  cupo: 60,
  price_cents: 140000,
  has_chip: true,
  has_insurance: true,
}

const team = {
  ...competitor,
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  code: 'HALF-DOB-MM',
  name: 'Half Dobles',
  kind: 'competitor',
  team_size: 2,
  price_cents: 160000,
}

const press = {
  ...spectator,
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  code: 'FOT-VIE',
  name: 'Fotógrafo Viernes',
  kind: 'press',
  cupo: 40,
}

const openEvent = {
  code: 'HEX-2026',
  status: 'EN_VENTA',
  sales_open_at: '2026-01-01T00:00:00.000Z',
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
  TEAM_INVITATION_TTL_SECONDS: '604800',
}

function envMap(map: Record<string, string>) {
  return (key: string) => map[key]
}

function body(product_code: string, quantity?: unknown, extras: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {
    product_code,
    idempotency_key: `idem-${product_code}-${Date.now()}-xxxxxxxx`,
    ...extras,
  }
  if (quantity !== undefined) payload.quantity = quantity
  if (product_code.startsWith('IND') || product_code.startsWith('HALF') || product_code.startsWith('DOB')) {
    payload.waiver = {
      document_type: 'SPORTS_WAIVER',
      version: '2026.1',
      accepted: true,
    }
  }
  return payload
}

function memoryRepo(seed?: Partial<CheckoutTxResult>): CheckoutRepository {
  const tx = {
    orderId: '22222222-2222-2222-2222-222222222222',
    trackingRef: 'trk_test',
    orderItemId: '33333333-3333-3333-3333-333333333333',
    holdId: '44444444-4444-4444-4444-444444444444',
    expiresAt: '2026-07-26T12:00:00.000Z',
    replay: false,
    priorResponse: null,
    invitationTokens: [],
    ...seed,
  } satisfies CheckoutTxResult
  return {
    async startCheckoutTx() {
      return tx
    },
    async attachPreference() {},
    async compensatePreferenceFailure() {},
  }
}

describe('OD-001 spectator quantity validation', () => {
  it('spectator quantity 1 = PASS', () => {
    expect(() => assertQuantityForProduct(spectator, 1)).not.toThrow()
    expect(capacityUnitsForQuantity(spectator, 1)).toBe(1)
  })

  it('spectator quantity 2 = PASS', () => {
    expect(() => assertQuantityForProduct(spectator, 2)).not.toThrow()
    expect(capacityUnitsForQuantity(spectator, 2)).toBe(2)
  })

  it('spectator quantity 0 = REJECT', () => {
    expect(() => assertQuantityForProduct(spectator, 0)).toThrow(CheckoutError)
    expect(() => parseCheckoutRequest(body('PUB-VIE', 0))).toThrow(CheckoutError)
  })

  it('spectator quantity decimal = REJECT', () => {
    expect(() => parseCheckoutRequest(body('PUB-VIE', 1.5))).toThrow(CheckoutError)
  })

  it('spectator quantity negativa = REJECT', () => {
    expect(() => parseCheckoutRequest(body('PUB-VIE', -2))).toThrow(CheckoutError)
  })

  it('competitor quantity 2 = REJECT', () => {
    try {
      assertQuantityForProduct(competitor, 2)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError)
      expect((e as CheckoutError).code).toBe('INVALID_REQUEST')
    }
  })

  it('team product quantity 2 = REJECT', () => {
    try {
      assertQuantityForProduct(team, 2)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError)
      expect((e as CheckoutError).code).toBe('INVALID_REQUEST')
    }
  })

  it('press quantity 2 = REJECT (spectator-only OD-001)', () => {
    try {
      assertQuantityForProduct(press, 2)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError)
      expect((e as CheckoutError).code).toBe('INVALID_REQUEST')
    }
  })

  it('quantity superior al cupo = REJECT', () => {
    const tiny = { ...spectator, cupo: 1 }
    try {
      assertQuantityForProduct(tiny, 2)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CheckoutError)
      expect((e as CheckoutError).code).toBe('SOLD_OUT')
    }
  })

  it('PUB-VIE unit price × 2 = total correcto', () => {
    const snap = buildPriceSnapshot(spectator, 'J5', 2)
    expect(snap.unit_price_cents).toBe(25000)
    expect(snap.quantity).toBe(2)
    expect(snap.item_total_cents).toBe(50000)
    expect(snap.total_cents).toBe(50000)
  })
})

describe('OD-001 orchestrate spectator quantity=2', () => {
  it('passes quantity and capacity_units=2 into TX-1', async () => {
    const repo = memoryRepo()
    const start = vi.spyOn(repo, 'startCheckoutTx')
    const catalog: CatalogPort = {
      async getProductWithEvent() {
        return { product: spectator, event: openEvent }
      },
    }
    const result = await orchestrateCheckoutStart(body('PUB-VIE', 2), {
      env: envMap(requiredEnv),
      catalog,
      repo,
      mp: createMockMercadoPagoClient(),
    })
    expect(result.status).toBe(200)
    expect(start).toHaveBeenCalledOnce()
    const arg = start.mock.calls[0][0]
    expect(arg.quantity).toBe(2)
    expect(arg.capacityUnits).toBe(2)
    expect(arg.unitPriceCents).toBe(25000)
    expect(arg.totalCents).toBe(50000)
    expect(arg.commercialSnapshot).toMatchObject({ quantity: 2 })
  })

  it('rejects competitor quantity=2 before TX', async () => {
    const repo = memoryRepo()
    const start = vi.spyOn(repo, 'startCheckoutTx')
    const result = await orchestrateCheckoutStart(body('IND-H', 2), {
      env: envMap(requiredEnv),
      catalog: {
        async getProductWithEvent() {
          return { product: competitor, event: openEvent }
        },
      },
      repo,
      mp: createMockMercadoPagoClient(),
    })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ error: { code: 'INVALID_REQUEST' } })
    expect(start).not.toHaveBeenCalled()
  })
})

describe('0010 spectator multi-quantity SQL contracts', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'insforge/migrations/0010_spectator-multi-quantity.sql'),
    'utf8',
  )

  it('authorizes spectator multi-unit and rejects other kinds qty>1', () => {
    expect(sql).toContain("v_product.kind = 'spectator'")
    expect(sql).toContain('v_units := v_qty')
    expect(sql).toContain('IF v_qty <> 1 THEN')
    expect(sql).toContain('FOR v_i IN 1..v_qty LOOP')
    expect(sql).toContain("'access_'")
  })

  it('does not edit schema tables or prior migrations', () => {
    expect(sql).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i)
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.checkout_start_tx')
  })
})
