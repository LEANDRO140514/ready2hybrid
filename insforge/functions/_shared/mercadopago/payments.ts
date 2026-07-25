import { WebhookError } from '../webhook/errors'

export type MercadoPagoPayment = {
  id: string
  status: string
  status_detail?: string | null
  external_reference?: string | null
  transaction_amount?: number | null
  currency_id?: string | null
  live_mode?: boolean | null
  collector_id?: number | string | null
  date_created?: string | null
  date_last_updated?: string | null
  metadata?: Record<string, unknown> | null
}

export type PaymentClient = {
  getPayment: (paymentId: string, accessToken: string) => Promise<MercadoPagoPayment>
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100)
}

export function createHttpPaymentClient(fetchImpl: typeof fetch = fetch): PaymentClient {
  return {
    async getPayment(paymentId, accessToken) {
      let response: Response
      try {
        response = await fetchImpl(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
      } catch {
        throw new WebhookError('PROVIDER_UNAVAILABLE')
      }

      if (response.status === 404) {
        throw new WebhookError('PAYMENT_NOT_FOUND')
      }
      if (response.status === 401 || response.status === 403) {
        throw new WebhookError('CONFIGURATION_ERROR')
      }
      if (response.status >= 500 || response.status === 429) {
        throw new WebhookError('PROVIDER_UNAVAILABLE')
      }
      if (!response.ok) {
        throw new WebhookError('PROVIDER_UNAVAILABLE')
      }

      const json = (await response.json()) as MercadoPagoPayment
      if (json.id === undefined || json.id === null || !json.status) {
        throw new WebhookError('PROVIDER_UNAVAILABLE')
      }
      return {
        ...json,
        id: String(json.id),
      }
    },
  }
}

export function createMockPaymentClient(
  impl?: (paymentId: string, accessToken: string) => Promise<MercadoPagoPayment>,
): PaymentClient {
  return {
    getPayment:
      impl ??
      (async (paymentId) => ({
        id: paymentId,
        status: 'approved',
        external_reference: '00000000-0000-0000-0000-000000000001',
        transaction_amount: 1400,
        currency_id: 'MXN',
        live_mode: false,
        collector_id: 1,
      })),
  }
}
