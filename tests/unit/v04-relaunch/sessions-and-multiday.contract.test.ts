import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import {
  accessEntitlementsForProduct,
  assertCheckoutProductAvailable,
  isMultidayCheckoutBlocked,
} from '../../../insforge/functions/_shared/checkout/eligibility'
import { ALLOWED_PRODUCT_SESSIONS } from '../../../insforge/functions/_shared/checkout/sales'
import {
  getProductStagePriceRow,
  resolveCommercialOffer,
} from '../../../insforge/functions/_shared/checkout/staged-pricing'
import {
  ALL_DAY_CODES,
  MULTIDAY_CODES,
  MULTIDAY_COVERED_DATES,
  NULL_SESSION_CODES,
  PERSISTED_SESSION,
} from './catalog'
import { launchNow, productRow } from './helpers'

describe('v0.4 sessions — ALL_DAY persistence and ASISTE NULL', () => {
  it('v0.4 session vocabulary persists Saturday FULL_DAY as ALL_DAY', () => {
    expect(ALLOWED_PRODUCT_SESSIONS).toContain('ALL_DAY')
    expect(ALLOWED_PRODUCT_SESSIONS).toContain('AM')
    expect(ALLOWED_PRODUCT_SESSIONS).toContain('PM')
    expect(PERSISTED_SESSION.FULL_DAY).toBe('ALL_DAY')
    expect(PERSISTED_SESSION.FULL_DAY).not.toBe('AM')
    expect(PERSISTED_SESSION.FULL_DAY).not.toBe('PM')
    expect(ALL_DAY_CODES.length).toBeGreaterThan(0)
  })

  it('binds daily PUB/FOT and 3-day passes to session NULL', () => {
    expect(NULL_SESSION_CODES.length).toBe(8)
    expect(PERSISTED_SESSION.NOT_APPLICABLE).toBeNull()
  })
})

describe('v0.4 multiday entitlement expectations — PUB-3D / FOT-3D', () => {
  it('treats PUB-3D and FOT-3D as sellable identities, not fail-closed catalog holes', () => {
    for (const code of MULTIDAY_CODES) {
      const row = getProductStagePriceRow(code)
      expect(row).not.toBeNull()
      expect(row?.multiday_fail_closed).toBe(false)
      expect(row?.checkout_enabled).toBe(true)
    }
  })

  it('must not block checkout solely because day is null on a 3-day pass', () => {
    const pub3d = productRow({
      code: 'PUB-3D',
      kind: 'spectator',
      day: null,
      cupo: 300,
    })
    expect(isMultidayCheckoutBlocked(pub3d)).toBe(false)
    expect(() => assertCheckoutProductAvailable(pub3d)).not.toThrow(CheckoutError)
  })

  it('must not fail-close commercial offer for PUB-3D / FOT-3D', () => {
    for (const code of MULTIDAY_CODES) {
      const offer = resolveCommercialOffer({
        productCode: code,
        totalCupo: 100,
        consumedUnits: 0,
        now: launchNow(),
      })
      expect('error' in offer && offer.error === 'MULTIDAY_FAIL_CLOSED').toBe(false)
      expect('error' in offer && offer.error === 'PRODUCT_DISABLED').toBe(false)
    }
  })

  it('issues three date-scoped entitlements for one PUB-3D / FOT-3D ticket', () => {
    for (const code of MULTIDAY_CODES) {
      const rows = accessEntitlementsForProduct({ code, day: null, session: 'AM' })
      expect(rows).toEqual([
        { entitlement_date: '2026-11-13', session: null },
        { entitlement_date: '2026-11-14', session: null },
        { entitlement_date: '2026-11-15', session: null },
      ])
    }
    expect([...MULTIDAY_COVERED_DATES]).toEqual(['2026-11-13', '2026-11-14', '2026-11-15'])
    const remainingAfterFridayUse = MULTIDAY_COVERED_DATES.filter((d) => d !== '2026-11-13')
    expect(remainingAfterFridayUse).toEqual(['2026-11-14', '2026-11-15'])
  })
})
