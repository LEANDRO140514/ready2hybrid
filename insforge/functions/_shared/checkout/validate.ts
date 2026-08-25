import { z } from 'zod'
import { CheckoutError } from './errors'
import { journeyForProductCode } from './journeys'
import {
  resolveSelectableProvider,
  type ProviderEnablement,
} from '../payments/ids'
import { isPaymentContractError } from '../payments/errors'

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
  'commercial_stage',
  'stage',
  'msi_eligible',
  'msi',
  'cupo',
  'quota',
  'quota_percent',
  'pricing_rules_version',
  'installments',
  'default_installments',
  'payment_methods',
  'excluded_payment_types',
  'excluded_payment_methods',
] as const

export const checkoutRequestSchema = z
  .object({
    product_code: z.string().min(1).max(64),
    quantity: z.number().int().positive().optional(),
    idempotency_key: z.string().min(8).max(128),
    /**
     * Optional optimistic display price for PRICE_CHANGED detection only.
     * Never commercial authority.
     */
    expected_unit_price_cents: z.number().int().nonnegative().optional(),
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
    selected_provider: z.enum(['MERCADO_PAGO', 'CLIP', 'OPENPAY']).optional(),
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
  // Product-kind quantity rules (OD-001 spectator multi-unit) are enforced after
  // catalog load in orchestrate; Zod already rejects non-positive / non-integer.
  if (!journeyForProductCode(parsed.data.product_code)) {
    throw new CheckoutError('PRODUCT_NOT_FOUND')
  }
  return { ...parsed.data, quantity }
}

/** Default go-live enablement: Mercado Pago only. No silent customer fallback. */
export function loadRuntimeProviderEnablement(
  env: (key: string) => string | undefined,
): ProviderEnablement {
  const raw = env('PAYMENTS_RUNTIME_ENABLED_PROVIDERS')?.trim()
  const tokens = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['MERCADO_PAGO']
  const enablement: ProviderEnablement = {}
  for (const token of tokens) {
    if (token === 'MERCADO_PAGO' || token === 'CLIP' || token === 'OPENPAY') {
      enablement[token] = true
    }
  }
  return enablement
}

export function assertSelectedProvider(
  selected: string | undefined,
  enablement: ProviderEnablement,
): 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY' {
  if (selected == null || selected === '') {
    throw new CheckoutError('UNSUPPORTED_PROVIDER')
  }
  try {
    return resolveSelectableProvider(selected, enablement)
  } catch (error) {
    if (isPaymentContractError(error) && error.code === 'UNSUPPORTED_PROVIDER') {
      throw new CheckoutError('UNSUPPORTED_PROVIDER')
    }
    throw new CheckoutError('UNSUPPORTED_PROVIDER')
  }
}
