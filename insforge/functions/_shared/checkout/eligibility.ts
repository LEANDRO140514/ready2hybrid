import { CheckoutError } from './errors'
import type { ProductSalesRow } from './sales'

/**
 * OD-020 pending: spectator/press products without a bound event day
 * (PUB-3D / FOT-3D and equivalent) are catalog-valid but not checkout-eligible.
 * Internal reason must not appear in public error bodies.
 */
export function isMultidayCheckoutBlocked(product: ProductSalesRow): boolean {
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
