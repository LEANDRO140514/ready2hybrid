/**
 * Canonical Checkout Pro payment policy derived from commercial snapshot only.
 * Does not call Mercado Pago. Does not infer eligibility from SKU/name/price.
 */
import { CheckoutError } from './errors'

export type CheckoutPaymentPolicy = {
  maximumInstallments: 1 | 3
  excludeTicketPayments: true
}

/**
 * Pure translation: commercial_snapshot.msi_eligible → preference installment cap.
 * Ticket exclusion is always required for public checkout preferences.
 */
export function toCheckoutPaymentPolicy(msiEligible: boolean): CheckoutPaymentPolicy {
  if (msiEligible === true) {
    return { maximumInstallments: 3, excludeTicketPayments: true }
  }
  if (msiEligible === false) {
    return { maximumInstallments: 1, excludeTicketPayments: true }
  }
  // Exhaustiveness / non-boolean defense (TypeScript narrows; runtime still guarded).
  throw new CheckoutError('CONFIGURATION_ERROR', 'msi_eligible must be boolean')
}

/** Fail-closed: only a real boolean may drive preference payment_methods. */
export function assertCanonicalMsiEligible(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new CheckoutError('CONFIGURATION_ERROR', 'msi_eligible must be boolean')
  }
}

/** Structural guard before serializing into the preference body. */
export function assertCheckoutPaymentPolicy(
  policy: CheckoutPaymentPolicy,
): asserts policy is CheckoutPaymentPolicy {
  if (
    (policy.maximumInstallments !== 1 && policy.maximumInstallments !== 3) ||
    policy.excludeTicketPayments !== true
  ) {
    throw new CheckoutError('CONFIGURATION_ERROR', 'invalid checkout payment policy')
  }
}
