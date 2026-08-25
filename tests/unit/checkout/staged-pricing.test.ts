import { describe, expect, it } from 'vitest'
import {
  assertClientExpectedPrice,
  buildOrderCommercialSnapshot,
  dateFromMeridaWall,
  getProductStagePriceRow,
  maxStage,
  PRICING_RULES_VERSION,
  PRODUCT_STAGE_PRICES,
  resolveCalendarStage,
  resolveCommercialOffer,
  resolveEffectiveStage,
  SALES_CLOSED_AT_MS,
  isSoldOut,
} from '../../../insforge/functions/_shared/checkout/staged-pricing'

describe('staged pricing — time boundaries (America/Merida half-open)', () => {
  const launchStart = dateFromMeridaWall(2026, 8, 11, 0, 0, 0)
  const presaleStart = dateFromMeridaWall(2026, 9, 11, 0, 0, 0)
  const regularStart = dateFromMeridaWall(2026, 10, 1, 0, 0, 0)
  const salesClosed = dateFromMeridaWall(2026, 11, 8, 0, 0, 0)
  /** Test probe only: authority is the half-open boundary, not 23:59:59. */
  const immediatelyBefore = (boundary: Date) => new Date(boundary.getTime() - 1)
  const immediatelyAfter = (boundary: Date) => new Date(boundary.getTime() + 1)

  it('is not LAUNCH before launch start', () => {
    expect(resolveCalendarStage(immediatelyBefore(launchStart))).toBeNull()
    expect(resolveEffectiveStage(immediatelyBefore(launchStart), 40, 0)).toBe('SALES_NOT_OPEN')
  })

  it('opens exactly at launch start', () => {
    expect(resolveCalendarStage(launchStart)).toBe('LAUNCH')
  })

  it('LAUNCH until PRESALE boundary; PRESALE at exact boundary (2026-09-11 Merida)', () => {
    expect(resolveCalendarStage(immediatelyBefore(presaleStart))).toBe('LAUNCH')
    expect(resolveCalendarStage(presaleStart)).toBe('PRESALE')
    expect(resolveEffectiveStage(dateFromMeridaWall(2026, 9, 10, 23, 0, 0), 0, 0)).toBe('LAUNCH')
    expect(resolveEffectiveStage(dateFromMeridaWall(2026, 9, 11, 0, 30, 0), 0, 0)).toBe('PRESALE')
  })

  it('today (within LAUNCH window) resolves LAUNCH', () => {
    // 2026-08-25 America/Merida — still before 2026-09-11 boundary.
    expect(resolveEffectiveStage(dateFromMeridaWall(2026, 8, 25, 12, 0, 0), 0, 0)).toBe('LAUNCH')
  })

  it('PRESALE until REGULAR boundary; REGULAR at exact boundary', () => {
    expect(resolveCalendarStage(immediatelyBefore(regularStart))).toBe('PRESALE')
    expect(resolveCalendarStage(regularStart)).toBe('REGULAR')
  })

  it('REGULAR until close; SALES_CLOSED at and after 2026-11-08 00:00 Merida', () => {
    expect(resolveCalendarStage(immediatelyBefore(salesClosed))).toBe('REGULAR')
    expect(resolveCalendarStage(salesClosed)).toBeNull()
    expect(resolveEffectiveStage(salesClosed, 40, 0)).toBe('SALES_CLOSED')
    expect(resolveCalendarStage(immediatelyAfter(salesClosed))).toBeNull()
    expect(resolveEffectiveStage(immediatelyAfter(salesClosed), 40, 0)).toBe('SALES_CLOSED')
    expect(SALES_CLOSED_AT_MS).toBe(salesClosed.getTime())
  })

  it('ignores client clock by using provided server now', () => {
    const server = dateFromMeridaWall(2026, 8, 15)
    const offer = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 60,
      consumedUnits: 0,
      now: server,
    })
    expect('error' in offer).toBe(false)
    if (!('error' in offer)) {
      expect(offer.commercial_stage).toBe('LAUNCH')
      expect(offer.unit_price_cents).toBe(150000)
    }
  })
})

describe('staged pricing — calendar-only authority (no quota)', () => {
  it('does not advance stage from consumed quantity during LAUNCH', () => {
    const duringLaunch = dateFromMeridaWall(2026, 8, 15)
    expect(resolveEffectiveStage(duringLaunch, 40, 0)).toBe('LAUNCH')
    expect(resolveEffectiveStage(duringLaunch, 40, 12)).toBe('LAUNCH')
    expect(resolveEffectiveStage(duringLaunch, 40, 30)).toBe('LAUNCH')
    expect(resolveEffectiveStage(duringLaunch, 40, 40, 'REGULAR')).toBe('LAUNCH')
  })

  it('follows calendar when ahead of any historical threshold notion', () => {
    expect(maxStage('REGULAR', 'LAUNCH')).toBe('REGULAR')
    const duringRegular = dateFromMeridaWall(2026, 10, 15)
    expect(resolveEffectiveStage(duringRegular, 40, 0)).toBe('REGULAR')
  })

  it('never auto-SOLD_OUT from cupo / consumed', () => {
    expect(isSoldOut(60, 60)).toBe(false)
    const offer = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 60,
      consumedUnits: 60,
      now: dateFromMeridaWall(2026, 8, 15),
    })
    expect('error' in offer).toBe(false)
    if (!('error' in offer)) {
      expect(offer.sale_state).toBe('AVAILABLE')
      expect(offer.commercial_stage).toBe('LAUNCH')
    }
  })

  it('SKUs are independent (matrix keyed by code)', () => {
    expect(Object.keys(PRODUCT_STAGE_PRICES)).toHaveLength(28)
    expect(getProductStagePriceRow('IND-H')?.launch_cents).toBe(150000)
    expect(getProductStagePriceRow('DOB-VIE-MM')?.launch_cents).toBe(250000)
  })
})

describe('staged pricing — prices and MSI', () => {
  it('flat Workout / público / fotógrafo', () => {
    for (const code of ['WOD-M', 'PUB-VIE', 'FOT-SAB'] as const) {
      const row = getProductStagePriceRow(code)!
      expect(row.launch_cents).toBe(row.presale_cents)
      expect(row.presale_cents).toBe(row.regular_cents)
      expect(row.msi_eligible).toBe(false)
    }
  })

  it('competitive families carry MSI eligibility', () => {
    expect(getProductStagePriceRow('IND-H')?.msi_eligible).toBe(true)
    expect(getProductStagePriceRow('REL-4H')?.msi_eligible).toBe(true)
    expect(getProductStagePriceRow('HALF-DOB-MH')?.msi_eligible).toBe(true)
  })

  it('PUB-3D / FOT-3D are checkout-eligible (not MULTIDAY_FAIL_CLOSED)', () => {
    for (const code of ['PUB-3D', 'FOT-3D'] as const) {
      expect(getProductStagePriceRow(code)?.multiday_fail_closed).toBe(false)
      const offer = resolveCommercialOffer({
        productCode: code,
        totalCupo: 300,
        consumedUnits: 0,
        now: dateFromMeridaWall(2026, 8, 15),
      })
      expect('error' in offer && offer.error === 'MULTIDAY_FAIL_CLOSED').toBe(false)
      expect('error' in offer).toBe(false)
    }
  })

  it('rejects client expected price mismatch', () => {
    expect(() => assertClientExpectedPrice(140000, 150000)).toThrow(/PRICE_CHANGED/)
    expect(() => assertClientExpectedPrice(150000, 150000)).not.toThrow()
    expect(() => assertClientExpectedPrice(undefined, 150000)).not.toThrow()
  })

  it('builds immutable order snapshot', () => {
    const offer = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 60,
      consumedUnits: 0,
      now: dateFromMeridaWall(2026, 8, 15),
    })
    expect('error' in offer).toBe(false)
    if ('error' in offer) return
    const snap = buildOrderCommercialSnapshot({
      resolution: offer,
      quantity: 1,
      holdExpiresAt: '2026-08-15T12:15:00.000Z',
    })
    expect(snap).toMatchObject({
      product_code: 'IND-H',
      commercial_stage: 'LAUNCH',
      unit_price_cents: 150000,
      total_price_cents: 150000,
      currency: 'MXN',
      msi_eligible: true,
      pricing_rules_version: PRICING_RULES_VERSION,
      hold_expires_at: '2026-08-15T12:15:00.000Z',
    })
  })

  it('stage change between browse and resolve yields new price', () => {
    const launch = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 60,
      consumedUnits: 0,
      now: dateFromMeridaWall(2026, 8, 15),
    })
    const presale = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 60,
      consumedUnits: 0,
      now: dateFromMeridaWall(2026, 9, 11),
    })
    expect(!('error' in launch) && launch.unit_price_cents).toBe(150000)
    expect(!('error' in presale) && presale.unit_price_cents).toBe(165000)
  })
})
