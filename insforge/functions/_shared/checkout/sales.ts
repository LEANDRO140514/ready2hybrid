import { CheckoutError } from './errors'

export type EventSalesRow = {
  code: string
  status: string
  sales_open_at: string | null
  sales_close_at: string | null
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
}

const CLOSED_PRODUCT_STATES = new Set([
  'SOLD_OUT',
  'SALES_CLOSED',
  'CANCELLED',
  'INACTIVE',
  'HIDDEN',
])

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

export function assertProductSellable(product: ProductSalesRow): void {
  if (product.sale_state && CLOSED_PRODUCT_STATES.has(product.sale_state)) {
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
