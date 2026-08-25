import { CheckoutError } from './errors'

export type EventSalesRow = {
  code: string
  status: string
  sales_open_at: string | null
  sales_close_at: string | null
  /** Organizer-controlled event SOLD_OUT. Independent of CONFIGURADO / EN_VENTA. */
  sale_state?: string | null
}

export type ProductSalesRow = {
  code: string
  sale_state: string | null
  visibility: string | null
  cupo: number
  price_cents: number
  currency: string
  team_size: number
  event_code: string
  has_chip: boolean
  has_insurance: boolean
  block: string
  kind: string
  name: string
  id: string
  /** Bound event day; null for PUB-3D / FOT-3D. */
  day: string | null
  /** Persisted commercial stage high-water mark (LAUNCH|PRESALE|REGULAR). Ignored for price. */
  commercial_stage_high_water?: string | null
  session?: string | null
}

export const COMMERCIAL_BLOCKS = ['COMPITE', 'EXPERIENCE', 'ASISTE'] as const
export type CommercialBlock = (typeof COMMERCIAL_BLOCKS)[number]

/** v0.4 persistence vocabulary. SQL CHECK successor is required to allow ALL_DAY. */
export const ALLOWED_PRODUCT_SESSIONS = ['AM', 'PM', 'ALL_DAY'] as const

const CLOSED_PRODUCT_STATES = new Set([
  'SOLD_OUT',
  'SALES_CLOSED',
  'CANCELLED',
  'INACTIVE',
  'HIDDEN',
  'RETIRED_PRODUCT',
  'SUPERSEDED_SCHEDULE_VARIANT',
])

export function isOrganizerSoldOutState(value: string | null | undefined): boolean {
  return value === 'SOLD_OUT'
}

/** SPEC-030/032: parent SOLD_OUT wins; child AVAILABLE cannot override. */
export function resolveEffectiveSoldOut(input: {
  skuSoldOut: boolean
  categoryOfferSoldOut: boolean
  eventSoldOut: boolean
}): boolean {
  return input.skuSoldOut || input.categoryOfferSoldOut || input.eventSoldOut
}

export function assertEffectiveSoldOut(input: {
  product: ProductSalesRow
  event?: EventSalesRow | null
  categoryOfferSaleState?: string | null
}): void {
  const soldOut = resolveEffectiveSoldOut({
    skuSoldOut: isOrganizerSoldOutState(input.product.sale_state),
    categoryOfferSoldOut: isOrganizerSoldOutState(input.categoryOfferSaleState),
    eventSoldOut: isOrganizerSoldOutState(input.event?.sale_state),
  })
  if (soldOut) {
    throw new CheckoutError('SOLD_OUT')
  }
}

/**
 * Fail-closed sales gate (OD-023).
 * CONFIGURADO is never sellable. sales_open_at must be set and reached.
 */
export function assertSalesOpen(event: EventSalesRow, now: Date = new Date()): void {
  if (event.status === 'CONFIGURADO') {
    throw new CheckoutError('SALES_NOT_OPEN')
  }
  if (!event.sales_open_at) {
    throw new CheckoutError('SALES_NOT_OPEN')
  }
  const openAt = new Date(event.sales_open_at)
  if (Number.isNaN(openAt.getTime()) || now < openAt) {
    throw new CheckoutError('SALES_NOT_OPEN')
  }
  if (event.sales_close_at) {
    const closeAt = new Date(event.sales_close_at)
    if (!Number.isNaN(closeAt.getTime()) && now > closeAt) {
      throw new CheckoutError('SALES_CLOSED')
    }
  }
  const openStatuses = new Set(['EN_VENTA', 'AVAILABLE', 'OPEN'])
  if (!openStatuses.has(event.status)) {
    throw new CheckoutError('SALES_NOT_OPEN')
  }
}

export function assertProductSellable(
  product: ProductSalesRow,
  scope?: { event?: EventSalesRow | null; categoryOfferSaleState?: string | null },
): void {
  assertEffectiveSoldOut({
    product,
    event: scope?.event,
    categoryOfferSaleState: scope?.categoryOfferSaleState,
  })
  if (product.sale_state && CLOSED_PRODUCT_STATES.has(product.sale_state) && product.sale_state !== 'SOLD_OUT') {
    throw new CheckoutError('PRODUCT_NOT_AVAILABLE')
  }
  if (product.visibility === 'HIDDEN') {
    throw new CheckoutError('PRODUCT_NOT_AVAILABLE')
  }
  if (product.currency !== 'MXN') {
    throw new CheckoutError('CONFIGURATION_ERROR')
  }
  if (!Number.isInteger(product.price_cents) || product.price_cents < 0) {
    throw new CheckoutError('CONFIGURATION_ERROR')
  }
}
