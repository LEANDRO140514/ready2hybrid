import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { loadTicketCredentialRuntimeConfig } from '../_shared/tickets/config'
import { TicketCredentialError } from '../_shared/tickets/errors'
import {
  orchestrateTicketCredentials,
  type TicketCredentialRepository,
} from '../_shared/tickets/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function baseHeaders(): Record<string, string> {
  const config = loadTicketCredentialRuntimeConfig(env)
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

function createLazyRepo(): TicketCredentialRepository {
  let client: ReturnType<typeof createAdminClient> | null = null

  function getClient() {
    if (client) return client
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) {
      throw new TicketCredentialError('CONFIGURATION_ERROR')
    }
    client = createAdminClient({ baseUrl, apiKey })
    return client
  }

  return {
    async verifyToken(input) {
      const admin = getClient()
      const { data, error } = await admin.database.rpc('ticket_credential_verify_tx', {
        p: { token: input.token },
      })
      if (error) throw new TicketCredentialError('SERVICE_UNAVAILABLE')
      const row = data as Record<string, unknown>
      if (!row?.ok) {
        return { ok: false as const, error_code: String(row?.error_code ?? 'INTERNAL_ERROR') }
      }
      return { ok: true as const, body: row }
    },
    async getProjection(input) {
      const admin = getClient()
      const { data, error } = await admin.database.rpc('ticket_get_projection_tx', {
        p: { ticket_id: input.ticketId },
      })
      if (error) throw new TicketCredentialError('SERVICE_UNAVAILABLE')
      const row = data as Record<string, unknown>
      if (!row?.ok) {
        return { ok: false as const, error_code: String(row?.error_code ?? 'INTERNAL_ERROR') }
      }
      return {
        ok: true as const,
        projection: (row.projection as Record<string, unknown>) ?? {},
      }
    },
    async reissue(input) {
      const admin = getClient()
      const { data, error } = await admin.database.rpc('ticket_credential_reissue_tx', {
        p: {
          ticket_id: input.ticketId,
          idempotency_key_hash: input.idempotencyKeyHash,
          request_fingerprint: input.requestFingerprint,
          idempotency_ttl_seconds: input.idempotencyTtlSeconds,
        },
      })
      if (error) throw new TicketCredentialError('SERVICE_UNAVAILABLE')
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
    const result = await orchestrateTicketCredentials(req, {
      env,
      repo: createLazyRepo(),
    })
    return jsonResponse(result.status, result.body)
  } catch (error) {
    if (error instanceof TicketCredentialError) {
      return jsonResponse(error.status, error.toPublicBody())
    }
    return jsonResponse(500, new TicketCredentialError('INTERNAL_ERROR').toPublicBody())
  }
}
