export type TicketCredentialRuntimeConfig = {
  corsOrigin: string | null
  idempotencyTtlSeconds: number
  /** Operator bearer for protected reissue/verify. Absent → protected actions fail closed. */
  operatorBearer: string | null
}

export function loadTicketCredentialRuntimeConfig(
  env: (key: string) => string | undefined,
): TicketCredentialRuntimeConfig {
  const ttlRaw = env('TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS') ?? '3600'
  const ttl = Number.parseInt(ttlRaw, 10)
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error('CONFIGURATION_ERROR')
  }
  return {
    corsOrigin: env('TICKET_CREDENTIAL_CORS_ORIGIN') ?? null,
    idempotencyTtlSeconds: ttl,
    operatorBearer: env('TICKET_OPERATOR_BEARER') ?? null,
  }
}
