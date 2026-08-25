import { PaymentContractError } from '../payments/errors'

/**
 * Canonical cents → Openpay charge decimal amount.
 * 12345 cents → 123.45. Integer cents only; no SKU/price recomputation.
 * Openpay requires amount > 0 with at most two decimals. No invented minimum.
 */
export function centsToOpenpayAmount(cents: number): number {
  if (!Number.isInteger(cents) || !Number.isSafeInteger(cents) || cents <= 0) {
    throw new PaymentContractError('INVALID_REQUEST', 'amountCents must be a safe positive integer')
  }
  const major = Math.trunc(cents / 100)
  const minor = cents % 100
  return Number(`${major}.${String(minor).padStart(2, '0')}`)
}

/**
 * Openpay GET decimal amount → canonical integer cents.
 * More than two meaningful decimals fail closed. Correspondence compares cents.
 */
export function openpayAmountToCents(amount: unknown): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Openpay amount is missing or not a finite number',
    )
  }
  const scaled = amount * 100
  const cents = Math.round(scaled)
  if (Math.abs(scaled - cents) > 1e-8) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Openpay amount has more than two decimal places',
    )
  }
  if (!Number.isInteger(cents) || cents < 0 || !Number.isSafeInteger(cents)) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Openpay amount cannot be converted to integer cents',
    )
  }
  return cents
}
