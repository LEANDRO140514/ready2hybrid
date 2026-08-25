import { PaymentContractError } from './errors'
import { parseActivePaymentProviderId } from './ids'
import type { ResolvedPaymentCheckoutInput } from './types'

const FORBIDDEN_COMMERCIAL_OR_SECRET_KEYS = [
  'product_code',
  'sku',
  'sku_code',
  'journey',
  'commercial_stage',
  'stage',
  'price',
  'unit_price',
  'unit_price_cents',
  'total',
  'total_cents',
  'capacity',
  'cupo',
  'quota',
  'prizes',
  'awards',
  'schedule',
  'competition_day',
  'pan',
  'card_number',
  'cvv',
  'cvc',
  'security_code',
  'access_token',
  'secret',
  'webhook_secret',
] as const

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PaymentContractError('INVALID_REQUEST', `${field} is required`)
  }
  return value.trim()
}

function requireAmountCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new PaymentContractError('INVALID_REQUEST', 'amountCents must be a positive integer')
  }
  return value
}

/**
 * Parses server-side resolved checkout input. Rejects catalog/price authority
 * fields and card/secret keys. Does not compute commercial price.
 */
export function parseResolvedPaymentCheckoutInput(raw: unknown): ResolvedPaymentCheckoutInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PaymentContractError('INVALID_REQUEST')
  }
  const obj = raw as Record<string, unknown>
  for (const key of FORBIDDEN_COMMERCIAL_OR_SECRET_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new PaymentContractError('INVALID_REQUEST', `Checkout input must not include ${key}`)
    }
  }

  if (obj.eligibility !== 'PAYMENT_ELIGIBLE') {
    throw new PaymentContractError('INVALID_REQUEST', 'Checkout requires PAYMENT_ELIGIBLE')
  }

  const returnUrlsRaw = obj.returnUrls
  if (!returnUrlsRaw || typeof returnUrlsRaw !== 'object' || Array.isArray(returnUrlsRaw)) {
    throw new PaymentContractError('INVALID_REQUEST', 'returnUrls is required')
  }
  const returnUrlsObj = returnUrlsRaw as Record<string, unknown>
  if (obj.currency !== 'MXN') {
    throw new PaymentContractError('INVALID_REQUEST', 'currency must be MXN')
  }

  return {
    eligibility: 'PAYMENT_ELIGIBLE',
    orderId: requireNonEmptyString(obj.orderId, 'orderId'),
    provider: parseActivePaymentProviderId(obj.provider),
    amountCents: requireAmountCents(obj.amountCents),
    currency: 'MXN',
    reference: requireNonEmptyString(obj.reference, 'reference'),
    description: requireNonEmptyString(obj.description, 'description'),
    returnUrls: {
      success: requireNonEmptyString(returnUrlsObj.success, 'returnUrls.success'),
      failure: requireNonEmptyString(returnUrlsObj.failure, 'returnUrls.failure'),
      pending: requireNonEmptyString(returnUrlsObj.pending, 'returnUrls.pending'),
    },
    ...(obj.expiresAt === undefined ? {} : { expiresAt: requireIsoTimestamp(obj.expiresAt) }),
  }
}

function requireIsoTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PaymentContractError('INVALID_REQUEST', 'expiresAt must be a non-empty ISO-8601 timestamp')
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) {
    throw new PaymentContractError('INVALID_REQUEST', 'expiresAt must be a valid ISO-8601 timestamp')
  }
  return new Date(ms).toISOString()
}
