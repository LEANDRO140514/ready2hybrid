import { PaymentContractError } from '../payments/errors'

/**
 * Canonical cents → Clip Checkout Redirect decimal amount.
 * 12345 cents → 123.45. Integer cents only; no SKU/price recomputation.
 */
export function centsToClipAmount(cents: number): number {
  if (!Number.isInteger(cents) || !Number.isSafeInteger(cents) || cents <= 0) {
    throw new PaymentContractError('INVALID_REQUEST', 'amountCents must be a safe positive integer')
  }
  if (cents < 100) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'amountCents must be >= 100 (Clip create amount >= 1.00 MXN)',
    )
  }
  const major = Math.trunc(cents / 100)
  const minor = cents % 100
  return Number(`${major}.${String(minor).padStart(2, '0')}`)
}

/**
 * Clip GET decimal amount → canonical integer cents.
 * Correspondence compares cents, never floating provider vs floating catalog.
 */
export function clipAmountToCents(amount: unknown): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Clip amount is missing or not a finite number',
    )
  }
  const text = amount.toFixed(2)
  const [whole, fraction = '00'] = text.split('.')
  const cents = Number(whole) * 100 + Number(fraction)
  if (!Number.isInteger(cents) || cents < 0 || !Number.isSafeInteger(cents)) {
    throw new PaymentContractError(
      'FINANCIAL_RESOLUTION_FAILURE',
      'Clip amount cannot be converted to integer cents',
    )
  }
  return cents
}
