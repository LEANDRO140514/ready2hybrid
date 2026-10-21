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

  it('keeps a US number in E.164', () => {
    expect(normalizeMexicanPhone('+1 305 555 0123')).toBe('+13055550123')
  })

  it('keeps a Spanish number in E.164', () => {
    expect(normalizeMexicanPhone('+34 612 345 678')).toBe('+34612345678')
  })

  it('rejects a short number in Spanish', () => {
    expect(() => normalizeMexicanPhone('12345')).toThrow(CheckoutError)
    try {
      normalizeMexicanPhone('12345')
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutError)
      expect((error as CheckoutError).code).toBe('INVALID_REQUEST')
      expect((error as CheckoutError).message).toBe(
        'El teléfono no es válido. Usa 10 dígitos de México o un número internacional con + y de 8 a 15 dígitos.',
      )
      expect((error as CheckoutError).toPublicBody().error.message).toBe(
        'El teléfono no es válido. Usa 10 dígitos de México o un número internacional con + y de 8 a 15 dígitos.',
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
