import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { parseCheckoutRequest } from '../../../insforge/functions/_shared/checkout/validate'

function base() {
  return {
    product_code: 'IND-H',
    idempotency_key: 'idem-key-12345678',
  }
}

describe('checkout client cannot supply payment / MSI authority', () => {
  const forbidden = [
    'installments',
    'default_installments',
    'payment_methods',
    'excluded_payment_types',
    'excluded_payment_methods',
    'msi_eligible',
    'msi',
    'total',
    'unit_price',
    'price',
    'commercial_stage',
    'cupo',
  ] as const

  for (const key of forbidden) {
    it(`rejects client field ${key}`, () => {
      expect(() =>
        parseCheckoutRequest({
          ...base(),
          [key]: key === 'msi_eligible' ? true : key === 'payment_methods' ? { installments: 12 } : 1,
        } as never),
      ).toThrow(CheckoutError)
    })
  }
})
