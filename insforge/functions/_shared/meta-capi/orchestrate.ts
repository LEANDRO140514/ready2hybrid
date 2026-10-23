import { buildPurchaseEvent, type ActionSource, type PurchaseContext } from './event'
import { classifyResponse, MAX_ATTEMPTS, nextAttemptAt } from './policy'

export type DeliveryMode = 'test' | 'live'

export type ClaimedRow = {
  id: string
  orderId: string
  eventId: string
  attempts: number
  approvedAt: string | null
}

export type CapiRepo = {
  enqueue: (input: { since: string; mode: DeliveryMode }) => Promise<number>
  claim: (input: { limit: number; mode: DeliveryMode }) => Promise<ClaimedRow[]>
  loadContexts: (orderIds: string[]) => Promise<Map<string, Omit<PurchaseContext, 'approvedAt'>>>
  markSent: (id: string, fbtraceId: string | null) => Promise<void>
  markRetry: (id: string, nextAttempt: Date, error: string) => Promise<void>
  markFailed: (id: string, error: string) => Promise<void>
  markSkipped: (id: string, reason: string) => Promise<void>
}

export type CapiDeps = {
  env: (key: string) => string | undefined
  repo: CapiRepo
  fetch: typeof fetch
  now: () => Date
  log?: (event: string, fields: Record<string, unknown>) => void
}

export type CapiResult = { status: number; body: Record<string, unknown> }

const BATCH_LIMIT = 25
const RUN_BUDGET_MS = 20_000
const MAX_ERROR_LENGTH = 300
const DEFAULT_SOURCE_URL = 'https://hybrid-experience.enforma.mx/'
const DEFAULT_GRAPH_VERSION = 'v23.0'

function secretsEqual(expected: string, actual: string): boolean {
  let difference = expected.length ^ actual.length
  const length = Math.max(expected.length, actual.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (expected.charCodeAt(index) || 0) ^ (actual.charCodeAt(index) || 0)
  }
  return difference === 0
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

/** Meta error text with the token, emails and long digit runs removed, cut to the column limit. */
function sanitizeError(status: number, message: string, token: string): string {
  let text = message
  if (token) text = text.split(token).join('[redacted]')
  text = text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted]').replace(/\d{9,}/g, '[redacted]')
  return `HTTP ${status}: ${text}`.slice(0, MAX_ERROR_LENGTH)
}

function authorize(req: Request, env: CapiDeps['env']): CapiResult | null {
  const secret = clean(env('META_CAPI_SCHEDULE_SECRET'))
  if (!secret) return { status: 503, body: { status: 'error', code: 'SCHEDULE_SECRET_NOT_CONFIGURED' } }
  const header = req.headers.get('Authorization')
  if (!header) return { status: 401, body: { status: 'error', code: 'UNAUTHORIZED' } }
  const match = /^Bearer (.+)$/.exec(header)
  if (!match || !secretsEqual(secret, match[1])) {
    return { status: 403, body: { status: 'error', code: 'FORBIDDEN' } }
  }
  return null
}

export async function runMetaCapiSync(req: Request, deps: CapiDeps): Promise<CapiResult> {
  const { env, repo, now, log } = deps
  const denied = authorize(req, env)
  if (denied) return denied

  if (clean(env('META_CAPI_ENABLED')).toLowerCase() !== 'true') {
    return { status: 200, body: { status: 'disabled' } }
  }

  const datasetId = clean(env('META_CAPI_DATASET_ID'))
  const token = clean(env('META_CAPI_ACCESS_TOKEN'))
  const sinceMs = Date.parse(clean(env('META_CAPI_SINCE')))
  const missing: string[] = []
  if (!/^\d{5,20}$/.test(datasetId)) missing.push('META_CAPI_DATASET_ID')
  if (!token) missing.push('META_CAPI_ACCESS_TOKEN')
  if (!Number.isFinite(sinceMs)) missing.push('META_CAPI_SINCE')
  if (missing.length > 0) return { status: 503, body: { status: 'not_configured', missing } }

  const graphVersion = /^v\d+\.\d+$/.test(clean(env('META_GRAPH_VERSION')))
    ? clean(env('META_GRAPH_VERSION'))
    : DEFAULT_GRAPH_VERSION
  const testEventCode = clean(env('META_CAPI_TEST_EVENT_CODE'))
  const mode: DeliveryMode = testEventCode ? 'test' : 'live'
  const configuredSource = clean(env('META_CAPI_ACTION_SOURCE'))
  const actionSource: ActionSource =
    configuredSource === 'website' || configuredSource === 'other' ? configuredSource : 'system_generated'
  const eventSourceUrl = clean(env('META_CAPI_EVENT_SOURCE_URL')) || DEFAULT_SOURCE_URL
  // Off unless exactly "true": no email or phone leaves for Meta by default.
  const includeContactData = clean(env('META_CAPI_SEND_CONTACT_DATA')).toLowerCase() === 'true'
  const endpoint = `https://graph.facebook.com/${graphVersion}/${datasetId}/events`

  const startedAt = now().getTime()
  const counts = { sent: 0, retry: 0, failed: 0, skipped: 0 }
  log?.('capi_run_started', { mode })

  const enqueued = await repo.enqueue({ since: new Date(sinceMs).toISOString(), mode })
  const rows = await repo.claim({ limit: BATCH_LIMIT, mode })
  const contexts = rows.length > 0 ? await repo.loadContexts(rows.map((row) => row.orderId)) : new Map()

  for (const row of rows) {
    if (now().getTime() - startedAt > RUN_BUDGET_MS) break

    const base = contexts.get(row.orderId)
    if (!base) {
      await repo.markSkipped(row.id, 'ORDER_NOT_FOUND')
      counts.skipped += 1
      log?.('capi_event_result', { id: row.id, outcome: 'SKIPPED', reason: 'ORDER_NOT_FOUND' })
      continue
    }

    const built = await buildPurchaseEvent(
      { ...base, approvedAt: row.approvedAt },
      { eventSourceUrl, actionSource, now: now(), includeContactData },
    )
    if (!built.ok) {
      await repo.markSkipped(row.id, built.reason)
      counts.skipped += 1
      log?.('capi_event_result', { id: row.id, outcome: 'SKIPPED', reason: built.reason })
      continue
    }

    let status = 0
    let responseBody: { fbtrace_id?: unknown; error?: { message?: unknown } } = {}
    try {
      const response = await deps.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [built.event],
          access_token: token,
          ...(testEventCode ? { test_event_code: testEventCode } : {}),
        }),
      })
      status = response.status
      responseBody = await response.json().catch(() => ({}))
    } catch {
      status = 0
    }

    const outcome = classifyResponse(status)
    const message = typeof responseBody.error?.message === 'string' ? responseBody.error.message : 'no response'
    const error = sanitizeError(status, message, token)

    if (outcome === 'SENT') {
      const trace = typeof responseBody.fbtrace_id === 'string' ? responseBody.fbtrace_id : null
      await repo.markSent(row.id, trace)
      counts.sent += 1
    } else if (outcome === 'RETRY' && row.attempts < MAX_ATTEMPTS) {
      await repo.markRetry(row.id, nextAttemptAt(row.attempts, now()), error)
      counts.retry += 1
    } else {
      await repo.markFailed(row.id, error)
      counts.failed += 1
    }
    log?.('capi_event_result', { id: row.id, outcome, status })
  }

  log?.('capi_run_completed', { mode, ...counts })
  return { status: 200, body: { status: 'ok', mode, enqueued, claimed: rows.length, ...counts } }
}
