import { loadTeamRosterRuntimeConfig } from './config'
import { mapRpcError, TeamRosterError } from './errors'
import { sha256Hex } from './hash'
import { parseAcceptInvitationRequest, parseInvitationToken } from './validate'

export type TeamRosterProjection = {
  status: string
  product_name: string
  required_members: number
  completed_members: number
  remaining_members: number
  accepting_members: boolean
  waiver?: { document_type: string; version: string } | null
}

export type TeamRosterRepository = {
  getByTokenHash: (input: {
    tokenHash: string
    waiverDocumentType: string | null
    waiverDocumentVersion: string | null
  }) => Promise<
    | { ok: true; projection: TeamRosterProjection }
    | { ok: false; error_code: string }
  >
  acceptInvitation: (input: {
    tokenHash: string
    idempotencyKeyHash: string
    requestFingerprint: string
    idempotencyTtlSeconds: number
    participantPublicRef: string | null
    waiverDocumentType: string
    waiverDocumentVersion: string
    waiverAccepted: boolean
  }) => Promise<
    | { ok: true; replay: boolean; response: Record<string, unknown> }
    | { ok: false; error_code: string }
  >
}

export type OrchestrateDeps = {
  env: (key: string) => string | undefined
  repo: TeamRosterRepository
}

async function fingerprintAccept(body: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(body))
}

export async function orchestrateTeamRoster(
  req: Request,
  deps: OrchestrateDeps,
): Promise<{ status: number; body: unknown }> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    throw new TeamRosterError('METHOD_NOT_ALLOWED')
  }

  const config = loadTeamRosterRuntimeConfig(deps.env)

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const token = parseInvitationToken(url.searchParams.get('token'))
    const tokenHash = await sha256Hex(token)
    const result = await deps.repo.getByTokenHash({
      tokenHash,
      waiverDocumentType: config.waiverRequiredDocumentType,
      waiverDocumentVersion: config.waiverRequiredVersion,
    })
    if (!result.ok) throw mapRpcError(result.error_code)
    return { status: 200, body: result.projection }
  }

  // POST accept
  if (!config.waiverRequiredDocumentType || !config.waiverRequiredVersion) {
    throw new TeamRosterError('WAIVER_CONFIGURATION_REQUIRED')
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new TeamRosterError('INVALID_REQUEST')
  }

  const parsed = parseAcceptInvitationRequest(raw)
  if (
    parsed.waiver.document_type !== config.waiverRequiredDocumentType ||
    parsed.waiver.version !== config.waiverRequiredVersion
  ) {
    throw new TeamRosterError('WAIVER_REQUIRED')
  }

  const token = parseInvitationToken(parsed.token)
  const tokenHash = await sha256Hex(token)
  const idempotencyKeyHash = await sha256Hex(parsed.idempotency_key)
  const requestFingerprint = await fingerprintAccept({
    token,
    participant: parsed.participant ?? null,
    waiver: parsed.waiver,
  })

  const result = await deps.repo.acceptInvitation({
    tokenHash,
    idempotencyKeyHash,
    requestFingerprint,
    idempotencyTtlSeconds: config.idempotencyTtlSeconds,
    participantPublicRef: parsed.participant?.public_ref ?? null,
    waiverDocumentType: config.waiverRequiredDocumentType,
    waiverDocumentVersion: config.waiverRequiredVersion,
    waiverAccepted: true,
  })

  if (!result.ok) throw mapRpcError(result.error_code)
  return { status: 200, body: result.response }
}
