/**
 * Exact Origin allowlist for browser-facing edge functions.
 * Fail-closed: missing config → CONFIGURATION_ERROR semantics at caller.
 * Mismatch / null / absent Origin → ORIGIN_NOT_ALLOWED (403).
 * Never emits Access-Control-Allow-Origin: *.
 */

export type OriginEnvReader = (key: string) => string | undefined

export type OriginGateResult =
  | {
      ok: true
      origin: string
      headers: Record<string, string>
    }
  | {
      ok: false
      kind: 'MISSING_CONFIG' | 'ORIGIN_NOT_ALLOWED'
    }

const PUBLIC_ORIGIN_NOT_ALLOWED = {
  error: {
    code: 'ORIGIN_NOT_ALLOWED' as const,
    message: 'Request origin is not allowed.',
    retry: 'NO' as const,
  },
}

/** Trim-only normalization of the configured allowlist value. */
export function normalizeConfiguredOrigin(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Read a single exact allowed origin. Optional fallback key (order-status → checkout).
 * Returns null when unset (caller maps to CONFIGURATION_ERROR).
 */
export function readConfiguredOrigin(
  env: OriginEnvReader,
  primaryKey: string,
  fallbackKey?: string,
): string | null {
  const primary = normalizeConfiguredOrigin(env(primaryKey))
  if (primary) return primary
  if (fallbackKey) return normalizeConfiguredOrigin(env(fallbackKey))
  return null
}

export function readRequestOrigin(req: Request): string | null {
  const raw = req.headers.get('Origin')
  if (raw == null) return null
  // Browsers may send the literal token "null" for opaque origins.
  if (raw === 'null') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildCorsHeaders(input: {
  allowedOrigin: string
  allowMethods: string
  allowHeaders: string
  extra?: Record<string, string>
}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': input.allowedOrigin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': input.allowMethods,
    'Access-Control-Allow-Headers': input.allowHeaders,
    ...(input.extra ?? {}),
  }
}

/**
 * Exact string equality after trim of the configured value.
 * No startsWith/endsWith/includes/regex/hostname-only matching.
 */
export function gateRequestOrigin(input: {
  req: Request
  allowedOrigin: string | null
  allowMethods: string
  allowHeaders: string
  extraHeaders?: Record<string, string>
}): OriginGateResult {
  if (!input.allowedOrigin) {
    return { ok: false, kind: 'MISSING_CONFIG' }
  }
  const requestOrigin = readRequestOrigin(input.req)
  if (requestOrigin == null || requestOrigin !== input.allowedOrigin) {
    return { ok: false, kind: 'ORIGIN_NOT_ALLOWED' }
  }
  return {
    ok: true,
    origin: input.allowedOrigin,
    headers: buildCorsHeaders({
      allowedOrigin: input.allowedOrigin,
      allowMethods: input.allowMethods,
      allowHeaders: input.allowHeaders,
      extra: input.extraHeaders,
    }),
  }
}

export function originNotAllowedBody(): typeof PUBLIC_ORIGIN_NOT_ALLOWED {
  return PUBLIC_ORIGIN_NOT_ALLOWED
}

/** 403 without Access-Control-Allow-Origin from application code. */
export function originNotAllowedResponse(): Response {
  return new Response(JSON.stringify(originNotAllowedBody()), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function assertNoWildcard(headers: Record<string, string>): void {
  const acao = headers['Access-Control-Allow-Origin']
  if (acao === '*') {
    throw new Error('Application CORS must not emit wildcard')
  }
}
