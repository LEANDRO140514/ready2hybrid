import { dateFromMeridaWall } from '../../../insforge/functions/_shared/checkout/staged-pricing'
import {
  resolveEffectiveSoldOut,
  type EventSalesRow,
  type ProductSalesRow,
} from '../../../insforge/functions/_shared/checkout/sales'

export const launchNow = () => dateFromMeridaWall(2026, 8, 15, 12, 0, 0)
export const presaleNow = () => dateFromMeridaWall(2026, 9, 15, 12, 0, 0)
export const regularNow = () => dateFromMeridaWall(2026, 10, 15, 12, 0, 0)

export const configuredEvent: EventSalesRow = {
  code: 'HEX-2026',
  status: 'CONFIGURADO',
  sales_open_at: null,
  sales_close_at: null,
}

export const openEvent: EventSalesRow = {
  code: 'HEX-2026',
  status: 'EN_VENTA',
  sales_open_at: '2026-01-01T00:00:00.000Z',
  sales_close_at: null,
}

export function productRow(
  overrides: Partial<ProductSalesRow> & Pick<ProductSalesRow, 'code'>,
): ProductSalesRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: overrides.code,
    block: 'COMPITE',
    kind: 'competitor',
    sale_state: null,
    visibility: null,
    cupo: 100,
    price_cents: 150000,
    currency: 'MXN',
    team_size: 1,
    event_code: 'HEX-2026',
    has_chip: true,
    has_insurance: true,
    day: '2026-11-13',
    commercial_stage_high_water: null,
    ...overrides,
  }
}

export function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    product_code: 'IND-H',
    idempotency_key: 'idem-key-12345678',
    selected_provider: 'MERCADO_PAGO',
    waiver: {
      document_type: 'SPORTS_WAIVER',
      version: '2026.1',
      accepted: true,
    },
    ...overrides,
  }
}

/** SPEC-031: payable checkout exists only when SALES_STATUS is explicitly OPEN. */
export function currentlyPayableCheckoutEligible(input: {
  salesStatus: 'CLOSED' | 'PROXIMAMENTE' | 'OPEN'
  sellableIdentity: boolean
  historical: boolean
  effectiveSoldOut: boolean
}): boolean {
  if (input.salesStatus !== 'OPEN') return false
  if (!input.sellableIdentity) return false
  if (input.historical) return false
  if (input.effectiveSoldOut) return false
  return true
}

/** SPEC-030/032: parent SOLD_OUT wins; child AVAILABLE cannot override. */
export function effectiveUnavailable(input: {
  skuSoldOut: boolean
  categoryOfferSoldOut: boolean
  eventSoldOut: boolean
}): boolean {
  return resolveEffectiveSoldOut(input)
}

/** Confirmed sales / registration count excludes pending checkout lifecycle. */
export function countsAsConfirmedSale(internalOrderState: string): boolean {
  return internalOrderState === 'PAID'
}
