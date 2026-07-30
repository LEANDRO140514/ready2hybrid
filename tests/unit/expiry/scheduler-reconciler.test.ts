import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  ACTOR_REF,
  LEASE_TTL_SECONDS,
  RUN_BUDGET_MS,
} from '../../../insforge/functions/_shared/expiry/config'
import {
  orchestratePaymentPendingExpiry,
  type BatchResult,
  type ExpiryRepository,
} from '../../../insforge/functions/_shared/expiry/orchestrate'

const SECRET = 'schedule-secret-value'
const RUN_ID = '123e4567-e89b-42d3-a456-426614174000'
const OTHER_RUN_ID = '223e4567-e89b-42d3-a456-426614174001'
const NOW = new Date('2026-07-29T18:00:00.000Z')

function fakeRepository(overrides: Partial<ExpiryRepository> = {}): ExpiryRepository {
  return {
    acquireLease: vi.fn(async ({ runId }) => ({
      ok: true,
      outcome: 'acquired',
      run_id: runId,
      expires_at: '2026-07-29T18:01:30.000Z',
    })),
    releaseLease: vi.fn(async () => ({ ok: true, outcome: 'released' })),
    runBatch: vi.fn(async () => ({
      ok: true,
      processed: 0,
      counts: {},
      items: [],
    })),
    dryRun: vi.fn(async () => ({
      ok: true,
      applied: false,
      counts: { eligible: 0 },
      candidates: [],
      deferred: [],
    })),
    ...overrides,
  }
}

function envWithSecret(key: string): string | undefined {
  if (key === 'PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET') return SECRET
  if (key === 'INSFORGE_ENVIRONMENT') return 'sandbox'
  return undefined
}

function request(
  body: unknown = {},
  options: { method?: string; authorization?: string | null } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (options.authorization !== null) {
    headers.set(
      'Authorization',
      options.authorization ?? `Bearer ${SECRET}`,
    )
  }
  return new Request('https://expiry.test/functions/payment-pending-expiry', {
    method: options.method ?? 'POST',
    headers,
    body:
      (options.method ?? 'POST') === 'POST'
        ? JSON.stringify(body)
        : undefined,
  })
}

function deps(repo: ExpiryRepository, extra: Record<string, unknown> = {}) {
  return {
    env: envWithSecret,
    repo,
    monotonicNow: () => 0,
    wallNow: () => NOW,
    randomId: () => RUN_ID,
    ...extra,
  }
}

function bodyOf(result: { body: unknown }): Record<string, unknown> {
  return result.body as Record<string, unknown>
}

describe('IMPL-14A-3C scheduled expiry reconciler', () => {
  it('requires POST before configuration, authorization, or RPC access', async () => {
    const repo = fakeRepository()
    const result = await orchestratePaymentPendingExpiry(
      request(undefined, { method: 'GET', authorization: null }),
      { env: () => undefined, repo },
    )

    expect(result.status).toBe(405)
    expect(bodyOf(result)).toMatchObject({
      error: { code: 'METHOD_NOT_ALLOWED' },
    })
    expect(repo.acquireLease).not.toHaveBeenCalled()
  })

  it('fails closed when the dedicated schedule secret is absent', async () => {
    const result = await orchestratePaymentPendingExpiry(request({}), {
      env: () => undefined,
      repo: fakeRepository(),
    })

    expect(result.status).toBe(503)
    expect(bodyOf(result)).toMatchObject({
      error: { code: 'SCHEDULE_SECRET_NOT_CONFIGURED' },
    })
  })

  it('returns 401 when Authorization is absent', async () => {
    const result = await orchestratePaymentPendingExpiry(
      request({}, { authorization: null }),
      deps(fakeRepository()),
    )

    expect(result.status).toBe(401)
    expect(bodyOf(result)).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    })
  })

  it('returns 403 for an invalid bearer secret', async () => {
    const result = await orchestratePaymentPendingExpiry(
      request({}, { authorization: 'Bearer invalid' }),
      deps(fakeRepository()),
    )

    expect(result.status).toBe(403)
    expect(bodyOf(result)).toMatchObject({
      error: { code: 'FORBIDDEN' },
    })
  })

  it('rejects invalid JSON and unsupported body fields', async () => {
    const repo = fakeRepository()
    const malformed = new Request('https://expiry.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    })
    const invalidJson = await orchestratePaymentPendingExpiry(
      malformed,
      deps(repo),
    )
    const actorInjection = await orchestratePaymentPendingExpiry(
      request({ actor_ref: 'attacker', rpc: 'arbitrary' }),
      deps(repo),
    )

    expect(invalidJson.status).toBe(400)
    expect(actorInjection.status).toBe(400)
    expect(repo.acquireLease).not.toHaveBeenCalled()
  })

  it('applies reconcile defaults and fixes actor, lease TTL, and batch limit', async () => {
    const repo = fakeRepository()
    const result = await orchestratePaymentPendingExpiry(request({}), deps(repo))

    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'completed',
      run_id: RUN_ID,
      environment: 'sandbox',
      max_items: 25,
      lease_released: true,
    })
    expect(repo.acquireLease).toHaveBeenCalledWith({
      runId: RUN_ID,
      actorRef: ACTOR_REF,
      ttlSeconds: LEASE_TTL_SECONDS,
    })
    expect(repo.runBatch).toHaveBeenCalledWith({
      limit: 1,
      runId: RUN_ID,
      actorRef: ACTOR_REF,
    })
    expect(repo.releaseLease).toHaveBeenCalledWith({
      runId: RUN_ID,
      actorRef: ACTOR_REF,
    })
  })

  it('clamps max_items to the approved 1–50 range', async () => {
    const low = await orchestratePaymentPendingExpiry(
      request({ max_items: -10 }),
      deps(fakeRepository()),
    )
    const high = await orchestratePaymentPendingExpiry(
      request({ max_items: 500 }),
      deps(fakeRepository()),
    )

    expect(bodyOf(low).max_items).toBe(1)
    expect(bodyOf(high).max_items).toBe(50)
  })

  it('rejects non-integer max_items and invalid run ids or modes', async () => {
    for (const body of [
      { max_items: 1.5 },
      { run_id: 'not-a-uuid' },
      { mode: 'admin' },
    ]) {
      const result = await orchestratePaymentPendingExpiry(
        request(body),
        deps(fakeRepository()),
      )
      expect(result.status).toBe(400)
    }
  })

  it('returns overlap_skipped without batch or release calls', async () => {
    const repo = fakeRepository({
      acquireLease: vi.fn(async () => ({
        ok: true,
        outcome: 'overlap_skipped',
        owner_run_id: OTHER_RUN_ID,
        expires_at: '2026-07-29T18:01:30.000Z',
      })),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ run_id: RUN_ID }),
      deps(repo),
    )

    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'overlap_skipped',
      overlap_skipped: true,
      processed: 0,
      lease_released: false,
    })
    expect(repo.runBatch).not.toHaveBeenCalled()
    expect(repo.releaseLease).not.toHaveBeenCalled()
  })

  it('fails safely when lease acquisition fails', async () => {
    const repo = fakeRepository({
      acquireLease: vi.fn(async () => ({
        ok: false,
        outcome: 'invalid_input',
      })),
    })
    const result = await orchestratePaymentPendingExpiry(request({}), deps(repo))

    expect(result.status).toBe(503)
    expect(bodyOf(result)).toMatchObject({
      error: { code: 'LEASE_ACQUIRE_FAILED' },
    })
    expect(repo.runBatch).not.toHaveBeenCalled()
    expect(repo.releaseLease).not.toHaveBeenCalled()
  })

  it('stops when batch processed=0', async () => {
    const repo = fakeRepository()
    const result = await orchestratePaymentPendingExpiry(request({}), deps(repo))

    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'completed',
      processed: 0,
      budget_exhausted: false,
      lease_released: true,
    })
    expect(repo.runBatch).toHaveBeenCalledTimes(1)
  })

  it('uses at most 25 successive limit=1 batch calls by default', async () => {
    const repo = fakeRepository({
      runBatch: vi.fn(async () => ({
        ok: true,
        processed: 1,
        counts: { expired: 1 },
        items: [{ order_id: 'order', outcome: 'expired' }],
      })),
    })
    const result = await orchestratePaymentPendingExpiry(request({}), deps(repo))

    expect(repo.runBatch).toHaveBeenCalledTimes(25)
    expect(
      vi.mocked(repo.runBatch).mock.calls.every(
        ([input]) => input.limit === 1,
      ),
    ).toBe(true)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      max_items: 25,
      processed: 25,
      expired: 25,
    })
  })

  it('stops at an explicit max_items and accumulates sanitized counts', async () => {
    const batches: BatchResult[] = [
      {
        ok: true,
        processed: 1,
        counts: { expired: 1 },
        items: [{ order_id: 'one', outcome: 'expired' }],
      },
      {
        ok: true,
        processed: 1,
        counts: { inconsistent: 1 },
        items: [
          {
            order_id: 'two',
            outcome: 'inconsistent',
            findings: ['HOLD_MISSING'],
          },
        ],
      },
    ]
    const repo = fakeRepository({
      runBatch: vi.fn(async () => batches.shift() ?? { processed: 0 }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 2 }),
      deps(repo),
    )

    expect(repo.runBatch).toHaveBeenCalledTimes(2)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      processed: 2,
      expired: 1,
      inconsistent: 1,
      noop: 0,
      errors: 0,
    })
  })

  it('stops before a new batch when the 20-second monotonic budget is exhausted', async () => {
    let clock = 0
    const repo = fakeRepository({
      runBatch: vi.fn(async () => {
        clock = RUN_BUDGET_MS
        return {
          ok: true,
          processed: 1,
          counts: { noop: 1 },
          items: [{ order_id: 'one', outcome: 'noop' }],
        }
      }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 2 }),
      deps(repo, { monotonicNow: () => clock }),
    )

    expect(RUN_BUDGET_MS).toBe(20_000)
    expect(repo.runBatch).toHaveBeenCalledTimes(1)
    expect(repo.releaseLease).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      processed: 1,
      noop: 1,
      budget_exhausted: true,
      lease_released: true,
    })
  })

  it('allows the next batch while elapsed time is below the deadline', async () => {
    let clock = 0
    const repo = fakeRepository({
      acquireLease: vi.fn(async ({ runId }) => {
        clock = RUN_BUDGET_MS - 1
        return {
          ok: true,
          outcome: 'acquired',
          run_id: runId,
          expires_at: '2026-07-29T18:01:30.000Z',
        }
      }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 5 }),
      deps(repo, { monotonicNow: () => clock }),
    )

    expect(repo.runBatch).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'completed',
      processed: 0,
      budget_exhausted: false,
      lease_released: true,
    })
  })

  it('counts lease acquisition time and skips the first batch at the exact deadline', async () => {
    let clock = 0
    const repo = fakeRepository({
      acquireLease: vi.fn(async ({ runId }) => {
        clock = RUN_BUDGET_MS
        return {
          ok: true,
          outcome: 'acquired',
          run_id: runId,
          expires_at: '2026-07-29T18:01:30.000Z',
        }
      }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 5 }),
      deps(repo, { monotonicNow: () => clock }),
    )

    expect(repo.runBatch).not.toHaveBeenCalled()
    expect(repo.releaseLease).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      processed: 0,
      expired: 0,
      errors: 0,
      budget_exhausted: true,
      lease_released: true,
    })
  })

  it('skips the first batch when the deadline is already exceeded before it starts', async () => {
    let clock = 0
    const repo = fakeRepository({
      acquireLease: vi.fn(async ({ runId }) => {
        clock = RUN_BUDGET_MS + 1
        return {
          ok: true,
          outcome: 'acquired',
          run_id: runId,
          expires_at: '2026-07-29T18:01:30.000Z',
        }
      }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 25 }),
      deps(repo, { monotonicNow: () => clock }),
    )

    expect(repo.runBatch).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      processed: 0,
      budget_exhausted: true,
      lease_released: true,
    })
  })

  it('preserves committed counters when the deadline stops the run mid-way', async () => {
    let clock = 0
    const repo = fakeRepository({
      runBatch: vi.fn(async () => {
        clock += RUN_BUDGET_MS / 2
        return {
          ok: true,
          processed: 1,
          counts: { expired: 1 },
          items: [{ order_id: 'one', outcome: 'expired' }],
        }
      }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 25 }),
      deps(repo, { monotonicNow: () => clock }),
    )

    expect(repo.runBatch).toHaveBeenCalledTimes(2)
    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      processed: 2,
      expired: 2,
      inconsistent: 0,
      noop: 0,
      errors: 0,
      budget_exhausted: true,
      lease_released: true,
    })
  })

  it('stops the run after an item error and leaves retry to the next fire', async () => {
    const repo = fakeRepository({
      runBatch: vi.fn(async () => ({
        ok: true,
        processed: 1,
        counts: { error: 1 },
        items: [{ order_id: 'one', outcome: 'error' }],
      })),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ max_items: 25 }),
      deps(repo),
    )

    expect(repo.runBatch).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(503)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      processed: 1,
      errors: 1,
      error_code: 'BATCH_RPC_FAILED',
      lease_released: true,
    })
  })

  it('releases the lease in finally after a thrown batch failure', async () => {
    const repo = fakeRepository({
      runBatch: vi.fn(async () => {
        throw new Error('backend detail must not escape')
      }),
    })
    const result = await orchestratePaymentPendingExpiry(request({}), deps(repo))

    expect(repo.releaseLease).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(503)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      errors: 1,
      error_code: 'BATCH_RPC_FAILED',
      lease_released: true,
    })
    expect(JSON.stringify(result.body)).not.toContain('backend detail')
  })

  it('makes release failure observable without retrying indefinitely', async () => {
    const repo = fakeRepository({
      releaseLease: vi.fn(async () => ({
        ok: true,
        outcome: 'not_owner',
      })),
    })
    const result = await orchestratePaymentPendingExpiry(request({}), deps(repo))

    expect(repo.releaseLease).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(503)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'partial',
      errors: 1,
      error_code: 'LEASE_RELEASE_FAILED',
      lease_released: false,
    })
  })

  it('never acquires a lease or calls batch in dry_run mode', async () => {
    const repo = fakeRepository({
      dryRun: vi.fn(async () => ({
        ok: true,
        applied: false,
        counts: { eligible: 2 },
        candidates: [
          { order_id: 'one', would_be: 'eligible', findings: [] },
          { order_id: 'two', would_be: 'eligible', findings: [] },
        ],
        deferred: [],
      })),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ mode: 'dry_run', max_items: 1 }),
      deps(repo),
    )

    expect(result.status).toBe(200)
    expect(bodyOf(result)).toMatchObject({
      outcome: 'completed',
      mode: 'dry_run',
      applied: false,
      max_items: 1,
    })
    expect(
      (bodyOf(result).candidates as unknown[]).length,
    ).toBe(1)
    expect(repo.dryRun).toHaveBeenCalledWith({ runId: RUN_ID })
    expect(repo.acquireLease).not.toHaveBeenCalled()
    expect(repo.runBatch).not.toHaveBeenCalled()
    expect(repo.releaseLease).not.toHaveBeenCalled()
  })

  it('sanitizes dry-run RPC failures', async () => {
    const repo = fakeRepository({
      dryRun: vi.fn(async () => {
        throw new Error('raw row or backend message')
      }),
    })
    const result = await orchestratePaymentPendingExpiry(
      request({ mode: 'dry_run' }),
      deps(repo),
    )

    expect(result.status).toBe(503)
    expect(bodyOf(result)).toMatchObject({
      error: { code: 'DRY_RUN_RPC_FAILED' },
    })
    expect(JSON.stringify(result.body)).not.toContain('raw row')
  })

  it('logs only sanitized fields and never logs the schedule secret', async () => {
    const entries: unknown[] = []
    await orchestratePaymentPendingExpiry(
      request({}),
      deps(fakeRepository(), {
        log: (event: string, fields: Record<string, unknown>) => {
          entries.push({ event, ...fields })
        },
      }),
    )

    const serialized = JSON.stringify(entries)
    expect(serialized).not.toContain(SECRET)
    expect(serialized).toContain('expiry_run_started')
    expect(serialized).toContain('expiry_run_completed')
  })

  it('keeps the Edge RPC allowlist fixed and excludes protected modules', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'insforge/functions/payment-pending-expiry/index.ts',
      ),
      'utf8',
    )
    const rpcNames = [
      ...source.matchAll(/database\.rpc\(\s*'([^']+)'/g),
    ].map((match) => match[1])

    expect(rpcNames).toEqual([
      'acquire_payment_pending_expiry_run_lease_tx',
      'release_payment_pending_expiry_run_lease_tx',
      'expire_payment_pending_batch_tx',
      'expire_payment_pending_dry_run_tx',
    ])
    expect(source).not.toMatch(/mercadopago|mp-webhook|ticket-credentials|team-roster/i)
    expect(source).not.toContain('expire_payment_pending_aggregate_tx')
  })
})
