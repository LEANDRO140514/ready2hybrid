import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { loadTeamRosterRuntimeConfig } from '../_shared/teams/config'
import { TeamRosterError } from '../_shared/teams/errors'
import { orchestrateTeamRoster, type TeamRosterRepository } from '../_shared/teams/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function baseHeaders(): Record<string, string> {
  const config = loadTeamRosterRuntimeConfig(env)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
  }
  if (config.corsOrigin) {
    headers['Access-Control-Allow-Origin'] = config.corsOrigin
    headers['Vary'] = 'Origin'
  }
  return headers
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders() })
}

function createLazyRepo(): TeamRosterRepository {
  let client: ReturnType<typeof createAdminClient> | null = null

  function getClient() {
    if (client) return client
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) {
      throw new TeamRosterError('CONFIGURATION_ERROR')
    }
    client = createAdminClient({ baseUrl, apiKey })
    return client
  }

  return {
    async getByTokenHash(input) {
      const admin = getClient()
      const { data, error } = await admin.database.rpc('team_roster_get_tx', {
        p: {
          token_hash: input.tokenHash,
          waiver_document_type: input.waiverDocumentType,
          waiver_document_version: input.waiverDocumentVersion,
        },
      })
      if (error) throw new TeamRosterError('SERVICE_UNAVAILABLE')
      const row = data as Record<string, unknown>
      if (!row?.ok) {
        return { ok: false as const, error_code: String(row?.error_code ?? 'INTERNAL_ERROR') }
      }
      return {
        ok: true as const,
        projection: row.projection as never,
      }
    },
    async acceptInvitation(input) {
      const admin = getClient()
      const { data, error } = await admin.database.rpc('team_roster_accept_tx', {
        p: {
          token_hash: input.tokenHash,
          idempotency_key_hash: input.idempotencyKeyHash,
          request_fingerprint: input.requestFingerprint,
          idempotency_ttl_seconds: input.idempotencyTtlSeconds,
          participant_public_ref: input.participantPublicRef,
          waiver_document_type: input.waiverDocumentType,
          waiver_document_version: input.waiverDocumentVersion,
          waiver_accepted: input.waiverAccepted,
        },
      })
      if (error) throw new TeamRosterError('SERVICE_UNAVAILABLE')
      const row = data as Record<string, unknown>
      if (!row?.ok) {
        return { ok: false as const, error_code: String(row?.error_code ?? 'INTERNAL_ERROR') }
      }
      if (row.replay) {
        return {
          ok: true as const,
          replay: true,
          response: (row.prior_response as Record<string, unknown>) ?? {},
        }
      }
      return {
        ok: true as const,
        replay: false,
        response: (row.response as Record<string, unknown>) ?? {},
      }
    },
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders() })
  }

  try {
    const result = await orchestrateTeamRoster(req, {
      env,
      repo: createLazyRepo(),
    })
    return jsonResponse(result.status, result.body)
  } catch (error) {
    if (error instanceof TeamRosterError) {
      return jsonResponse(error.status, error.toPublicBody())
    }
    return jsonResponse(500, new TeamRosterError('INTERNAL_ERROR').toPublicBody())
  }
}
