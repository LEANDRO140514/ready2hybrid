/**
 * SPEC-030/031/032 v0.2.0 — canonical staged commercial pricing.
 * America/Merida uses fixed UTC−6 (no DST). Stage windows are half-open
 * [start, end) to avoid ambiguous boundaries.
 *
 * Local foundation only. Does not authorize Main, deploy, or SALES_STATUS=OPEN.
 */

export const PRICING_RULES_VERSION = 'r2h-commercial-2026.1' as const

export type CommercialStage = 'LAUNCH' | 'PRESALE' | 'REGULAR'

export type CommercialSaleState =
  | 'AVAILABLE'
  | 'SOLD_OUT'
  | 'SALES_CLOSED'
  | 'PRODUCT_DISABLED'
  | 'MULTIDAY_FAIL_CLOSED'
  | 'SALES_NOT_OPEN'

export type StagePriceRow = {
  launch_cents: number
  presale_cents: number
  regular_cents: number
  msi_eligible: boolean
  checkout_enabled: boolean
  multiday_fail_closed: boolean
}

/** Merida offset: UTC−6 year-round. */
const MERIDA_OFFSET_MS = -6 * 60 * 60 * 1000

function meridaWallToUtcMs(y: number, m: number, d: number, hh = 0, mm = 0, ss = 0): number {
  return Date.UTC(y, m - 1, d, hh, mm, ss) - MERIDA_OFFSET_MS
}

/** Half-open [start, end) in UTC instants for America/Merida walls. SPEC-030-R201/R202 v0.3.0. */
export const STAGE_WINDOWS = {
  LAUNCH: {
    startMs: meridaWallToUtcMs(2026, 8, 11, 0, 0, 0),
    endMs: meridaWallToUtcMs(2026, 9, 11, 0, 0, 0),
  },
  PRESALE: {
    startMs: meridaWallToUtcMs(2026, 9, 11, 0, 0, 0),
    endMs: meridaWallToUtcMs(2026, 10, 1, 0, 0, 0),
  },
  REGULAR: {
    startMs: meridaWallToUtcMs(2026, 10, 1, 0, 0, 0),
    endMs: meridaWallToUtcMs(2026, 11, 8, 0, 0, 0),
  },
} as const

export const SALES_CLOSED_AT_MS = STAGE_WINDOWS.REGULAR.endMs

const STAGE_ORDER: CommercialStage[] = ['LAUNCH', 'PRESALE', 'REGULAR']

function stageIndex(stage: CommercialStage): number {
  return STAGE_ORDER.indexOf(stage)
}

export function maxStage(a: CommercialStage, b: CommercialStage): CommercialStage {
  return stageIndex(a) >= stageIndex(b) ? a : b
}

/**
 * Calendar stage from instant. Returns null before launch open or at/after close.
 */
export function resolveCalendarStage(now: Date): CommercialStage | null {
  const t = now.getTime()
  if (t < STAGE_WINDOWS.LAUNCH.startMs) return null
  if (t >= SALES_CLOSED_AT_MS) return null
  if (t < STAGE_WINDOWS.LAUNCH.endMs) return 'LAUNCH'
  if (t < STAGE_WINDOWS.PRESALE.endMs) return 'PRESALE'
  return 'REGULAR'
}

export function normalizePersistedStage(value: string | null | undefined): CommercialStage {
  if (value === 'PRESALE' || value === 'REGULAR' || value === 'LAUNCH') return value
  return 'LAUNCH'
}

/**
 * Calendar stage only. Quantity, cupo, quota shares, and persisted high-water
 * are ignored commercially (SPEC-030 v0.4.0). Signature kept for callers.
 */
export function resolveEffectiveStage(
  now: Date,
  _totalCupo: number,
  _consumedUnits: number,
  _persistedStage: CommercialStage = 'LAUNCH',
): CommercialStage | 'SALES_CLOSED' | 'SALES_NOT_OPEN' {
  const t = now.getTime()
  if (t >= SALES_CLOSED_AT_MS) return 'SALES_CLOSED'
  const calendar = resolveCalendarStage(now)
  if (calendar == null) return 'SALES_NOT_OPEN'
  return calendar
}

/** Cupo / consumed quantity is not organizer SOLD_OUT authority. */
export function isSoldOut(_totalCupo: number, _consumedUnits: number): boolean {
  return false
}

function row(
  launch: number,
  presale: number,
  regular: number,
  msi: boolean,
  checkoutEnabled = true,
  multidayFailClosed = false,
): StagePriceRow {
  return {
    launch_cents: launch,
    presale_cents: presale,
    regular_cents: regular,
    msi_eligible: msi,
    checkout_enabled: checkoutEnabled && !multidayFailClosed,
    multiday_fail_closed: multidayFailClosed,
  }
}

/** Canonical prices by product_code (MXN cents). */
export const PRODUCT_STAGE_PRICES: Readonly<Record<string, StagePriceRow>> = Object.freeze({
  'DOB-VIE-MM': row(250000, 275000, 300000, true),
  'DOB-VIE-HH': row(250000, 275000, 300000, true, false),
  'DOB-VIE-MH': row(250000, 275000, 300000, true, false),
  'DOB-SAB-MM': row(250000, 275000, 300000, true, false),
  'DOB-SAB-HH': row(250000, 275000, 300000, true),
  'DOB-SAB-MH': row(250000, 275000, 300000, true),
  'REL-4H': row(320000, 350000, 380000, true),
  'REL-4M': row(320000, 350000, 380000, true),
  'REL-2H2M': row(320000, 350000, 380000, true),
  'IND-H': row(150000, 165000, 180000, true),
  'IND-M': row(150000, 165000, 180000, true),
  'IND-PRO-H': row(150000, 165000, 180000, true, false),
  'IND-PRO-M': row(150000, 165000, 180000, true, false),
  'HALF-IND-M': row(80000, 90000, 100000, true),
  'HALF-IND-H': row(80000, 90000, 100000, true),
  'HALF-DOB-MM': row(160000, 180000, 200000, true),
  'HALF-DOB-HH': row(160000, 180000, 200000, true),
  'HALF-DOB-MH': row(160000, 180000, 200000, true),
  'WOD-M': row(35000, 35000, 35000, false),
  'WOD-H': row(35000, 35000, 35000, false),
  'PUB-VIE': row(25000, 25000, 25000, false),
  'PUB-SAB': row(25000, 25000, 25000, false),
  'PUB-DOM': row(25000, 25000, 25000, false),
  'PUB-3D': row(60000, 60000, 60000, false, true, false),
  'FOT-VIE': row(35000, 35000, 35000, false),
  'FOT-SAB': row(35000, 35000, 35000, false),
  'FOT-DOM': row(35000, 35000, 35000, false),
  'FOT-3D': row(80000, 80000, 80000, false, true, false),
})

export function getProductStagePriceRow(productCode: string): StagePriceRow | null {
  return PRODUCT_STAGE_PRICES[productCode] ?? null
}

export function priceCentsForStage(priceRow: StagePriceRow, stage: CommercialStage): number {
  switch (stage) {
    case 'LAUNCH':
      return priceRow.launch_cents
    case 'PRESALE':
      return priceRow.presale_cents
    case 'REGULAR':
      return priceRow.regular_cents
  }
}

export type CommercialResolution = {
  product_code: string
  commercial_stage: CommercialStage
  unit_price_cents: number
  currency: 'MXN'
  msi_eligible: boolean
  pricing_rules_version: typeof PRICING_RULES_VERSION
  stage_resolved_at: string
  sale_state: CommercialSaleState
  consumed_units: number
}

export type ResolveCommercialInput = {
  productCode: string
  totalCupo: number
  consumedUnits: number
  /** Persisted per-SKU high-water mark; never regresses on hold expiry. */
  persistedStage?: CommercialStage | string | null
  now?: Date
  productDisabled?: boolean
  multidayBlocked?: boolean
}

export function resolveCommercialOffer(
  input: ResolveCommercialInput,
): CommercialResolution | { error: CommercialSaleState } {
  const now = input.now ?? new Date()
  const priceRow = getProductStagePriceRow(input.productCode)
  if (!priceRow) {
    return { error: 'PRODUCT_DISABLED' }
  }
  if (priceRow.multiday_fail_closed || input.multidayBlocked) {
    return { error: 'MULTIDAY_FAIL_CLOSED' }
  }
  if (input.productDisabled || !priceRow.checkout_enabled) {
    return { error: 'PRODUCT_DISABLED' }
  }

  const persisted = normalizePersistedStage(input.persistedStage)
  const effective = resolveEffectiveStage(
    now,
    input.totalCupo,
    input.consumedUnits,
    persisted,
  )
  if (effective === 'SALES_CLOSED') return { error: 'SALES_CLOSED' }
  if (effective === 'SALES_NOT_OPEN') return { error: 'SALES_NOT_OPEN' }

  return {
    product_code: input.productCode,
    commercial_stage: effective,
    unit_price_cents: priceCentsForStage(priceRow, effective),
    currency: 'MXN',
    msi_eligible: priceRow.msi_eligible,
    pricing_rules_version: PRICING_RULES_VERSION,
    stage_resolved_at: now.toISOString(),
    sale_state: 'AVAILABLE',
    consumed_units: input.consumedUnits,
  }
}

export type OrderCommercialSnapshot = {
  product_code: string
  commercial_stage: CommercialStage
  unit_price_cents: number
  quantity: number
  total_price_cents: number
  currency: 'MXN'
  msi_eligible: boolean
  pricing_rules_version: typeof PRICING_RULES_VERSION
  stage_resolved_at: string
  hold_expires_at: string | null
}

export function buildOrderCommercialSnapshot(input: {
  resolution: CommercialResolution
  quantity: number
  holdExpiresAt?: string | null
}): OrderCommercialSnapshot {
  const qty = input.quantity
  return {
    product_code: input.resolution.product_code,
    commercial_stage: input.resolution.commercial_stage,
    unit_price_cents: input.resolution.unit_price_cents,
    quantity: qty,
    total_price_cents: input.resolution.unit_price_cents * qty,
    currency: 'MXN',
    msi_eligible: input.resolution.msi_eligible,
    pricing_rules_version: input.resolution.pricing_rules_version,
    stage_resolved_at: input.resolution.stage_resolved_at,
    hold_expires_at: input.holdExpiresAt ?? null,
  }
}

/**
 * Optional optimistic client expectation — never authority.
 * Throws CheckoutError-compatible code string PRICE_CHANGED.
 */
export function assertClientExpectedPrice(
  expectedUnitPriceCents: number | undefined,
  canonicalUnitPriceCents: number,
): void {
  if (expectedUnitPriceCents === undefined) return
  if (expectedUnitPriceCents !== canonicalUnitPriceCents) {
    throw new Error('PRICE_CHANGED')
  }
}

/** Test helper: Merida wall → Date */
export function dateFromMeridaWall(y: number, m: number, d: number, hh = 0, mm = 0, ss = 0): Date {
  return new Date(meridaWallToUtcMs(y, m, d, hh, mm, ss))
}
