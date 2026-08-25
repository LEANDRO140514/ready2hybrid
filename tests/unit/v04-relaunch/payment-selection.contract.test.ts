import { describe, expect, it, vi } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { createMockMercadoPagoClient } from '../../../insforge/functions/_shared/checkout/mp-client'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
} from '../../../insforge/functions/_shared/checkout/orchestrate'
import {
  assertSelectedProvider,
  loadRuntimeProviderEnablement,
  parseCheckoutRequest,
} from '../../../insforge/functions/_shared/checkout/validate'
import { checkoutBody, openEvent, productRow } from './helpers'

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

function memoryRepo(): CheckoutRepository {
  return {
    async startCheckoutTx() {
      throw new Error('startCheckoutTx must not run for unsupported provider')
    },
    async attachPreference() {
      throw new Error('attachPreference must not run for unsupported provider')
    },
    async compensatePreferenceFailure() {},
  }
}

describe('v0.4 payment-selection seam', () => {
  it('defaults runtime-enabled providers to Mercado Pago only', () => {
    expect(loadRuntimeProviderEnablement(() => undefined)).toEqual({ MERCADO_PAGO: true })
  })

  it('accepts explicit MERCADO_PAGO when it is runtime-enabled', () => {
    expect(assertSelectedProvider('MERCADO_PAGO', { MERCADO_PAGO: true })).toBe('MERCADO_PAGO')
  })

  it('fails closed for CLIP and OPENPAY when they are not runtime-enabled', () => {
    expect(() => assertSelectedProvider('CLIP', { MERCADO_PAGO: true })).toThrow(CheckoutError)
    expect(() => assertSelectedProvider('OPENPAY', { MERCADO_PAGO: true })).toThrow(CheckoutError)
  })

  it('fails closed when selected_provider is missing', () => {
    expect(() => assertSelectedProvider(undefined, { MERCADO_PAGO: true })).toThrow(CheckoutError)
  })

  it('parses selected_provider on checkout input', () => {
    const parsed = parseCheckoutRequest(checkoutBody({ selected_provider: 'MERCADO_PAGO' }))
    expect(parsed.selected_provider).toBe('MERCADO_PAGO')
  })

  it('does not create a Mercado Pago preference when CLIP is selected', async () => {
    const catalog: CatalogPort = {
      async getProductWithEvent() {
        return { product: productRow({ code: 'IND-H' }), event: openEvent }
      },
    }
    const repo = memoryRepo()
    const startSpy = vi.spyOn(repo, 'startCheckoutTx')
    const result = await orchestrateCheckoutStart(checkoutBody({ selected_provider: 'CLIP' }), {
      env: envMap(requiredEnv),
      catalog,
      repo,
      mp: createMockMercadoPagoClient(async () => {
        throw new Error('Mercado Pago must not be called for CLIP')
      }),
    })
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ error: { code: 'UNSUPPORTED_PROVIDER' } })
    expect(startSpy).not.toHaveBeenCalled()
  })
})
