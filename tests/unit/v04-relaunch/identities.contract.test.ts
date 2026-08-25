import { describe, expect, it } from 'vitest'
import { journeyForProductCode } from '../../../insforge/functions/_shared/checkout/journeys'
import { parseCheckoutRequest } from '../../../insforge/functions/_shared/checkout/validate'
import { PRODUCT_STAGE_PRICES } from '../../../insforge/functions/_shared/checkout/staged-pricing'
import {
  HISTORICAL_CODES,
  JOURNEY_BY_SELLABLE,
  RETIRED_PRODUCT_CODES,
  SELLABLE_IDENTITY_CODES,
  SUPERSEDED_SCHEDULE_CODES,
} from './catalog'
import { checkoutBody } from './helpers'

describe('v0.4 identities — 23 sellable / 2 retired / 3 superseded', () => {
  it('locks sellable cardinality at 23 distinct codes', () => {
    expect(new Set(SELLABLE_IDENTITY_CODES).size).toBe(23)
    expect(SELLABLE_IDENTITY_CODES).toHaveLength(23)
  })

  it('locks retired cardinality at 2 and superseded at 3', () => {
    expect(RETIRED_PRODUCT_CODES).toHaveLength(2)
    expect(SUPERSEDED_SCHEDULE_CODES).toHaveLength(3)
    expect(new Set(HISTORICAL_CODES).size).toBe(5)
  })

  it('does not overlap sellable identities with historical codes', () => {
    const sellable = new Set<string>(SELLABLE_IDENTITY_CODES)
    for (const code of HISTORICAL_CODES) {
      expect(sellable.has(code)).toBe(false)
    }
  })

  it('maps each sellable identity to its approved purchase journey', () => {
    for (const code of SELLABLE_IDENTITY_CODES) {
      expect(journeyForProductCode(code)).toBe(JOURNEY_BY_SELLABLE[code])
    }
  })

  it('does not assign an active purchase journey to historical codes', () => {
    for (const code of HISTORICAL_CODES) {
      expect(journeyForProductCode(code)).toBeNull()
    }
  })

  it('rejects historical codes before payable checkout parse', () => {
    for (const code of HISTORICAL_CODES) {
      expect(() => parseCheckoutRequest(checkoutBody({ product_code: code }))).toThrow()
    }
  })

  it('does not treat historical codes as checkout-enabled commercial rows', () => {
    for (const code of HISTORICAL_CODES) {
      const row = PRODUCT_STAGE_PRICES[code]
      expect(row === undefined || row.checkout_enabled === false).toBe(true)
    }
  })
})
