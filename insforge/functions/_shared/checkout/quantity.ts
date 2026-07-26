import { CheckoutError } from './errors'
import type { ProductSalesRow } from './sales'

/**
 * OD-001 APPROVED: spectator products may sell quantity >= 1 access units.
 * Competitors, workouts, press, and team products remain quantity = 1.
 */
export function assertQuantityForProduct(product: ProductSalesRow, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CheckoutError('INVALID_REQUEST', 'quantity must be a positive integer')
  }
  if (product.kind === 'spectator') {
    if (quantity > product.cupo) {
      throw new CheckoutError('SOLD_OUT')
    }
    return
  }
  if (quantity !== 1) {
    throw new CheckoutError('INVALID_REQUEST', 'Only quantity=1 is accepted for this product')
  }
}

/** Capacity hold units equal sold spectator access units; otherwise one unit. */
export function capacityUnitsForQuantity(product: ProductSalesRow, quantity: number): number {
  if (product.kind === 'spectator') return quantity
  return 1
}
