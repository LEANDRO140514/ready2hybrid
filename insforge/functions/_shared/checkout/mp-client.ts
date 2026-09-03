import { CheckoutError } from './errors'
import type { PriceSnapshot } from './pricing'
import {
  assertCheckoutPaymentPolicy,
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
  expiresAt?: string | null
}

export type CreatePreferenceResult = {
  preferenceId: string
  initPoint: string
  sandboxInitPoint?: string | null
}

export type MercadoPagoClient = {
  createCheckoutProPreference: (input: CreatePreferenceInput) => Promise<CreatePreferenceResult>
}

function serializePaymentMethods(policy: CheckoutPaymentPolicy) {
  assertCheckoutPaymentPolicy(policy)
  return {
    installments: policy.maximumInstallments,
    excluded_payment_types: [{ id: 'ticket' }],
  }
}

export function createHttpMercadoPagoClient(fetchImpl: typeof fetch = fetch): MercadoPagoClient {
  return {
    async createCheckoutProPreference(input) {
      if (!input.paymentPolicy) {
        throw new CheckoutError('CONFIGURATION_ERROR', 'paymentPolicy required')
      }
      const payment_methods = serializePaymentMethods(input.paymentPolicy)

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
        ...(input.expiresAt
          ? {
              // MP requires ISO 8601 with milliseconds (3 decimals); Postgres emits microseconds (5+).
              // toISOString() normalizes to "YYYY-MM-DDTHH:mm:ss.sssZ" which MP accepts.
              expiration_date_to: new Date(input.expiresAt).toISOString(),
            }
          : {}),
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
