import { CheckoutError } from './errors'
import type { PriceSnapshot } from './pricing'
import {
  assertCheckoutPaymentPolicy,
  CARD_ONLY_EXCLUDED_PAYMENT_TYPES,
  type CheckoutPaymentPolicy,
} from './payment-policy'

export type CreatePreferenceInput = {
  accessToken: string
  siteId: string
  orderId: string
  productCode: string
  productName: string
  price: PriceSnapshot
  /** Canonical policy from commercial_snapshot.msi_eligible — never client-supplied. */
  paymentPolicy: CheckoutPaymentPolicy
  backUrls: { success: string; failure: string; pending: string }
  notificationUrl: string
  /** Order expires_at. The preference stops at this same instant. */
  expiresAt?: string | null
  /** Clock for expiration_date_from. Defaults to the real current instant. */
  now?: Date
}

export type CreatePreferenceResult = {
  preferenceId: string
  initPoint: string
  sandboxInitPoint?: string | null
}

export type MercadoPagoClient = {
  createCheckoutProPreference: (input: CreatePreferenceInput) => Promise<CreatePreferenceResult>
}

/** UTC instant with milliseconds. Z matches orders.expires_at; America/Mérida is UTC−6. */
export function isoInstant(value: string | Date): string | null {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

/**
 * Checkout Pro validity. México requires expires true plus both ISO-8601 dates.
 * expiration_date_to is the order hold. from is this clock, so the preference
 * is payable at once and ends with the hold. date_of_expiration is cash only.
 * An open card form is outside that contract; a late approval stays a review.
 */
export function preferenceTerm(
  expiresAt: string,
  now: Date,
): { expires: true; expiration_date_from: string; expiration_date_to: string } | null {
  const expirationDateTo = isoInstant(expiresAt)
  const expirationDateFrom = isoInstant(now)
  if (!expirationDateTo || !expirationDateFrom) return null
  if (Date.parse(expirationDateTo) <= Date.parse(expirationDateFrom)) return null
  return {
    expires: true,
    expiration_date_from: expirationDateFrom,
    expiration_date_to: expirationDateTo,
  }
}

/** True only while expires_at is strictly after now. The boundary is already closed. */
export function reservationStillOpen(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt) return false
  const ms = Date.parse(expiresAt)
  return Number.isFinite(ms) && ms > now.getTime()
}

function serializePaymentMethods(policy: CheckoutPaymentPolicy) {
  assertCheckoutPaymentPolicy(policy)
  return {
    installments: policy.maximumInstallments,
    excluded_payment_types: policy.cardsOnly
      ? [...CARD_ONLY_EXCLUDED_PAYMENT_TYPES]
      : [{ id: 'ticket' }],
  }
}

export function createHttpMercadoPagoClient(fetchImpl: typeof fetch = fetch): MercadoPagoClient {
  return {
    async createCheckoutProPreference(input) {
      if (!input.paymentPolicy) {
        throw new CheckoutError('CONFIGURATION_ERROR', 'paymentPolicy required')
      }
      const payment_methods = serializePaymentMethods(input.paymentPolicy)
      const term = input.expiresAt
        ? preferenceTerm(input.expiresAt, input.now ?? new Date())
        : null
      if (input.expiresAt && !term) throw new CheckoutError('RESERVATION_EXPIRED')

      const body = {
        external_reference: input.orderId,
        notification_url: input.notificationUrl,
        back_urls: input.backUrls,
        auto_return: 'approved',
        items: [
          {
            id: input.productCode,
            title: input.productName,
            quantity: input.price.quantity,
            currency_id: 'MXN',
            unit_price: input.price.unit_price_cents / 100,
          },
        ],
        payment_methods,
        metadata: {
          product_code: input.productCode,
          journey: input.price.journey,
        },
        ...(term ?? {}),
      }

      const response = await fetchImpl('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': input.orderId,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new CheckoutError('CHECKOUT_CREATION_FAILED')
      }

      const json = (await response.json()) as {
        id?: string
        init_point?: string
        sandbox_init_point?: string
      }

      if (!json.id || !json.init_point) {
        throw new CheckoutError('CHECKOUT_CREATION_FAILED')
      }

      return {
        preferenceId: json.id,
        initPoint: json.init_point,
        sandboxInitPoint: json.sandbox_init_point ?? null,
      }
    },
  }
}

export function createMockMercadoPagoClient(
  impl?: (input: CreatePreferenceInput) => Promise<CreatePreferenceResult>,
): MercadoPagoClient {
  return {
    createCheckoutProPreference:
      impl ??
      (async () => ({
        preferenceId: 'pref_mock_opaque',
        initPoint: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref_mock_opaque',
        sandboxInitPoint: null,
      })),
  }
}
