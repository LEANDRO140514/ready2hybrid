import { z } from 'zod'
import { CheckoutError } from './errors'
import { journeyForProductCode } from './journeys'

const FORBIDDEN_CLIENT_MONEY_KEYS = [
  'price',
  'price_cents',
  'amount',
  'total',
  'currency',
  'insurance_fee',
  'chip_fee',
  'unit_price_cents',
  'item_total_cents',
  'subtotal_cents',
  'total_cents',
] as const

export const checkoutRequestSchema = z
  .object({
    product_code: z.string().min(1).max(64),
    quantity: z.number().int().positive().optional(),
    idempotency_key: z.string().min(8).max(128),
    buyer: z
      .object({
        public_ref: z.string().min(1).max(128).optional(),
      })
      .strict()
      .optional(),
    participant: z
      .object({
        public_ref: z.string().min(1).max(128).optional(),
      })
      .strict()
      .optional(),
    waiver: z
      .object({
        document_type: z.string().min(1).max(64).optional(),
        version: z.string().min(1).max(64).optional(),
        accepted: z.boolean().optional(),
      })
      .strict()
      .optional(),
    correlation_id: z.string().min(1).max(128).optional(),
  })
  .strict()

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

export function assertNoClientMoneyAuthority(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CheckoutError('INVALID_REQUEST')
  }
  const obj = raw as Record<string, unknown>
  for (const key of FORBIDDEN_CLIENT_MONEY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new CheckoutError('INVALID_REQUEST', `Client must not supply ${key}`)
    }
  }
}

export function parseCheckoutRequest(raw: unknown): CheckoutRequest & { quantity: number } {
  assertNoClientMoneyAuthority(raw)
  const parsed = checkoutRequestSchema.safeParse(raw)
  if (!parsed.success) {
    throw new CheckoutError('INVALID_REQUEST')
  }
  const quantity = parsed.data.quantity ?? 1
  if (quantity !== 1) {
    // OD-001 remains open: only quantity=1 is accepted.
    throw new CheckoutError('INVALID_REQUEST', 'Only quantity=1 is accepted')
  }
  if (!journeyForProductCode(parsed.data.product_code)) {
    throw new CheckoutError('PRODUCT_NOT_FOUND')
  }
  return { ...parsed.data, quantity }
}
