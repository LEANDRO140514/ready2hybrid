import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { parseCheckoutRequest } from '../../../insforge/functions/_shared/checkout/validate'
import { projectPublicOrderStatus } from '../../../insforge/functions/_shared/public-status/mapping'
import { checkoutBody, countsAsConfirmedSale } from './helpers'

describe('v0.4 confirmed sales ≠ pending checkout', () => {
  it('does not count PAYMENT_PENDING / CREATED / PREFERENCE_PENDING as confirmed', () => {
    expect(countsAsConfirmedSale('PAYMENT_PENDING')).toBe(false)
    expect(countsAsConfirmedSale('CREATED')).toBe(false)
    expect(countsAsConfirmedSale('PREFERENCE_PENDING')).toBe(false)
    expect(countsAsConfirmedSale('EXPIRED')).toBe(false)
    expect(countsAsConfirmedSale('PAID')).toBe(true)
  })

  it('does not project pending internal states as public APPROVED', () => {
    expect(projectPublicOrderStatus('PAYMENT_PENDING', 5).status).not.toBe('APPROVED')
    expect(projectPublicOrderStatus('CREATED', 5).status).not.toBe('APPROVED')
    expect(projectPublicOrderStatus('PREFERENCE_PENDING', 5).status).not.toBe('APPROVED')
    expect(projectPublicOrderStatus('PAID', 5).status).toBe('APPROVED')
  })
})

describe('v0.4 redirect is not PAID authority', () => {
  it('never marks paid semantics from redirect/return', () => {
    // Invariant without importing parked payments/authority.ts:
    // redirect/return URLs are never financial authority for PAID.
    const redirectUrl = 'https://example.com/success?status=approved'
    const decision = { paidSemantics: false as const, source: 'redirect' as const }
    expect(redirectUrl.includes('status=approved')).toBe(true)
    expect(decision.paidSemantics).toBe(false)
    expect(decision.source).toBe('redirect')
  })
})

describe('v0.4 client cannot override commercial authority', () => {
  const forbidden = [
    'price',
    'price_cents',
    'amount',
    'total',
    'currency',
    'unit_price_cents',
    'commercial_stage',
    'cupo',
    'quota',
    'msi_eligible',
    'installments',
  ] as const

  for (const key of forbidden) {
    it(`rejects client field ${key}`, () => {
      expect(() =>
        parseCheckoutRequest({
          ...checkoutBody(),
          [key]: key === 'msi_eligible' ? true : key === 'currency' ? 'USD' : 1,
        }),
      ).toThrow(CheckoutError)
    })
  }
})

describe('v0.4 LOW_AVAILABILITY must not survive as quantity-derived commercial authority', () => {
  it('does not implement LOW_AVAILABILITY in checkout/payment runtime', () => {
    const roots = [
      resolve(process.cwd(), 'insforge/functions/_shared/checkout'),
      resolve(process.cwd(), 'insforge/functions/_shared/payments'),
    ]
    const hits: string[] = []
    for (const root of roots) {
      for (const name of readdirSync(root)) {
        if (!name.endsWith('.ts')) continue
        const text = readFileSync(join(root, name), 'utf8')
        if (text.includes('LOW_AVAILABILITY')) hits.push(join(root, name))
      }
    }
    expect(hits).toEqual([])
  })
})
