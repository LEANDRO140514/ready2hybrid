import { SendTicketEmailError } from './errors'

export type SendTicketEmailRuntimeConfig = {
  operatorBearer: string | null
  resendApiKey: string | null
  idempotencyTtlSeconds: number
}

export function loadSendTicketEmailRuntimeConfig(
  env: (key: string) => string | undefined,
): SendTicketEmailRuntimeConfig {
  const ttlRaw = env('TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS') ?? '3600'
  const ttl = Number.parseInt(ttlRaw, 10)
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new SendTicketEmailError('CONFIGURATION_ERROR', 'Invalid TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS')
  }
  return {
    operatorBearer: env('TICKET_OPERATOR_BEARER') ?? null,
    resendApiKey: env('RESEND_API_KEY') ?? null,
    idempotencyTtlSeconds: ttl,
  }
}
