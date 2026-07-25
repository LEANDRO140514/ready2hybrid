import { WebhookError } from './errors'

export type WebhookRuntimeConfig = {
  webhookSecret: string
  accessToken: string
  expectedLiveMode: boolean | null
  expectedCollectorId: string | null
}

export function loadWebhookSecret(env: (key: string) => string | undefined): string {
  const webhookSecret = env('MERCADOPAGO_WEBHOOK_SECRET')?.trim()
  if (!webhookSecret) {
    throw new WebhookError('WEBHOOK_NOT_CONFIGURED')
  }
  return webhookSecret
}

export function loadPaymentAccessConfig(env: (key: string) => string | undefined): Omit<
  WebhookRuntimeConfig,
  'webhookSecret'
> {
  const accessToken = env('MERCADOPAGO_ACCESS_TOKEN')?.trim()
  if (!accessToken) {
    throw new WebhookError('CONFIGURATION_ERROR')
  }

  const liveRaw = env('MERCADOPAGO_LIVE_MODE')?.trim().toLowerCase()
  let expectedLiveMode: boolean | null = null
  if (liveRaw === 'true' || liveRaw === '1') expectedLiveMode = true
  else if (liveRaw === 'false' || liveRaw === '0') expectedLiveMode = false

  const expectedCollectorId = env('MERCADOPAGO_COLLECTOR_ID')?.trim() || null

  return {
    accessToken,
    expectedLiveMode,
    expectedCollectorId,
  }
}

export function loadWebhookRuntimeConfig(env: (key: string) => string | undefined): WebhookRuntimeConfig {
  return {
    webhookSecret: loadWebhookSecret(env),
    ...loadPaymentAccessConfig(env),
  }
}
