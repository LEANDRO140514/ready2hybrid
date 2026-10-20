import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import {
  normalizeMexicanPhone,
  parseCheckoutRequest,
} from '../../../insforge/functions/_shared/checkout/validate'

describe('normalizeMexicanPhone', () => {
  it('adds +52 to ten local digits', () => {
    expect(normalizeMexicanPhone('9811204320')).toBe('+529811204320')
  })

  it('keeps +52 and strips spaces', () => {
    expect(normalizeMexicanPhone('+52 981 120 4320')).toBe('+529811204320')
  })

  it('adds + to a 12-digit 52 prefix', () => {
    expect(normalizeMexicanPhone('52 9811204320')).toBe('+529811204320')
  })

  it('rejects a short number in Spanish', () => {
    expect(() => normalizeMexicanPhone('12345')).toThrow(CheckoutError)
    try {
      normalizeMexicanPhone('12345')
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutError)
      expect((error as CheckoutError).code).toBe('INVALID_REQUEST')
      expect((error as CheckoutError).message).toBe(
        'El teléfono no es válido. Usa 10 dígitos de México, con o sin +52.',
      )
      expect((error as CheckoutError).toPublicBody().error.message).toBe(
        'El teléfono no es válido. Usa 10 dígitos de México, con o sin +52.',
      )
    }
  })

  it('leaves missing or blank as null', () => {
    expect(normalizeMexicanPhone(undefined)).toBeNull()
    expect(normalizeMexicanPhone('   ')).toBeNull()
  })
})

describe('parseCheckoutRequest stores the normalized phone', () => {
  const body = (phone: string) => ({
    product_code: 'IND-H',
    idempotency_key: 'idem-key-12345678',
    buyer: { email: 'buyer@example.com', name: 'Buyer Example', phone },
  })

  it('persists +52XXXXXXXXXX', () => {
    expect(parseCheckoutRequest(body('9811204320')).buyer.phone).toBe('+529811204320')
  })

  it('rejects an invalid phone before checkout starts', () => {
    expect(() => parseCheckoutRequest(body('12345'))).toThrow(CheckoutError)
  })
})
