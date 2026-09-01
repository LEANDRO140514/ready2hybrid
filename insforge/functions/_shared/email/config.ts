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
  return {
    operatorBearer: env('TICKET_OPERATOR_BEARER') ?? null,
    resendApiKey: env('RESEND_API_KEY') ?? null,
    idempotencyTtlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : 3600,
  }
}
