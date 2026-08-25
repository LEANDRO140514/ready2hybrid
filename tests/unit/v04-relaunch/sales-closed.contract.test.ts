import { describe, expect, it, vi } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { createMockMercadoPagoClient } from '../../../insforge/functions/_shared/checkout/mp-client'
import {
  orchestrateCheckoutStart,
  type CatalogPort,
  type CheckoutRepository,
} from '../../../insforge/functions/_shared/checkout/orchestrate'
import { assertSalesOpen } from '../../../insforge/functions/_shared/checkout/sales'
import { checkoutBody, configuredEvent, currentlyPayableCheckoutEligible, productRow } from './helpers'

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
      throw new Error('startCheckoutTx must not run while sales are closed')
    },
    async attachPreference() {
      throw new Error('attachPreference must not run while sales are closed')
    },
    async compensatePreferenceFailure() {},
  }
}

describe('v0.4 sales closed — no payable checkout', () => {
  it('keeps SALES_STATUS CLOSED / PROXIMAMENTE as zero payable identities', () => {
    expect(
      currentlyPayableCheckoutEligible({
        salesStatus: 'CLOSED',
        sellableIdentity: true,
        historical: false,
        effectiveSoldOut: false,
      }),
    ).toBe(false)
  })

  it('fails closed for CONFIGURADO at the sales gate', () => {
    expect(() => assertSalesOpen(configuredEvent)).toThrow(CheckoutError)
    try {
      assertSalesOpen(configuredEvent)
    } catch (error) {
      expect((error as CheckoutError).code).toBe('SALES_NOT_OPEN')
    }
  })

  it('orchestrate must not create a payable preference while CONFIGURADO', async () => {
    const catalog: CatalogPort = {
      async getProductWithEvent() {
        return { product: productRow({ code: 'IND-H' }), event: configuredEvent }
      },
    }
    const repo = memoryRepo()
    const startSpy = vi.spyOn(repo, 'startCheckoutTx')
    const result = await orchestrateCheckoutStart(checkoutBody(), {
      env: envMap(requiredEnv),
      catalog,
      repo,
      mp: createMockMercadoPagoClient(async () => {
        throw new Error('Mercado Pago must not be called while sales are closed')
      }),
    })
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ error: { code: 'SALES_NOT_OPEN' } })
    expect(startSpy).not.toHaveBeenCalled()
  })
})
