import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { ExpiryError } from '../_shared/expiry/errors'
import {
  orchestratePaymentPendingExpiry,
  type ExpiryLogEvent,
  type ExpiryRepository,
} from '../_shared/expiry/orchestrate'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function createLazyRepository(): ExpiryRepository {
  let client: ReturnType<typeof createAdminClient> | null = null

  function getClient() {
    if (client) return client
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) {
      throw new ExpiryError('INTERNAL_ERROR')
    }
    client = createAdminClient({ baseUrl, apiKey })
    return client
  }

  return {
    async acquireLease(input) {
      const { data, error } = await getClient().database.rpc(
        'acquire_payment_pending_expiry_run_lease_tx',
        {
          p: {
            run_id: input.runId,
            actor_ref: input.actorRef,
            ttl_seconds: input.ttlSeconds,
          },
        },
      )
      if (error || !data || typeof data !== 'object') {
        throw new ExpiryError('LEASE_ACQUIRE_FAILED')
      }
      return data as Awaited<ReturnType<ExpiryRepository['acquireLease']>>
    },

    async releaseLease(input) {
      const { data, error } = await getClient().database.rpc(
        'release_payment_pending_expiry_run_lease_tx',
        {
          p: {
            run_id: input.runId,
            actor_ref: input.actorRef,
          },
        },
      )
      if (error || !data || typeof data !== 'object') {
        throw new ExpiryError('LEASE_RELEASE_FAILED')
      }
      return data as Awaited<ReturnType<ExpiryRepository['releaseLease']>>
    },

    async runBatch(input) {
      const { data, error } = await getClient().database.rpc(
        'expire_payment_pending_batch_tx',
        {
          p: {
            limit: input.limit,
            run_id: input.runId,
            actor_ref: input.actorRef,
          },
        },
      )
      if (error || !data || typeof data !== 'object') {
        throw new ExpiryError('BATCH_RPC_FAILED')
      }
      return data as Awaited<ReturnType<ExpiryRepository['runBatch']>>
    },

    async dryRun(input) {
      const { data, error } = await getClient().database.rpc(
        'expire_payment_pending_dry_run_tx',
        {
          p: {
            correlation_id: input.runId,
          },
        },
      )
      if (error || !data || typeof data !== 'object') {
        throw new ExpiryError('DRY_RUN_RPC_FAILED')
      }
      return data as Awaited<ReturnType<ExpiryRepository['dryRun']>>
    },
  }
}

function log(event: ExpiryLogEvent, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }))
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const result = await orchestratePaymentPendingExpiry(req, {
      env,
      repo: createLazyRepository(),
      log,
    })
    return jsonResponse(result.status, result.body)
  } catch {
    const error = new ExpiryError('INTERNAL_ERROR')
    return jsonResponse(error.status, error.toPublicBody())
  }
}
