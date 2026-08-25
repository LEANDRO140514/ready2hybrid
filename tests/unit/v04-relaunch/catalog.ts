/**
 * UNIT A — v0.4.0 contract fixture (tests only).
 * Authority: SPEC-030 / SPEC-031 / SPEC-032 v0.4.0 APPROVED / EFFECTIVE.
 * Not production catalog authority. Not a migration. Not SALES_STATUS=OPEN.
 *
 * Baseline (2026-08-23, vitest tests/unit/v04-relaunch): 33 pass / 15 fail.
 * Expected red until later units change production behavior:
 * - historical codes still have journeys / checkout-enabled prices / parse
 * - effective stage still advances from cupo, HWM, and quota
 * - isSoldOut(cupo, consumed) and spectator qty>cupo still emit SOLD_OUT
 * - 0002 session CHECK does not allow ALL_DAY
 * - PUB-3D / FOT-3D still fail-closed for null day / MULTIDAY_FAIL_CLOSED
 * Expected green (already true on current code): 23-code fixture, calendar
 * windows/prices at zero consumption, SKU SOLD_OUT gate, CONFIGURADO sales
 * gate, redirect non-authority, client money keys rejected, confirmed≠pending
 * projection, no LOW_AVAILABILITY in checkout/payment runtime.
 */

export const SELLABLE_IDENTITY_CODES = [
  'DOB-VIE-MM',
  'DOB-SAB-HH',
  'DOB-SAB-MH',
  'REL-4H',
  'REL-4M',
  'REL-2H2M',
  'IND-H',
  'IND-M',
  'HALF-IND-M',
  'HALF-IND-H',
  'HALF-DOB-MM',
  'HALF-DOB-HH',
  'HALF-DOB-MH',
  'WOD-M',
  'WOD-H',
  'PUB-VIE',
  'PUB-SAB',
  'PUB-DOM',
  'PUB-3D',
  'FOT-VIE',
  'FOT-SAB',
  'FOT-DOM',
  'FOT-3D',
] as const

export const RETIRED_PRODUCT_CODES = ['IND-PRO-H', 'IND-PRO-M'] as const

export const SUPERSEDED_SCHEDULE_CODES = [
  'DOB-VIE-HH',
  'DOB-VIE-MH',
  'DOB-SAB-MM',
] as const

export const HISTORICAL_CODES = [
  ...RETIRED_PRODUCT_CODES,
  ...SUPERSEDED_SCHEDULE_CODES,
] as const

export const JOURNEY_BY_SELLABLE: Record<
  (typeof SELLABLE_IDENTITY_CODES)[number],
  'J1' | 'J2' | 'J3' | 'J4' | 'J5'
> = {
  'IND-H': 'J1',
  'IND-M': 'J1',
  'HALF-IND-M': 'J1',
  'HALF-IND-H': 'J1',
  'DOB-VIE-MM': 'J2',
  'DOB-SAB-HH': 'J2',
  'DOB-SAB-MH': 'J2',
  'HALF-DOB-MM': 'J2',
  'HALF-DOB-HH': 'J2',
  'HALF-DOB-MH': 'J2',
  'REL-4H': 'J3',
  'REL-4M': 'J3',
  'REL-2H2M': 'J3',
  'WOD-M': 'J4',
  'WOD-H': 'J4',
  'PUB-VIE': 'J5',
  'PUB-SAB': 'J5',
  'PUB-DOM': 'J5',
  'PUB-3D': 'J5',
  'FOT-VIE': 'J5',
  'FOT-SAB': 'J5',
  'FOT-DOM': 'J5',
  'FOT-3D': 'J5',
}

/** MXN integer cents for the full sale unit. */
export const CALENDAR_PRICES: Record<
  (typeof SELLABLE_IDENTITY_CODES)[number],
  { launch: number; presale: number; regular: number; msi: boolean }
> = {
  'DOB-VIE-MM': { launch: 250000, presale: 275000, regular: 300000, msi: true },
  'DOB-SAB-HH': { launch: 250000, presale: 275000, regular: 300000, msi: true },
  'DOB-SAB-MH': { launch: 250000, presale: 275000, regular: 300000, msi: true },
  'REL-4H': { launch: 320000, presale: 350000, regular: 380000, msi: true },
  'REL-4M': { launch: 320000, presale: 350000, regular: 380000, msi: true },
  'REL-2H2M': { launch: 320000, presale: 350000, regular: 380000, msi: true },
  'IND-H': { launch: 150000, presale: 165000, regular: 180000, msi: true },
  'IND-M': { launch: 150000, presale: 165000, regular: 180000, msi: true },
  'HALF-IND-M': { launch: 80000, presale: 90000, regular: 100000, msi: true },
  'HALF-IND-H': { launch: 80000, presale: 90000, regular: 100000, msi: true },
  'HALF-DOB-MM': { launch: 160000, presale: 180000, regular: 200000, msi: true },
  'HALF-DOB-HH': { launch: 160000, presale: 180000, regular: 200000, msi: true },
  'HALF-DOB-MH': { launch: 160000, presale: 180000, regular: 200000, msi: true },
  'WOD-M': { launch: 35000, presale: 35000, regular: 35000, msi: false },
  'WOD-H': { launch: 35000, presale: 35000, regular: 35000, msi: false },
  'PUB-VIE': { launch: 25000, presale: 25000, regular: 25000, msi: false },
  'PUB-SAB': { launch: 25000, presale: 25000, regular: 25000, msi: false },
  'PUB-DOM': { launch: 25000, presale: 25000, regular: 25000, msi: false },
  'PUB-3D': { launch: 60000, presale: 60000, regular: 60000, msi: false },
  'FOT-VIE': { launch: 35000, presale: 35000, regular: 35000, msi: false },
  'FOT-SAB': { launch: 35000, presale: 35000, regular: 35000, msi: false },
  'FOT-DOM': { launch: 35000, presale: 35000, regular: 35000, msi: false },
  'FOT-3D': { launch: 80000, presale: 80000, regular: 80000, msi: false },
}

export const ALL_DAY_CODES = [
  'DOB-SAB-HH',
  'DOB-SAB-MH',
  'HALF-IND-M',
  'HALF-IND-H',
  'HALF-DOB-MM',
  'HALF-DOB-HH',
  'HALF-DOB-MH',
  'WOD-M',
  'WOD-H',
] as const

export const PM_CODES = ['DOB-VIE-MM', 'IND-H', 'IND-M'] as const
export const AM_CODES = ['REL-4H', 'REL-4M', 'REL-2H2M'] as const
export const NULL_SESSION_CODES = [
  'PUB-VIE',
  'PUB-SAB',
  'PUB-DOM',
  'PUB-3D',
  'FOT-VIE',
  'FOT-SAB',
  'FOT-DOM',
  'FOT-3D',
] as const

export const MULTIDAY_CODES = ['PUB-3D', 'FOT-3D'] as const
export const MULTIDAY_COVERED_DATES = ['2026-11-13', '2026-11-14', '2026-11-15'] as const

export const PERSISTED_SESSION = {
  FULL_DAY: 'ALL_DAY',
  AM: 'AM',
  PM: 'PM',
  NOT_APPLICABLE: null,
} as const
