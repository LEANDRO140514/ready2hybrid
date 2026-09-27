import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import {
  assertCanonicalMsiEligible,
  assertCheckoutPaymentPolicy,
  toCheckoutPaymentPolicy,
} from '../../../insforge/functions/_shared/checkout/payment-policy'
import {
  dateFromMeridaWall,
  getProductStagePriceRow,
  PRODUCT_STAGE_PRICES,
  resolveCommercialOffer,
} from '../../../insforge/functions/_shared/checkout/staged-pricing'

const launchNow = () => dateFromMeridaWall(2026, 8, 15, 12, 0, 0)

const ELIGIBLE = [
  'DOB-VIE-MM',
  'HALF-IND-M',
  'HALF-DOB-MM',
  'REL-4H',
  'IND-H',
] as const

const EXCLUDED = ['PUB-VIE'] as const
const NOT_FOR_SALE = ['WOD-M', 'FOT-SAB', 'FOT-3D'] as const

describe('toCheckoutPaymentPolicy (domain)', () => {
  it('true → maximumInstallments 3 + ticket exclusion required', () => {
    expect(toCheckoutPaymentPolicy(true)).toEqual({
      maximumInstallments: 3,
      excludeTicketPayments: true,
    })
  })

  it('false → maximumInstallments 1 + ticket exclusion required', () => {
    expect(toCheckoutPaymentPolicy(false)).toEqual({
      maximumInstallments: 1,
      excludeTicketPayments: true,
    })
  })

  it('assertCanonicalMsiEligible rejects null/string/number/undefined', () => {
    for (const bad of [null, undefined, 'true', 1, 0, {}]) {
      expect(() => assertCanonicalMsiEligible(bad)).toThrow(CheckoutError)
    }
    expect(() => assertCanonicalMsiEligible(true)).not.toThrow()
    expect(() => assertCanonicalMsiEligible(false)).not.toThrow()
  })

  it('assertCheckoutPaymentPolicy rejects invalid shapes', () => {
    expect(() =>
      assertCheckoutPaymentPolicy({
        maximumInstallments: 6 as 1,
        excludeTicketPayments: true,
      }),
    ).toThrow(CheckoutError)
    expect(() =>
      assertCheckoutPaymentPolicy({
        maximumInstallments: 3,
        excludeTicketPayments: false as true,
      }),
    ).toThrow(CheckoutError)
  })
})

describe('commercial matrix → payment policy (families)', () => {
  it('eligible families resolve msi_eligible true → policy 3', () => {
    for (const code of ELIGIBLE) {
      expect(PRODUCT_STAGE_PRICES[code].msi_eligible).toBe(true)
      const offer = resolveCommercialOffer({
        productCode: code,
        totalCupo: 60,
        consumedUnits: 0,
        now: launchNow(),
      })
      expect('error' in offer).toBe(false)
      if ('error' in offer) continue
      assertCanonicalMsiEligible(offer.msi_eligible)
      expect(toCheckoutPaymentPolicy(offer.msi_eligible).maximumInstallments).toBe(3)
    }
  })

  it('público → policy 1; workout and fotógrafo are not offered', () => {
    for (const code of EXCLUDED) {
      expect(getProductStagePriceRow(code)?.msi_eligible).toBe(false)
      const offer = resolveCommercialOffer({
        productCode: code,
        totalCupo: 100,
        consumedUnits: 0,
        now: launchNow(),
      })
      expect('error' in offer).toBe(false)
      if ('error' in offer) continue
      expect(toCheckoutPaymentPolicy(offer.msi_eligible).maximumInstallments).toBe(1)
    }
    for (const code of NOT_FOR_SALE) {
      expect(getProductStagePriceRow(code)?.msi_eligible).toBe(false)
      expect(getProductStagePriceRow(code)?.checkout_enabled).toBe(false)
      expect(
        resolveCommercialOffer({
          productCode: code,
          totalCupo: 100,
          consumedUnits: 0,
          now: launchNow(),
        }),
      ).toEqual({ error: 'PRODUCT_DISABLED' })
    }
  })

  it('PUB-3D stays allowed; FOT-3D is not for sale and is not MULTIDAY_FAIL_CLOSED', () => {
    const pub = resolveCommercialOffer({
      productCode: 'PUB-3D',
      totalCupo: 10,
      consumedUnits: 0,
      now: launchNow(),
    })
    expect('error' in pub).toBe(false)
    if (!('error' in pub)) {
      expect(pub.msi_eligible).toBe(false)
      expect(toCheckoutPaymentPolicy(pub.msi_eligible).maximumInstallments).toBe(1)
    }
    expect(getProductStagePriceRow('FOT-3D')?.multiday_fail_closed).toBe(false)
    expect(
      resolveCommercialOffer({
        productCode: 'FOT-3D',
        totalCupo: 10,
        consumedUnits: 0,
        now: launchNow(),
      }),
    ).toEqual({ error: 'PRODUCT_DISABLED' })
  })
})
