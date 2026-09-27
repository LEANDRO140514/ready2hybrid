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
  const presaleStart = dateFromMeridaWall(2026, 9, 25, 0, 0, 0)
  const regularStart = dateFromMeridaWall(2026, 10, 17, 0, 0, 0)
  const salesClosed = dateFromMeridaWall(2026, 11, 13, 0, 0, 0)
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

  it('LAUNCH until PRESALE boundary; PRESALE at exact boundary (2026-09-25 Merida)', () => {
    expect(resolveCalendarStage(immediatelyBefore(presaleStart))).toBe('LAUNCH')
    expect(resolveCalendarStage(presaleStart)).toBe('PRESALE')
    expect(resolveEffectiveStage(dateFromMeridaWall(2026, 9, 24, 23, 59, 0), 0, 0)).toBe('LAUNCH')
    expect(resolveEffectiveStage(dateFromMeridaWall(2026, 9, 25, 0, 1, 0), 0, 0)).toBe('PRESALE')
  })

  it('within LAUNCH window resolves LAUNCH', () => {
    expect(resolveEffectiveStage(dateFromMeridaWall(2026, 8, 25, 12, 0, 0), 0, 0)).toBe('LAUNCH')
  })

  it('PRESALE until REGULAR boundary; REGULAR at exact boundary', () => {
    expect(resolveCalendarStage(immediatelyBefore(regularStart))).toBe('PRESALE')
    expect(resolveCalendarStage(regularStart)).toBe('REGULAR')
  })

  it('REGULAR until close; SALES_CLOSED at and after 2026-11-13 00:00 Merida', () => {
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
    const duringRegular = dateFromMeridaWall(2026, 10, 20)
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

  it('PUB-3D stays checkout-eligible; FOT-3D is not for sale this edition', () => {
    expect(getProductStagePriceRow('PUB-3D')?.multiday_fail_closed).toBe(false)
    expect(getProductStagePriceRow('FOT-3D')?.multiday_fail_closed).toBe(false)
    const pub = resolveCommercialOffer({
      productCode: 'PUB-3D',
      totalCupo: 300,
      consumedUnits: 0,
      now: dateFromMeridaWall(2026, 8, 15),
    })
    const fot = resolveCommercialOffer({
      productCode: 'FOT-3D',
      totalCupo: 300,
      consumedUnits: 0,
      now: dateFromMeridaWall(2026, 8, 15),
    })
    expect('error' in pub).toBe(false)
    expect(fot).toEqual({ error: 'PRODUCT_DISABLED' })
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
      now: dateFromMeridaWall(2026, 9, 25),
    })
    expect(!('error' in launch) && launch.unit_price_cents).toBe(150000)
    expect(!('error' in presale) && presale.unit_price_cents).toBe(165000)
  })
})

describe('staged pricing — ENFORMA calendar 2026-09-23 (America/Merida)', () => {
  const PRODUCTS = ['IND-H', 'DOB-SAB-MH', 'REL-2H2M', 'HALF-IND-M', 'HALF-DOB-MH', 'PUB-VIE', 'PUB-3D'] as const
  const PRICES: Record<'LAUNCH' | 'PRESALE' | 'REGULAR', Record<(typeof PRODUCTS)[number], number>> = {
    LAUNCH: { 'IND-H': 150000, 'DOB-SAB-MH': 250000, 'REL-2H2M': 320000, 'HALF-IND-M': 80000, 'HALF-DOB-MH': 160000, 'PUB-VIE': 25000, 'PUB-3D': 60000 },
    PRESALE: { 'IND-H': 165000, 'DOB-SAB-MH': 275000, 'REL-2H2M': 350000, 'HALF-IND-M': 90000, 'HALF-DOB-MH': 180000, 'PUB-VIE': 25000, 'PUB-3D': 60000 },
    REGULAR: { 'IND-H': 180000, 'DOB-SAB-MH': 300000, 'REL-2H2M': 380000, 'HALF-IND-M': 100000, 'HALF-DOB-MH': 200000, 'PUB-VIE': 25000, 'PUB-3D': 60000 },
  }
  const CASES: [string, Date, 'LAUNCH' | 'PRESALE' | 'REGULAR' | 'SALES_CLOSED'][] = [
    ['24 sep 23:59', dateFromMeridaWall(2026, 9, 24, 23, 59, 0), 'LAUNCH'],
    ['25 sep 00:01', dateFromMeridaWall(2026, 9, 25, 0, 1, 0), 'PRESALE'],
    ['30 sep 12:00', dateFromMeridaWall(2026, 9, 30, 12, 0, 0), 'PRESALE'],
    ['1 oct 12:00', dateFromMeridaWall(2026, 10, 1, 12, 0, 0), 'PRESALE'],
    ['16 oct 23:59', dateFromMeridaWall(2026, 10, 16, 23, 59, 0), 'PRESALE'],
    ['17 oct 00:01', dateFromMeridaWall(2026, 10, 17, 0, 1, 0), 'REGULAR'],
    ['7 nov 12:00', dateFromMeridaWall(2026, 11, 7, 12, 0, 0), 'REGULAR'],
    ['10 nov 12:00', dateFromMeridaWall(2026, 11, 10, 12, 0, 0), 'REGULAR'],
    ['12 nov 23:59', dateFromMeridaWall(2026, 11, 12, 23, 59, 0), 'REGULAR'],
    ['13 nov 00:01', dateFromMeridaWall(2026, 11, 13, 0, 1, 0), 'SALES_CLOSED'],
  ]

  it.each(CASES)('%s Merida → %s', (_label, now, expected) => {
    for (const productCode of PRODUCTS) {
      const offer = resolveCommercialOffer({ productCode, totalCupo: 60, consumedUnits: 0, now })
      if (expected === 'SALES_CLOSED') {
        // Spectator passes stay on sale during the event — covered below.
        if (productCode.startsWith('PUB-')) continue
        expect(offer).toEqual({ error: 'SALES_CLOSED' })
        continue
      }
      expect('error' in offer).toBe(false)
      if (!('error' in offer)) {
        expect(offer.commercial_stage).toBe(expected)
        expect(offer.unit_price_cents).toBe(PRICES[expected][productCode])
      }
    }
  })

  it('stage does not flip the evening before in UTC (24 sep 18:30 Merida = 25 sep 00:30 UTC)', () => {
    expect(resolveCalendarStage(new Date('2026-09-25T00:30:00Z'))).toBe('LAUNCH')
    expect(resolveCalendarStage(new Date('2026-10-17T00:30:00Z'))).toBe('PRESALE')
    expect(resolveCalendarStage(new Date('2026-11-13T00:30:00Z'))).toBe('REGULAR')
  })

  it('affiliate launch lock still bills launch during PRESALE and REGULAR', () => {
    for (const now of [dateFromMeridaWall(2026, 10, 1, 12), dateFromMeridaWall(2026, 11, 10, 12)]) {
      const offer = resolveCommercialOffer({ productCode: 'IND-H', totalCupo: 60, consumedUnits: 0, now, priceLock: 'LAUNCH' })
      expect(!('error' in offer) && offer.unit_price_cents).toBe(150000)
      expect(!('error' in offer) && offer.price_basis).toBe('AFFILIATE_LAUNCH_LOCK')
    }
  })
})

describe('staged pricing — spectator sales during the event (ENFORMA 2026-09-26)', () => {
  const offer = (productCode: string, now: Date) =>
    resolveCommercialOffer({ productCode, totalCupo: 60, consumedUnits: 0, now })

  it('competition closes at 13 nov 00:00 while spectator passes stay on sale', () => {
    const now = dateFromMeridaWall(2026, 11, 13, 10, 0, 0)
    for (const code of ['IND-H', 'DOB-SAB-MH', 'REL-2H2M', 'HALF-IND-M', 'HALF-DOB-MH']) {
      expect(offer(code, now)).toEqual({ error: 'SALES_CLOSED' })
    }
    for (const [code, cents] of [['PUB-VIE', 25000], ['PUB-SAB', 25000], ['PUB-DOM', 25000], ['PUB-3D', 60000]] as const) {
      const o = offer(code, now)
      expect(!('error' in o) && o.unit_price_cents).toBe(cents)
    }
  })

  it.each([
    ['PUB-VIE', dateFromMeridaWall(2026, 11, 13, 23, 59, 0), dateFromMeridaWall(2026, 11, 14, 0, 1, 0)],
    ['PUB-3D', dateFromMeridaWall(2026, 11, 13, 23, 59, 0), dateFromMeridaWall(2026, 11, 14, 0, 1, 0)],
    ['PUB-SAB', dateFromMeridaWall(2026, 11, 14, 23, 59, 0), dateFromMeridaWall(2026, 11, 15, 0, 1, 0)],
    ['PUB-DOM', dateFromMeridaWall(2026, 11, 15, 23, 59, 0), dateFromMeridaWall(2026, 11, 16, 0, 1, 0)],
  ])('%s sells until the end of its first day', (code, lastMinute, after) => {
    expect('error' in offer(code, lastMinute)).toBe(false)
    expect(offer(code, after)).toEqual({ error: 'SALES_CLOSED' })
  })

  it('spectator price before close is unchanged', () => {
    const o = offer('PUB-3D', dateFromMeridaWall(2026, 11, 12, 12, 0, 0))
    expect(!('error' in o) && o.commercial_stage).toBe('REGULAR')
    expect(!('error' in o) && o.unit_price_cents).toBe(60000)
  })
})
