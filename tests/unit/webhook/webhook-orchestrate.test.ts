import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { buildManifest, normalizeDataId } from '../../../insforge/functions/_shared/mercadopago/signature'
import { createMockPaymentClient, type MercadoPagoPayment } from '../../../insforge/functions/_shared/mercadopago/payments'
import { WebhookError } from '../../../insforge/functions/_shared/webhook/errors'
import { normalizeProviderPaymentStatus } from '../../../insforge/functions/_shared/webhook/normalize'
import {
  orchestrateWebhook,
  type WebhookApplyInput,
  type WebhookRepository,
} from '../../../insforge/functions/_shared/webhook/orchestrate'

const TEST_SECRET = 'test_webhook_secret_not_real'
const ORDER_ID = '22222222-2222-2222-2222-222222222222'

function sign(dataId: string, requestId: string, ts = '1704908010'): string {
  const manifest = buildManifest(normalizeDataId(dataId), requestId, ts)
  const v1 = createHmac('sha256', TEST_SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function envMap(map: Record<string, string>) {
  return (key: string) => map[key]
}

const baseEnv = {
  MERCADOPAGO_WEBHOOK_SECRET: TEST_SECRET,
  MERCADOPAGO_ACCESS_TOKEN: 'TEST_ACCESS_TOKEN_NOT_REAL',
  MERCADOPAGO_LIVE_MODE: 'false',
}

function paymentFixture(overrides: Partial<MercadoPagoPayment> = {}): MercadoPagoPayment {
  return {
    id: '999999999',
    status: 'approved',
    external_reference: ORDER_ID,
    transaction_amount: 1400,
    currency_id: 'MXN',
    live_mode: false,
    collector_id: 1,
    date_created: '2026-07-25T00:00:00.000Z',
    date_last_updated: '2026-07-25T00:00:01.000Z',
    ...overrides,
  }
}

function memoryRepo(handler?: (input: WebhookApplyInput) => Promise<{ ok: boolean; replay?: boolean; outcome?: string }>): {
  repo: WebhookRepository
  calls: WebhookApplyInput[]
} {
  const calls: WebhookApplyInput[] = []
  return {
    calls,
    repo: {
      async applyPaymentTx(input) {
        calls.push(input)
        if (handler) return handler(input)
        return { ok: true, outcome: 'PAID' }
      },
    },
  }
}

function buildRequest(opts: {
  method?: string
  dataId?: string
  requestId?: string
  signature?: string | null
  type?: string
  body?: Record<string, unknown> | string
  includeSignature?: boolean
}): Request {
  const dataId = opts.dataId ?? '999999999'
  const requestId = opts.requestId ?? 'req-test-1'
  const method = opts.method ?? 'POST'
  const url = new URL(`https://example.test/functions/mp-webhook?data.id=${dataId}&type=${opts.type ?? 'payment'}`)
  const headers = new Headers()
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('content-type', 'application/json')
  }
  if (opts.includeSignature !== false) {
    if (opts.signature === null) {
      // omit
    } else {
      headers.set('x-signature', opts.signature ?? sign(dataId, requestId))
      headers.set('x-request-id', requestId)
    }
  } else {
    headers.set('x-request-id', requestId)
  }
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers })
  }
  const body =
    typeof opts.body === 'string'
      ? opts.body
      : JSON.stringify(
          opts.body ?? {
            id: 1,
            live_mode: false,
            type: 'payment',
            data: { id: dataId },
            action: 'payment.updated',
          },
        )
  return new Request(url, { method, headers, body })
}

describe('webhook orchestrate', () => {
  it('rejects non-POST with 405', async () => {
    const { repo } = memoryRepo()
    await expect(
      orchestrateWebhook(buildRequest({ method: 'GET' }), {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(),
        repo,
      }),
    ).rejects.toMatchObject({ code: 'METHOD_NOT_ALLOWED', status: 405 })
  })

  it('rejects malformed JSON body', async () => {
    const { repo } = memoryRepo()
    const req = buildRequest({ body: '{not-json' })
    await expect(
      orchestrateWebhook(req, {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(),
        repo,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 })
  })

  it('rejects missing x-signature without MP or repo calls', async () => {
    const getPayment = vi.fn()
    const apply = vi.fn()
    await expect(
      orchestrateWebhook(buildRequest({ includeSignature: false }), {
        env: envMap(baseEnv),
        payments: { getPayment },
        repo: { applyPaymentTx: apply },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
    expect(getPayment).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
  })

  it('rejects malformed signature', async () => {
    const getPayment = vi.fn()
    await expect(
      orchestrateWebhook(buildRequest({ signature: 'ts=bad,v1=nope' }), {
        env: envMap(baseEnv),
        payments: { getPayment },
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('rejects incorrect signature without provider query', async () => {
    const getPayment = vi.fn()
    await expect(
      orchestrateWebhook(
        buildRequest({
          signature: 'ts=1704908010,v1=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        }),
        {
          env: envMap(baseEnv),
          payments: { getPayment },
          repo: memoryRepo().repo,
        },
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('accepts valid signature and applies verified payment', async () => {
    const { repo, calls } = memoryRepo()
    const result = await orchestrateWebhook(buildRequest({}), {
      env: envMap(baseEnv),
      payments: createMockPaymentClient(async () => paymentFixture()),
      repo,
    })
    expect(result.status).toBe(200)
    expect(result.body.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].normalizedState).toBe('APPROVED')
    expect(calls[0].currency).toBe('MXN')
    expect(calls[0].amountCents).toBe(140000)
    expect(JSON.stringify(result.body)).not.toContain(TEST_SECRET)
    expect(JSON.stringify(result.body)).not.toContain('TEST_ACCESS_TOKEN')
  })

  it('rejects missing x-request-id', async () => {
    const dataId = '999999999'
    const url = new URL(`https://example.test/mp-webhook?data.id=${dataId}&type=payment`)
    const headers = new Headers({
      'content-type': 'application/json',
      'x-signature': sign(dataId, 'req-x'),
    })
    const req = new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
    })
    await expect(
      orchestrateWebhook(req, {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(),
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects missing data.id', async () => {
    const requestId = 'req-no-data'
    const url = new URL('https://example.test/mp-webhook?type=payment')
    const headers = new Headers({
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-signature': sign('1', requestId),
    })
    const req = new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'payment' }),
    })
    await expect(
      orchestrateWebhook(req, {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(),
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('fails closed when webhook secret absent', async () => {
    await expect(
      orchestrateWebhook(buildRequest({}), {
        env: envMap({ MERCADOPAGO_ACCESS_TOKEN: 'x' }),
        payments: createMockPaymentClient(),
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'WEBHOOK_NOT_CONFIGURED', status: 503 })
  })

  it('ignores unsupported topic without domain apply', async () => {
    const apply = vi.fn()
    const getPayment = vi.fn()
    const result = await orchestrateWebhook(buildRequest({ type: 'subscription_preapproval' }), {
      env: envMap(baseEnv),
      payments: { getPayment },
      repo: { applyPaymentTx: apply },
    })
    expect(result.status).toBe(200)
    expect(result.body.ignored).toBe(true)
    expect(getPayment).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
  })

  it('uses API status over body approved claim', async () => {
    const { repo, calls } = memoryRepo()
    await orchestrateWebhook(
      buildRequest({
        body: { type: 'payment', data: { id: '999999999' }, status: 'approved' },
      }),
      {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(async () => paymentFixture({ status: 'pending' })),
        repo,
      },
    )
    expect(calls[0].normalizedState).toBe('PENDING')
    expect(calls[0].externalState).toBe('pending')
  })

  it('ignores false amount in body; uses provider amount', async () => {
    const { repo, calls } = memoryRepo()
    await orchestrateWebhook(
      buildRequest({
        body: { type: 'payment', data: { id: '999999999' }, transaction_amount: 1 },
      }),
      {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(async () => paymentFixture({ transaction_amount: 1400 })),
        repo,
      },
    )
    expect(calls[0].amountCents).toBe(140000)
  })

  it('maps payment not found', async () => {
    await expect(
      orchestrateWebhook(buildRequest({}), {
        env: envMap(baseEnv),
        payments: {
          async getPayment() {
            throw new WebhookError('PAYMENT_NOT_FOUND')
          },
        },
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' })
  })

  it('fails when access token missing after valid signature', async () => {
    await expect(
      orchestrateWebhook(buildRequest({}), {
        env: envMap({ MERCADOPAGO_WEBHOOK_SECRET: TEST_SECRET }),
        payments: createMockPaymentClient(),
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'CONFIGURATION_ERROR', status: 503 })
  })

  it('surfaces transient provider errors as retryable', async () => {
    await expect(
      orchestrateWebhook(buildRequest({}), {
        env: envMap(baseEnv),
        payments: {
          async getPayment() {
            throw new WebhookError('PROVIDER_UNAVAILABLE')
          },
        },
        repo: memoryRepo().repo,
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 503, retry: 'OPTIONAL' })
  })

  it('acknowledges verification rejection without secrets', async () => {
    const { repo } = memoryRepo(async () => ({ ok: true, outcome: 'VERIFICATION_REJECTED' }))
    const result = await orchestrateWebhook(buildRequest({}), {
      env: envMap(baseEnv),
      payments: createMockPaymentClient(async () =>
        paymentFixture({ external_reference: 'missing-order', transaction_amount: 1 }),
      ),
      repo,
    })
    expect(result.status).toBe(200)
    expect(result.body.applied).toBe(false)
    expect(JSON.stringify(result.body)).not.toContain(TEST_SECRET)
  })

  it('treats duplicate notification as controlled success', async () => {
    const { repo } = memoryRepo(async () => ({ ok: true, replay: true, outcome: 'DUPLICATE' }))
    const result = await orchestrateWebhook(buildRequest({}), {
      env: envMap(baseEnv),
      payments: createMockPaymentClient(async () => paymentFixture()),
      repo,
    })
    expect(result.status).toBe(200)
    expect(result.body.replay).toBe(true)
  })

  it('allows later legitimate update with different notification id', async () => {
    const states: string[] = []
    const { repo } = memoryRepo(async (input) => {
      states.push(input.normalizedState)
      return { ok: true, outcome: input.normalizedState }
    })
    await orchestrateWebhook(buildRequest({ requestId: 'req-1' }), {
      env: envMap(baseEnv),
      payments: createMockPaymentClient(async () => paymentFixture({ status: 'pending' })),
      repo,
    })
    await orchestrateWebhook(buildRequest({ requestId: 'req-2' }), {
      env: envMap(baseEnv),
      payments: createMockPaymentClient(async () => paymentFixture({ status: 'approved' })),
      repo,
    })
    expect(states).toEqual(['PENDING', 'APPROVED'])
  })

  it.each([
    ['approved', 'APPROVED'],
    ['pending', 'PENDING'],
    ['rejected', 'REJECTED'],
    ['cancelled', 'CANCELLED'],
    ['refunded', 'REFUNDED'],
    ['charged_back', 'CHARGED_BACK'],
  ] as const)('normalizes provider status %s', (status, normalized) => {
    expect(normalizeProviderPaymentStatus(status)).toBe(normalized)
  })

  it('does not emit tickets, QR, or email side effects in apply payload contract', async () => {
    const { repo, calls } = memoryRepo()
    await orchestrateWebhook(buildRequest({}), {
      env: envMap(baseEnv),
      payments: createMockPaymentClient(async () => paymentFixture()),
      repo,
    })
    const serialized = JSON.stringify(calls[0])
    expect(serialized).not.toContain('ticket')
    expect(serialized).not.toContain('qr')
    expect(serialized).not.toContain('email')
  })

  it('propagates TX failure as internal error', async () => {
    await expect(
      orchestrateWebhook(buildRequest({}), {
        env: envMap(baseEnv),
        payments: createMockPaymentClient(async () => paymentFixture()),
        repo: {
          async applyPaymentTx() {
            return { ok: false, error_code: 'INTERNAL_ERROR' }
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })
  })
})
