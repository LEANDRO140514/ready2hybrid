/**
 * Canonical Checkout Pro payment policy derived from commercial snapshot only.
 * Does not call Mercado Pago. Does not infer eligibility from SKU/name/price.
 */
import { CheckoutError } from './errors'
import { CARDS_ONLY_FROM } from './staged-pricing'

export type CheckoutPaymentPolicy = {
  maximumInstallments: 1 | 3
  excludeTicketPayments: true
  /** From 13 nov 2026 00:00 America/Mérida, every product takes cards only. */
  cardsOnly?: boolean
}

/** Credit, debit, and prepaid stay available. Cash, transfer, ATM, and wallet do not. */
export const CARD_ONLY_EXCLUDED_PAYMENT_TYPES = [
  { id: 'ticket' },
  { id: 'bank_transfer' },
  { id: 'atm' },
  { id: 'account_money' },
  { id: 'digital_wallet' },
  { id: 'digital_currency' },
] as const

/**
 * From 13 nov 2026 00:00 America/Mérida, every product is card-only.
 * Cash and transfer confirm too late and would land without a ticket.
 * The product code stays in the signature for callers; the cutoff does not depend on it.
 */
export function publicEventCardsOnly(_productCode: string, now: Date): boolean {
  return now.getTime() >= CARDS_ONLY_FROM
}

/**
 * Pure translation: commercial_snapshot.msi_eligible → preference installment cap.
 * Ticket exclusion is always required for public checkout preferences.
 */
export function toCheckoutPaymentPolicy(
  msiEligible: boolean,
  cardsOnly = false,
): CheckoutPaymentPolicy {
  const maximumInstallments = msiEligible === true ? 3 : msiEligible === false ? 1 : null
  if (maximumInstallments == null) {
    throw new CheckoutError('CONFIGURATION_ERROR', 'msi_eligible must be boolean')
  }
  const policy: CheckoutPaymentPolicy = {
    maximumInstallments,
    excludeTicketPayments: true,
  }
  if (cardsOnly) return { ...policy, cardsOnly: true }
  return policy
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
    policy.excludeTicketPayments !== true ||
    (policy.cardsOnly != null && policy.cardsOnly !== true)
  ) {
    throw new CheckoutError('CONFIGURATION_ERROR', 'invalid checkout payment policy')
  }
}
