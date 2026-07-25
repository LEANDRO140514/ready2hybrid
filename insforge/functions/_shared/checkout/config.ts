import { CheckoutError } from './errors'

export type CheckoutRuntimeConfig = {
  holdDurationSeconds: number
  idempotencyTtlSeconds: number
  backUrlSuccess: string
  backUrlFailure: string
  backUrlPending: string
  notificationUrl: string
  corsOrigin: string | null
  mpAccessToken: string
  mpSiteId: string
  waiverRequiredDocumentType: string | null
  waiverRequiredVersion: string | null
}

type EnvReader = (key: string) => string | undefined

function requirePositiveInt(env: EnvReader, key: string): number {
  const raw = env(key)
  if (!raw) throw new CheckoutError('CONFIGURATION_ERROR', `${key} missing`)
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new CheckoutError('CONFIGURATION_ERROR', `${key} invalid`)
  }
  return n
}

function requireUrl(env: EnvReader, key: string): string {
  const raw = env(key)
  if (!raw) throw new CheckoutError('CONFIGURATION_ERROR', `${key} missing`)
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new Error('bad protocol')
    }
    return raw
  } catch {
    throw new CheckoutError('CONFIGURATION_ERROR', `${key} invalid`)
  }
}

/**
 * Fail-closed server configuration for OD-010 / OD-016 / API-OD-003 / MP.
 * Does not invent hold duration or return domains.
 */
export function loadCheckoutRuntimeConfig(env: EnvReader): CheckoutRuntimeConfig {
  const token = env('MERCADOPAGO_ACCESS_TOKEN')
  if (!token) throw new CheckoutError('CONFIGURATION_ERROR', 'MERCADOPAGO_ACCESS_TOKEN missing')

  return {
    holdDurationSeconds: requirePositiveInt(env, 'CHECKOUT_HOLD_DURATION_SECONDS'),
    idempotencyTtlSeconds: requirePositiveInt(env, 'CHECKOUT_IDEMPOTENCY_TTL_SECONDS'),
    backUrlSuccess: requireUrl(env, 'CHECKOUT_BACK_URL_SUCCESS'),
    backUrlFailure: requireUrl(env, 'CHECKOUT_BACK_URL_FAILURE'),
    backUrlPending: requireUrl(env, 'CHECKOUT_BACK_URL_PENDING'),
    notificationUrl: requireUrl(env, 'CHECKOUT_NOTIFICATION_URL'),
    corsOrigin: env('CHECKOUT_CORS_ORIGIN')?.trim() || null,
    mpAccessToken: token,
    mpSiteId: env('MERCADOPAGO_SITE_ID')?.trim() || 'MLM',
    waiverRequiredDocumentType: env('CHECKOUT_WAIVER_DOCUMENT_TYPE')?.trim() || null,
    waiverRequiredVersion: env('CHECKOUT_WAIVER_VERSION')?.trim() || null,
  }
}
