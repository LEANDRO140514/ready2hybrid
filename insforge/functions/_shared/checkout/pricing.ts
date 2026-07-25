import type { Journey } from './journeys'
import { capacityUnitForJourney, economicUnitForJourney } from './journeys'
import type { ProductSalesRow } from './sales'

export type PriceSnapshot = {
  currency: 'MXN'
  unit_price_cents: number
  quantity: number
  item_total_cents: number
  subtotal_cents: number
  total_cents: number
  journey: Journey
  economic_unit: ReturnType<typeof economicUnitForJourney>
  capacity_unit: ReturnType<typeof capacityUnitForJourney>
  has_chip: boolean
  has_insurance: boolean
  chip_extra_cents: 0
  insurance_extra_cents: 0
}

/**
 * Backend-authoritative pricing. Team/pair products use the full unit price
 * once; chip/insurance are inclusions, never surcharges.
 */
export function buildPriceSnapshot(
  product: ProductSalesRow,
  journey: Journey,
  quantity: number,
): PriceSnapshot {
  const unit = product.price_cents
  const itemTotal = unit * quantity
  return {
    currency: 'MXN',
    unit_price_cents: unit,
    quantity,
    item_total_cents: itemTotal,
    subtotal_cents: itemTotal,
    total_cents: itemTotal,
    journey,
    economic_unit: economicUnitForJourney(journey, product.team_size),
    capacity_unit: capacityUnitForJourney(journey, product.team_size),
    has_chip: product.has_chip,
    has_insurance: product.has_insurance,
    chip_extra_cents: 0,
    insurance_extra_cents: 0,
  }
}
