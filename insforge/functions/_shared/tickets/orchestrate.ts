import { loadTicketCredentialRuntimeConfig } from './config'
import { mapRpcError, TicketCredentialError } from './errors'
import { sha256Hex } from './hash'
import { parseQrToken, parseReissueRequest, parseTicketId } from './validate'

export type TicketCredentialRepository = {
  verifyToken: (input: {
    token: string
  }) => Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error_code: string }>
  getProjection: (input: {
    ticketId: string
  }) => Promise<{ ok: true; projection: Record<string, unknown> } | { ok: false; error_code: string }>
  reissue: (input: {
    ticketId: string
    idempotencyKeyHash: string
    requestFingerprint: string
    idempotencyTtlSeconds: number
  }) => Promise<
    | { ok: true; replay: boolean; response: Record<string, unknown> }
    | { ok: false; error_code: string }
  >
}

export type OrchestrateDeps = {
  env: (key: string) => string | undefined
  repo: TicketCredentialRepository
}

function requireOperator(req: Request, bearer: string | null): void {
  if (!bearer) throw new TicketCredentialError('CONFIGURATION_ERROR')
  const header = req.headers.get('authorization') ?? ''
  if (header !== `Bearer ${bearer}`) {
    throw new TicketCredentialError('UNAUTHORIZED')
  }
}

export async function orchestrateTicketCredentials(
  req: Request,
  deps: OrchestrateDeps,
): Promise<{ status: number; body: unknown }> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    throw new TicketCredentialError('METHOD_NOT_ALLOWED')
  }

  let config
  try {
    config = loadTicketCredentialRuntimeConfig(deps.env)
  } catch {
    throw new TicketCredentialError('CONFIGURATION_ERROR')
  }

  // Public ticket retrieval remains deferred (API-OD-010 / OD-017).
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    if (action === 'verify') {
      requireOperator(req, config.operatorBearer)
      const token = parseQrToken(url.searchParams.get('token'))
      const result = await deps.repo.verifyToken({ token })
      if (!result.ok) throw mapRpcError(result.error_code)
      return { status: 200, body: result.body }
    }
    if (action === 'projection') {
      requireOperator(req, config.operatorBearer)
      const ticketId = parseTicketId(url.searchParams.get('ticket_id'))
      const result = await deps.repo.getProjection({ ticketId })
      if (!result.ok) throw mapRpcError(result.error_code)
      return { status: 200, body: result.projection }
    }
    throw new TicketCredentialError('PUBLIC_TICKET_RETRIEVAL_DEFERRED')
  }

  // POST reissue (protected)
  requireOperator(req, config.operatorBearer)
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new TicketCredentialError('INVALID_REQUEST')
  }
  const parsed = parseReissueRequest(raw)
  const idempotencyKeyHash = await sha256Hex(parsed.idempotencyKey)
  const requestFingerprint = await sha256Hex(JSON.stringify({ ticket_id: parsed.ticketId }))
  const result = await deps.repo.reissue({
    ticketId: parsed.ticketId,
    idempotencyKeyHash,
    requestFingerprint,
    idempotencyTtlSeconds: config.idempotencyTtlSeconds,
  })
  if (!result.ok) throw mapRpcError(result.error_code)
  return {
    status: 200,
    body: {
      replay: result.replay,
      ...result.response,
    },
  }
}
