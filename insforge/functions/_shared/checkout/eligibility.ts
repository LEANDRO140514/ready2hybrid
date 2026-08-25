import { CheckoutError } from './errors'
import type { ProductSalesRow } from './sales'

export const MULTIDAY_PRODUCT_CODES = ['PUB-3D', 'FOT-3D'] as const
export const MULTIDAY_ENTITLEMENT_DATES = ['2026-11-13', '2026-11-14', '2026-11-15'] as const

export function isMultidayProductCode(code: string): boolean {
  return (MULTIDAY_PRODUCT_CODES as readonly string[]).includes(code)
}

/** One purchase → three date-scoped entitlements; session NULL. */
export function accessEntitlementsForProduct(product: {
  code: string
  day: string | null
  session?: string | null
}): Array<{ entitlement_date: string; session: string | null }> {
  if (isMultidayProductCode(product.code)) {
    return MULTIDAY_ENTITLEMENT_DATES.map((entitlement_date) => ({
      entitlement_date,
      session: null,
    }))
  }
  if (product.day == null || product.day === '') return []
  return [{ entitlement_date: product.day, session: product.session ?? null }]
}

/**
 * PUB-3D / FOT-3D are checkout-eligible with day NULL.
 * Other spectator/press SKUs still require a bound event day.
 */
export function isMultidayCheckoutBlocked(product: ProductSalesRow): boolean {
  if (isMultidayProductCode(product.code)) return false
  if (product.kind !== 'spectator' && product.kind !== 'press') return false
  return product.day == null || product.day === ''
}

/**
 * Fail-closed checkout eligibility after canonical product resolution.
 * Distinguishes catalog-valid-but-blocked from sellable products.
 */
export function assertCheckoutProductAvailable(product: ProductSalesRow): void {
  if (isMultidayCheckoutBlocked(product)) {
    throw new CheckoutError('PRODUCT_NOT_AVAILABLE')
  }
}
