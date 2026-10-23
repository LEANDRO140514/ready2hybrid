// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  runMetaCapiSync,
  type CapiRepo,
  type ClaimedRow,
} from '../../../insforge/functions/_shared/meta-capi/orchestrate'
import type { PurchaseContext } from '../../../insforge/functions/_shared/meta-capi/event'

const TOKEN = 'fake-test-token-not-a-secret'
const SECRET = 'schedule-secret-value'
const NOW = new Date('2026-10-25T12:00:00.000Z')

const baseEnv: Record<string, string> = {
  META_CAPI_ENABLED: 'true',
  META_CAPI_DATASET_ID: '1274781161363578',
  META_CAPI_ACCESS_TOKEN: TOKEN,
  META_CAPI_SINCE: '2026-10-25T00:00:00.000Z',
  META_CAPI_SCHEDULE_SECRET: SECRET,
}

const claimed = (over: Partial<ClaimedRow> = {}): ClaimedRow => ({
  id: 'r-1',
  orderId: 'o-1',
  eventId: 'HEX-ABC123',
  attempts: 1,
  approvedAt: '2026-10-25T11:00:00.000Z',
  ...over,
})

const context: Omit<PurchaseContext, 'approvedAt'> = {
  orderId: 'o-1',
  trackingRef: 'HEX-ABC123',
  totalCents: 275000,
  productCodes: ['IND-H'],
  buyerContactId: 'b-1',
  contact: { email: 'ana@example.com', phone: '9991234567', consent: true },
  touch: null,
}

function makeRepo(rows: ClaimedRow[] = [claimed()], contexts = new Map([['o-1', context]])) {
  const repo = {
    enqueue: vi.fn(async () => rows.length),
    claim: vi.fn(async () => rows),
    loadContexts: vi.fn(async () => contexts),
    markSent: vi.fn(async () => undefined),
    markRetry: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markSkipped: vi.fn(async () => undefined),
  }
  return repo satisfies CapiRepo
}

function request(auth: string | null = `Bearer ${SECRET}`) {
  return new Request('https://fn.test/meta-capi-sync', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
  })
}

const ok = (body: unknown = { events_received: 1, fbtrace_id: 'trace-1' }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function run(over: { env?: Record<string, string>; repo?: ReturnType<typeof makeRepo>; fetchImpl?: typeof fetch; req?: Request } = {}) {
  const logs: string[] = []
  const repo = over.repo ?? makeRepo()
  const fetchImpl = over.fetchImpl ?? (vi.fn(async () => ok()) as unknown as typeof fetch)
  const env = { ...baseEnv, ...over.env }
  const result = runMetaCapiSync(over.req ?? request(), {
    env: (key) => env[key],
    repo,
    fetch: fetchImpl,
    now: () => NOW,
    log: (event, fields) => logs.push(JSON.stringify({ event, ...fields })),
  })
  return { result, repo, fetchImpl, logs }
}

describe('authorization', () => {
  it('rejects a request without the schedule secret', async () => {
    const { result, repo } = run({ req: request(null) })
    expect((await result).status).toBe(401)
    expect(repo.enqueue).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const { result, repo } = run({ req: request('Bearer nope') })
    expect((await result).status).toBe(403)
    expect(repo.claim).not.toHaveBeenCalled()
  })

  it('fails closed when the schedule secret is not configured', async () => {
    const { result } = run({ env: { META_CAPI_SCHEDULE_SECRET: '' } })
    expect((await result).status).toBe(503)
  })
})

describe('switches and configuration', () => {
  it('does nothing while META_CAPI_ENABLED is not true', async () => {
    const { result, repo, fetchImpl } = run({ env: { META_CAPI_ENABLED: 'false' } })
    const out = await result
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ status: 'disabled' })
    expect(repo.enqueue).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['dataset', { META_CAPI_DATASET_ID: '' }],
    ['token', { META_CAPI_ACCESS_TOKEN: '' }],
    ['since', { META_CAPI_SINCE: '' }],
    ['since format', { META_CAPI_SINCE: 'ayer' }],
  ])('refuses to run without %s, so history is never backfilled by accident', async (_name, env) => {
    const { result, repo, fetchImpl } = run({ env })
    const out = await result
    expect(out.status).toBe(503)
    expect(repo.enqueue).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('sending', () => {
  it('queues with the since cut-off in live mode and sends one event per request', async () => {
    const { result, repo, fetchImpl } = run()
    const out = await result
    expect(repo.enqueue).toHaveBeenCalledWith({ since: baseEnv.META_CAPI_SINCE, mode: 'live' })
    expect(repo.claim).toHaveBeenCalledWith({ limit: 25, mode: 'live' })
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.facebook.com/v23.0/1274781161363578/events')
    expect(url).not.toContain(TOKEN)
    const body = JSON.parse(String(init.body))
    expect(body.access_token).toBe(TOKEN)
    expect(body.test_event_code).toBeUndefined()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ event_name: 'Purchase', event_id: 'HEX-ABC123' })
    expect(repo.markSent).toHaveBeenCalledWith('r-1', 'trace-1')
    expect(out.body).toMatchObject({ status: 'ok', mode: 'live', sent: 1, retry: 0, failed: 0, skipped: 0 })
  })

  it('uses test mode and the test_event_code when one is configured', async () => {
    const { result, repo, fetchImpl } = run({ env: { META_CAPI_TEST_EVENT_CODE: 'TEST12345' } })
    const out = await result
    expect(repo.enqueue).toHaveBeenCalledWith({ since: baseEnv.META_CAPI_SINCE, mode: 'test' })
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(init.body)).test_event_code).toBe('TEST12345')
    expect(out.body).toMatchObject({ mode: 'test' })
  })

  it('retries server errors with backoff and keeps the row', async () => {
    const fetchImpl = vi.fn(async () => ok({ error: { message: 'temporarily unavailable' } }, 503)) as unknown as typeof fetch
    const { result, repo } = run({ fetchImpl })
    const out = await result
    expect(repo.markRetry).toHaveBeenCalledTimes(1)
    const [id, when] = repo.markRetry.mock.calls[0] as unknown as [string, Date, string]
    expect(id).toBe('r-1')
    expect(when.toISOString()).toBe('2026-10-25T12:05:00.000Z')
    expect(repo.markSent).not.toHaveBeenCalled()
    expect(out.body).toMatchObject({ retry: 1 })
  })

  it('retries when the network call throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket hang up')
    }) as unknown as typeof fetch
    const { result, repo } = run({ fetchImpl })
    await result
    expect(repo.markRetry).toHaveBeenCalledTimes(1)
  })

  it('stops retrying after the attempt limit', async () => {
    const fetchImpl = vi.fn(async () => ok({}, 500)) as unknown as typeof fetch
    const { result, repo } = run({ fetchImpl, repo: makeRepo([claimed({ attempts: 6 })]) })
    await result
    expect(repo.markRetry).not.toHaveBeenCalled()
    expect(repo.markFailed).toHaveBeenCalledTimes(1)
  })

  it('fails a rejected event for good instead of retrying it', async () => {
    const fetchImpl = vi.fn(async () => ok({ error: { message: 'Invalid parameter' } }, 400)) as unknown as typeof fetch
    const { result, repo } = run({ fetchImpl })
    const out = await result
    expect(repo.markFailed).toHaveBeenCalledTimes(1)
    expect(repo.markRetry).not.toHaveBeenCalled()
    expect(out.body).toMatchObject({ failed: 1 })
  })

  it('skips without calling Meta when an order cannot be sent', async () => {
    const repo = makeRepo([claimed({ approvedAt: '2026-10-01T00:00:00.000Z' })])
    const { result, fetchImpl } = run({ repo })
    const out = await result
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(repo.markSkipped).toHaveBeenCalledWith('r-1', 'TOO_OLD')
    expect(out.body).toMatchObject({ skipped: 1 })
  })

  it('skips an order whose data cannot be loaded', async () => {
    const repo = makeRepo([claimed()], new Map())
    const { result, fetchImpl } = run({ repo })
    await result
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(repo.markSkipped).toHaveBeenCalledWith('r-1', 'ORDER_NOT_FOUND')
  })

  it('does not call Meta at all when nothing is due', async () => {
    const repo = makeRepo([])
    const { result, fetchImpl } = run({ repo })
    const out = await result
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(repo.loadContexts).not.toHaveBeenCalled()
    expect(out.body).toMatchObject({ status: 'ok', sent: 0 })
  })
})

describe('privacy of logs and responses', () => {
  it('never logs or returns the token, the secret, or buyer data', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ error: { message: `bad token ${TOKEN} for ana@example.com` } }, 400),
    ) as unknown as typeof fetch
    const { result, logs, repo } = run({ fetchImpl })
    const out = await result
    const everything = JSON.stringify({ out, logs, errors: repo.markFailed.mock.calls })
    expect(everything).not.toContain(TOKEN)
    expect(everything).not.toContain(SECRET)
    expect(everything).not.toContain('ana@example.com')
    expect(everything).not.toContain('9991234567')
  })

  it('truncates stored errors to the column limit', async () => {
    const fetchImpl = vi.fn(async () => ok({ error: { message: 'x'.repeat(2000) } }, 400)) as unknown as typeof fetch
    const { result, repo } = run({ fetchImpl })
    await result
    const stored = repo.markFailed.mock.calls[0][1] as string
    expect(stored.length).toBeLessThanOrEqual(300)
  })
})
