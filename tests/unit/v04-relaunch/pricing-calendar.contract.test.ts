import { describe, expect, it } from 'vitest'
import {
  PRODUCT_STAGE_PRICES,
  getProductStagePriceRow,
  resolveCalendarStage,
  resolveCommercialOffer,
  resolveEffectiveStage,
} from '../../../insforge/functions/_shared/checkout/staged-pricing'
import { CALENDAR_PRICES, SELLABLE_IDENTITY_CODES } from './catalog'
import { launchNow, presaleNow, regularNow } from './helpers'

describe('v0.4 pricing — calendar only', () => {
  it('exposes the 23 sellable identities in the commercial price table', () => {
    for (const code of SELLABLE_IDENTITY_CODES) {
      expect(getProductStagePriceRow(code)).not.toBeNull()
    }
  })

  it('matches approved launch / presale / regular cents and MSI flags', () => {
    for (const code of SELLABLE_IDENTITY_CODES) {
      const row = PRODUCT_STAGE_PRICES[code]
      const expected = CALENDAR_PRICES[code]
      expect(row.launch_cents).toBe(expected.launch)
      expect(row.presale_cents).toBe(expected.presale)
      expect(row.regular_cents).toBe(expected.regular)
      expect(row.msi_eligible).toBe(expected.msi)
    }
  })

  it('resolves calendar stage without quantity, cupo, or high-water inputs', () => {
    expect(resolveCalendarStage(launchNow())).toBe('LAUNCH')
    expect(resolveCalendarStage(presaleNow())).toBe('PRESALE')
    expect(resolveCalendarStage(regularNow())).toBe('REGULAR')
  })

  it('does not advance stage from consumed quantity while calendar is LAUNCH', () => {
    expect(resolveEffectiveStage(launchNow(), 40, 39, 'LAUNCH')).toBe('LAUNCH')
  })

  it('does not advance stage from persisted high-water while calendar is LAUNCH', () => {
    expect(resolveEffectiveStage(launchNow(), 40, 0, 'REGULAR')).toBe('LAUNCH')
  })

  it('prices IND-H from calendar LAUNCH even when consumed units are high', () => {
    const offer = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 40,
      consumedUnits: 39,
      persistedStage: 'REGULAR',
      now: launchNow(),
    })
    expect('error' in offer).toBe(false)
    if ('error' in offer) return
    expect(offer.commercial_stage).toBe('LAUNCH')
    expect(offer.unit_price_cents).toBe(150000)
  })
})
