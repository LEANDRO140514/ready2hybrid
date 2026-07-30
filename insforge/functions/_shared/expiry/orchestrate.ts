import {
  ABSOLUTE_MAX_ITEMS,
  ACTOR_REF,
  DEFAULT_MAX_ITEMS,
  LEASE_TTL_SECONDS,
  RUN_BUDGET_MS,
} from './config'
import { ExpiryError } from './errors'

export type ExpiryMode = 'reconcile' | 'dry_run'

export type LeaseAcquireResult =
  | { ok: true; outcome: 'acquired'; run_id: string; expires_at: string }
  | {
      ok: true
      outcome: 'overlap_skipped'
      owner_run_id: string
      expires_at: string
    }
  | { ok: false; outcome: string; error_code?: string }

export type LeaseReleaseResult = {
  ok: boolean
  outcome: 'released' | 'not_owner' | 'already_expired' | 'not_found' | 'invalid_input' | string
}

export type BatchItem = {
  order_id?: string
  outcome?: string
  reason?: string | null
  findings?: unknown
}

export type BatchResult = {
  ok?: boolean
  processed?: number
  counts?: {
    expired?: number
    noop?: number
    inconsistent?: number
    skipped_locked?: number
    order_not_found?: number
    error?: number
  }
  items?: BatchItem[]
}

export type DryRunResult = {
  ok?: boolean
  applied?: boolean
  counts?: Record<string, unknown>
  candidates?: unknown[]
  deferred?: unknown[]
}

export type ExpiryRepository = {
  acquireLease: (input: {
    runId: string
    actorRef: typeof ACTOR_REF
    ttlSeconds: typeof LEASE_TTL_SECONDS
  }) => Promise<LeaseAcquireResult>
  releaseLease: (input: {
    runId: string
    actorRef: typeof ACTOR_REF
  }) => Promise<LeaseReleaseResult>
  runBatch: (input: {
    limit: 1
    runId: string
    actorRef: typeof ACTOR_REF
  }) => Promise<BatchResult>
  dryRun: (input: { runId: string }) => Promise<DryRunResult>
}

export type ExpiryLogEvent =
  | 'expiry_run_started'
  | 'expiry_run_overlap_skipped'
  | 'expiry_item_result'
  | 'expiry_run_partial'
  | 'expiry_run_completed'
  | 'expiry_lease_release_failed'

export type ExpiryLogSink = (
  event: ExpiryLogEvent,
  fields: Record<string, unknown>,
) => void

export type ExpiryOrchestratorDeps = {
  env: (key: string) => string | undefined
  repo: ExpiryRepository
  monotonicNow?: () => number
  wallNow?: () => Date
  randomId?: () => string
  log?: ExpiryLogSink
}

type ParsedRequest = {
  mode: ExpiryMode
  runId: string
  maxItems: number
}

type ReconcileSummary = {
  ok: true
  outcome: 'completed' | 'partial'
  run_id: string
  environment: 'sandbox' | 'main' | 'unknown'
  started_at: string
  finished_at: string
  duration_ms: number
  max_items: number
  processed: number
  expired: number
  inconsistent: number
  noop: number
  errors: number
  overlap_skipped: false
  budget_exhausted: boolean
  lease_released: boolean
  error_code?: 'BATCH_RPC_FAILED' | 'LEASE_RELEASE_FAILED'
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safeLog(
  log: ExpiryLogSink | undefined,
  event: ExpiryLogEvent,
  fields: Record<string, unknown>,
): void {
  try {
    log?.(event, fields)
  } catch {
    // Observability must not break reconciliation or lease release.
  }
}

function secretsEqual(expected: string, actual: string): boolean {
  let difference = expected.length ^ actual.length
  const length = Math.max(expected.length, actual.length)
  for (let index = 0; index < length; index += 1) {
    difference |=
      (expected.charCodeAt(index) || 0) ^ (actual.charCodeAt(index) || 0)
  }
  return difference === 0
}

function authorizeSchedule(req: Request, env: ExpiryOrchestratorDeps['env']): void {
  const secret = env('PAYMENT_PENDING_EXPIRY_SCHEDULE_SECRET')?.trim()
  if (!secret) throw new ExpiryError('SCHEDULE_SECRET_NOT_CONFIGURED')

  const header = req.headers.get('Authorization')
  if (!header) throw new ExpiryError('UNAUTHORIZED')

  const match = /^Bearer (.+)$/.exec(header)
  if (!match || !secretsEqual(secret, match[1])) {
    throw new ExpiryError('FORBIDDEN')
  }
}

function parseEnvironment(
  env: ExpiryOrchestratorDeps['env'],
): 'sandbox' | 'main' | 'unknown' {
  const value = env('INSFORGE_ENVIRONMENT')?.trim().toLowerCase()
  if (value === 'sandbox' || value === 'main') return value
  return 'unknown'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function parseBody(
  raw: unknown,
  randomId: () => string,
): ParsedRequest {
  if (!isRecord(raw)) throw new ExpiryError('INVALID_REQUEST')

  const allowed = new Set(['mode', 'run_id', 'max_items'])
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    throw new ExpiryError('INVALID_REQUEST')
  }

  const mode = raw.mode ?? 'reconcile'
  if (mode !== 'reconcile' && mode !== 'dry_run') {
    throw new ExpiryError('INVALID_REQUEST')
  }

  const runId = raw.run_id ?? randomId()
  if (typeof runId !== 'string' || !UUID_PATTERN.test(runId)) {
    throw new ExpiryError('INVALID_REQUEST')
  }

  const requested = raw.max_items ?? DEFAULT_MAX_ITEMS
  if (typeof requested !== 'number' || !Number.isInteger(requested)) {
    throw new ExpiryError('INVALID_REQUEST')
  }
  const maxItems = Math.min(
    Math.max(requested, 1),
    ABSOLUTE_MAX_ITEMS,
  )

  return { mode, runId, maxItems }
}

function integer(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0
}

function sanitizeFindingCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, 25)
}

function sanitizeDryRunRows(rows: unknown, limit: number): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit).map((item) => {
    if (!isRecord(item)) return {}
    return {
      order_id: typeof item.order_id === 'string' ? item.order_id : undefined,
      hold_id: typeof item.hold_id === 'string' ? item.hold_id : undefined,
      order_state:
        typeof item.order_state === 'string' ? item.order_state : undefined,
      would_be: typeof item.would_be === 'string' ? item.would_be : undefined,
      classification:
        typeof item.classification === 'string'
          ? item.classification
          : undefined,
      action: typeof item.action === 'string' ? item.action : undefined,
      findings: sanitizeFindingCodes(item.findings),
    }
  })
}

function sanitizeDryRunCounts(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  return {
    eligible: integer(value.eligible),
    noop: integer(value.noop),
    inconsistent: integer(value.inconsistent),
    deferred_preference_pending_holds: integer(
      value.deferred_preference_pending_holds,
    ),
  }
}

export async function orchestratePaymentPendingExpiry(
  req: Request,
  deps: ExpiryOrchestratorDeps,
): Promise<{ status: number; body: unknown }> {
  if (req.method !== 'POST') {
    const error = new ExpiryError('METHOD_NOT_ALLOWED')
    return { status: error.status, body: error.toPublicBody() }
  }

  try {
    authorizeSchedule(req, deps.env)
  } catch (error) {
    if (error instanceof ExpiryError) {
      return { status: error.status, body: error.toPublicBody() }
    }
    const fallback = new ExpiryError('INTERNAL_ERROR')
    return { status: fallback.status, body: fallback.toPublicBody() }
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    const error = new ExpiryError('INVALID_REQUEST')
    return { status: error.status, body: error.toPublicBody() }
  }

  const monotonicNow = deps.monotonicNow ?? (() => performance.now())
  const wallNow = deps.wallNow ?? (() => new Date())
  const randomId = deps.randomId ?? (() => crypto.randomUUID())

  let parsed: ParsedRequest
  try {
    parsed = parseBody(raw, randomId)
  } catch (error) {
    if (error instanceof ExpiryError) {
      return { status: error.status, body: error.toPublicBody() }
    }
    const fallback = new ExpiryError('INTERNAL_ERROR')
    return { status: fallback.status, body: fallback.toPublicBody() }
  }

  const environment = parseEnvironment(deps.env)
  const startedAt = wallNow().toISOString()
  const startedMs = monotonicNow()

  safeLog(deps.log, 'expiry_run_started', {
    run_id: parsed.runId,
    mode: parsed.mode,
    max_items: parsed.maxItems,
    environment,
  })

  if (parsed.mode === 'dry_run') {
    try {
      const result = await deps.repo.dryRun({ runId: parsed.runId })
      if (result.ok === false || result.applied !== false) {
        throw new ExpiryError('DRY_RUN_RPC_FAILED')
      }
      const finishedAt = wallNow().toISOString()
      const durationMs = Math.max(0, monotonicNow() - startedMs)
      const candidates = sanitizeDryRunRows(
        result.candidates,
        parsed.maxItems,
      )
      const deferred = sanitizeDryRunRows(
        result.deferred,
        Math.max(0, parsed.maxItems - candidates.length),
      )
      const body = {
        ok: true,
        outcome: 'completed',
        mode: 'dry_run',
        applied: false,
        run_id: parsed.runId,
        environment,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        max_items: parsed.maxItems,
        counts: sanitizeDryRunCounts(result.counts),
        candidates,
        deferred,
      }
      safeLog(deps.log, 'expiry_run_completed', {
        run_id: parsed.runId,
        mode: parsed.mode,
        duration_ms: durationMs,
        applied: false,
      })
      return { status: 200, body }
    } catch {
      const error = new ExpiryError('DRY_RUN_RPC_FAILED')
      safeLog(deps.log, 'expiry_run_partial', {
        run_id: parsed.runId,
        mode: parsed.mode,
        error_code: error.code,
      })
      return { status: error.status, body: error.toPublicBody() }
    }
  }

  let lease: LeaseAcquireResult
  try {
    lease = await deps.repo.acquireLease({
      runId: parsed.runId,
      actorRef: ACTOR_REF,
      ttlSeconds: LEASE_TTL_SECONDS,
    })
  } catch {
    lease = { ok: false, outcome: 'error' }
  }

  if (!lease.ok) {
    const error = new ExpiryError('LEASE_ACQUIRE_FAILED')
    safeLog(deps.log, 'expiry_run_partial', {
      run_id: parsed.runId,
      mode: parsed.mode,
      error_code: error.code,
    })
    return { status: error.status, body: error.toPublicBody() }
  }

  if (lease.outcome === 'overlap_skipped') {
    const finishedAt = wallNow().toISOString()
    const durationMs = Math.max(0, monotonicNow() - startedMs)
    safeLog(deps.log, 'expiry_run_overlap_skipped', {
      run_id: parsed.runId,
      duration_ms: durationMs,
      environment,
    })
    return {
      status: 200,
      body: {
        ok: true,
        outcome: 'overlap_skipped',
        run_id: parsed.runId,
        environment,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        max_items: parsed.maxItems,
        processed: 0,
        expired: 0,
        inconsistent: 0,
        noop: 0,
        errors: 0,
        overlap_skipped: true,
        budget_exhausted: false,
        lease_released: false,
      },
    }
  }

  if (lease.outcome !== 'acquired') {
    const error = new ExpiryError('LEASE_ACQUIRE_FAILED')
    return { status: error.status, body: error.toPublicBody() }
  }

  const summary: ReconcileSummary = {
    ok: true,
    outcome: 'completed',
    run_id: parsed.runId,
    environment,
    started_at: startedAt,
    finished_at: startedAt,
    duration_ms: 0,
    max_items: parsed.maxItems,
    processed: 0,
    expired: 0,
    inconsistent: 0,
    noop: 0,
    errors: 0,
    overlap_skipped: false,
    budget_exhausted: false,
    lease_released: false,
  }

  try {
    while (summary.processed < parsed.maxItems) {
      // Measured from startedMs so lease acquisition and pre-batch work also
      // consume the budget; the gateway cuts the response near 30s.
      if (monotonicNow() - startedMs >= RUN_BUDGET_MS) {
        summary.outcome = 'partial'
        summary.budget_exhausted = true
        break
      }

      let batch: BatchResult
      try {
        batch = await deps.repo.runBatch({
          limit: 1,
          runId: parsed.runId,
          actorRef: ACTOR_REF,
        })
      } catch {
        summary.errors += 1
        summary.outcome = 'partial'
        summary.error_code = 'BATCH_RPC_FAILED'
        break
      }

      if (batch.ok === false) {
        summary.errors += 1
        summary.outcome = 'partial'
        summary.error_code = 'BATCH_RPC_FAILED'
        break
      }

      const processed = integer(batch.processed)
      if (processed > 1) {
        summary.errors += 1
        summary.outcome = 'partial'
        summary.error_code = 'BATCH_RPC_FAILED'
        break
      }
      const expired = integer(batch.counts?.expired)
      const inconsistent = integer(batch.counts?.inconsistent)
      const noop =
        integer(batch.counts?.noop) +
        integer(batch.counts?.skipped_locked) +
        integer(batch.counts?.order_not_found)
      const errors = integer(batch.counts?.error)

      summary.processed += processed
      summary.expired += expired
      summary.inconsistent += inconsistent
      summary.noop += noop
      summary.errors += errors

      for (const item of Array.isArray(batch.items) ? batch.items : []) {
        safeLog(deps.log, 'expiry_item_result', {
          run_id: parsed.runId,
          order_id:
            typeof item.order_id === 'string' ? item.order_id : undefined,
          outcome:
            typeof item.outcome === 'string' ? item.outcome : 'unknown',
          reason: typeof item.reason === 'string' ? item.reason : undefined,
          findings: sanitizeFindingCodes(item.findings),
        })
      }

      const itemError =
        errors > 0 ||
        (Array.isArray(batch.items) &&
          batch.items.some((item) => item.outcome === 'error'))
      if (itemError) {
        if (errors === 0) summary.errors += 1
        summary.outcome = 'partial'
        summary.error_code = 'BATCH_RPC_FAILED'
        break
      }

      if (monotonicNow() - startedMs >= RUN_BUDGET_MS) {
        summary.outcome = 'partial'
        summary.budget_exhausted = true
        break
      }

      if (processed === 0) {
        summary.outcome = 'completed'
        break
      }

      if (summary.processed >= parsed.maxItems) {
        summary.outcome = 'partial'
        break
      }
    }
  } finally {
    try {
      const released = await deps.repo.releaseLease({
        runId: parsed.runId,
        actorRef: ACTOR_REF,
      })
      summary.lease_released =
        released.ok === true && released.outcome === 'released'
      if (!summary.lease_released) {
        summary.errors += 1
        summary.outcome = 'partial'
        summary.error_code = 'LEASE_RELEASE_FAILED'
        safeLog(deps.log, 'expiry_lease_release_failed', {
          run_id: parsed.runId,
          outcome: released.outcome,
        })
      }
    } catch {
      summary.errors += 1
      summary.outcome = 'partial'
      summary.error_code = 'LEASE_RELEASE_FAILED'
      safeLog(deps.log, 'expiry_lease_release_failed', {
        run_id: parsed.runId,
        outcome: 'error',
      })
    }
  }

  summary.finished_at = wallNow().toISOString()
  summary.duration_ms = Math.max(0, monotonicNow() - startedMs)

  safeLog(
    deps.log,
    summary.outcome === 'completed'
      ? 'expiry_run_completed'
      : 'expiry_run_partial',
    {
      run_id: summary.run_id,
      outcome: summary.outcome,
      duration_ms: summary.duration_ms,
      processed: summary.processed,
      expired: summary.expired,
      inconsistent: summary.inconsistent,
      noop: summary.noop,
      errors: summary.errors,
      budget_exhausted: summary.budget_exhausted,
      lease_released: summary.lease_released,
      environment,
    },
  )

  return {
    status: summary.error_code === undefined ? 200 : 503,
    body: summary,
  }
}
