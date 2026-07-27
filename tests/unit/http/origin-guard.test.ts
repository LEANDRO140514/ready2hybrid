import { describe, expect, it, vi } from 'vitest'
import {
  assertNoWildcard,
  buildCorsHeaders,
  gateRequestOrigin,
  normalizeConfiguredOrigin,
  originNotAllowedBody,
  originNotAllowedResponse,
  readConfiguredOrigin,
  readRequestOrigin,
} from '../../../insforge/functions/_shared/http/origin-guard'

const ALLOWED = 'http://localhost:3000'

function req(origin?: string | null, method = 'POST'): Request {
  const headers = new Headers()
  if (origin === null) {
    headers.set('Origin', 'null')
  } else if (origin !== undefined) {
    headers.set('Origin', origin)
  }
  return new Request('https://example.test/functions/mp-create-checkout', { method, headers })
}

describe('normalizeConfiguredOrigin', () => {
  it('trims configured origin and rejects empty', () => {
    expect(normalizeConfiguredOrigin(`  ${ALLOWED}  `)).toBe(ALLOWED)
    expect(normalizeConfiguredOrigin('')).toBeNull()
    expect(normalizeConfiguredOrigin(null)).toBeNull()
    expect(normalizeConfiguredOrigin(undefined)).toBeNull()
  })
})

describe('readConfiguredOrigin', () => {
  it('reads primary then fallback', () => {
    expect(readConfiguredOrigin((k) => (k === 'ORDER_STATUS_CORS_ORIGIN' ? ALLOWED : undefined), 'ORDER_STATUS_CORS_ORIGIN')).toBe(
      ALLOWED,
    )
    expect(
      readConfiguredOrigin(
        (k) => (k === 'CHECKOUT_CORS_ORIGIN' ? ALLOWED : undefined),
        'ORDER_STATUS_CORS_ORIGIN',
        'CHECKOUT_CORS_ORIGIN',
      ),
    ).toBe(ALLOWED)
    expect(readConfiguredOrigin(() => undefined, 'CHECKOUT_CORS_ORIGIN')).toBeNull()
  })
})

describe('readRequestOrigin', () => {
  it('treats absent and literal null as not allowed', () => {
    expect(readRequestOrigin(req())).toBeNull()
    expect(readRequestOrigin(req(null))).toBeNull()
    expect(readRequestOrigin(req(ALLOWED))).toBe(ALLOWED)
  })
})

describe('gateRequestOrigin', () => {
  it('allows exact authorized origin and never emits wildcard', () => {
    const gate = gateRequestOrigin({
      req: req(ALLOWED),
      allowedOrigin: ALLOWED,
      allowMethods: 'POST, OPTIONS',
      allowHeaders: 'Content-Type',
    })
    expect(gate.ok).toBe(true)
    if (!gate.ok) return
    expect(gate.headers['Access-Control-Allow-Origin']).toBe(ALLOWED)
    expect(gate.headers.Vary).toBe('Origin')
    assertNoWildcard(gate.headers)
  })

  it('rejects different origin, null, and absent', () => {
    for (const origin of ['https://example.invalid', null, undefined] as const) {
      const gate = gateRequestOrigin({
        req: origin === undefined ? req() : req(origin),
        allowedOrigin: ALLOWED,
        allowMethods: 'POST, OPTIONS',
        allowHeaders: 'Content-Type',
      })
      expect(gate).toEqual({ ok: false, kind: 'ORIGIN_NOT_ALLOWED' })
    }
  })

  it('rejects trailing-slash mismatch without permissive matching', () => {
    const gate = gateRequestOrigin({
      req: req(`${ALLOWED}/`),
      allowedOrigin: ALLOWED,
      allowMethods: 'POST, OPTIONS',
      allowHeaders: 'Content-Type',
    })
    expect(gate).toEqual({ ok: false, kind: 'ORIGIN_NOT_ALLOWED' })
  })

  it('fail-closes when configuration is missing', () => {
    const gate = gateRequestOrigin({
      req: req(ALLOWED),
      allowedOrigin: null,
      allowMethods: 'POST, OPTIONS',
      allowHeaders: 'Content-Type',
    })
    expect(gate).toEqual({ ok: false, kind: 'MISSING_CONFIG' })
  })
})

describe('originNotAllowedResponse', () => {
  it('returns sanitized 403 without ACAO', async () => {
    const res = originNotAllowedResponse()
    expect(res.status).toBe(403)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(await res.json()).toEqual(originNotAllowedBody())
    expect(originNotAllowedBody()).toEqual({
      error: {
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Request origin is not allowed.',
        retry: 'NO',
      },
    })
  })
})

describe('buildCorsHeaders', () => {
  it('never builds wildcard ACAO', () => {
    const headers = buildCorsHeaders({
      allowedOrigin: ALLOWED,
      allowMethods: 'GET, OPTIONS',
      allowHeaders: 'Content-Type',
    })
    expect(headers['Access-Control-Allow-Origin']).toBe(ALLOWED)
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*')
  })
})

describe('origin gate before business work', () => {
  it('unauthorized origin never reaches catalog, repo, or Mercado Pago', async () => {
    const catalog = { getProductWithEvent: vi.fn() }
    const repo = {
      startCheckoutTx: vi.fn(),
      attachPreference: vi.fn(),
      compensatePreferenceFailure: vi.fn(),
    }
    const mp = { createPreference: vi.fn() }
    const orderRepo = { getOrderStateByTrackingRef: vi.fn() }

    async function simulateCheckoutHandler(request: Request) {
      const gate = gateRequestOrigin({
        req: request,
        allowedOrigin: ALLOWED,
        allowMethods: 'POST, OPTIONS',
        allowHeaders: 'Content-Type',
      })
      if (!gate.ok) return originNotAllowedResponse()
      await catalog.getProductWithEvent('PUB-VIE')
      await repo.startCheckoutTx({})
      await mp.createPreference({})
      return new Response('ok', { status: 200, headers: gate.headers })
    }

    async function simulateOrderStatusHandler(request: Request) {
      const gate = gateRequestOrigin({
        req: request,
        allowedOrigin: ALLOWED,
        allowMethods: 'GET, OPTIONS',
        allowHeaders: 'Content-Type',
      })
      if (!gate.ok) return originNotAllowedResponse()
      await orderRepo.getOrderStateByTrackingRef('trk_00000000000000000000000000000000')
      return new Response('ok', { status: 200, headers: gate.headers })
    }

    for (const origin of ['https://example.invalid', null, undefined] as const) {
      const checkoutReq = origin === undefined ? req() : req(origin)
      const orderReq =
        origin === undefined
          ? new Request('https://example.test/functions/get-order-status?reference=trk_00000000000000000000000000000000')
          : new Request('https://example.test/functions/get-order-status?reference=trk_00000000000000000000000000000000', {
              headers: { Origin: origin === null ? 'null' : origin },
            })

      const checkoutRes = await simulateCheckoutHandler(checkoutReq)
      const orderRes = await simulateOrderStatusHandler(orderReq)
      expect(checkoutRes.status).toBe(403)
      expect(orderRes.status).toBe(403)
    }

    expect(catalog.getProductWithEvent).not.toHaveBeenCalled()
    expect(repo.startCheckoutTx).not.toHaveBeenCalled()
    expect(mp.createPreference).not.toHaveBeenCalled()
    expect(orderRepo.getOrderStateByTrackingRef).not.toHaveBeenCalled()
  })

  it('authorized origin may proceed to business stubs', async () => {
    const work = vi.fn(async () => 'done')
    const gate = gateRequestOrigin({
      req: req(ALLOWED),
      allowedOrigin: ALLOWED,
      allowMethods: 'POST, OPTIONS',
      allowHeaders: 'Content-Type',
    })
    expect(gate.ok).toBe(true)
    if (!gate.ok) return
    await work()
    expect(work).toHaveBeenCalledOnce()
    expect(gate.headers.Vary).toBe('Origin')
  })
})

describe('handler source order', () => {
  it('mp-create-checkout gates Origin before JSON parse and orchestration', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'insforge/functions/mp-create-checkout/index.ts'),
      'utf8',
    )
    const body = src.slice(src.indexOf('export default async function handler'))
    const gateIdx = body.indexOf('const gate = gateOrigin(req)')
    const jsonIdx = body.indexOf('await req.json()')
    const orchIdx = body.indexOf('orchestrateCheckoutStart(')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(jsonIdx).toBeGreaterThan(gateIdx)
    expect(orchIdx).toBeGreaterThan(jsonIdx)
    expect(src).toContain('originNotAllowedResponse')
    expect(src).not.toContain("Access-Control-Allow-Origin': '*'")
    expect(src).not.toContain('Access-Control-Allow-Origin": "*"')
  })

  it('get-order-status gates Origin before orchestration and repo use', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'insforge/functions/get-order-status/index.ts'),
      'utf8',
    )
    const body = src.slice(src.indexOf('export default async function handler'))
    const gateIdx = body.indexOf('const gate = gateOrigin(req)')
    const orchIdx = body.indexOf('orchestrateOrderStatus(')
    const repoIdx = body.indexOf('repo: createLazyRepo()')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(orchIdx).toBeGreaterThan(gateIdx)
    expect(repoIdx).toBeGreaterThan(gateIdx)
    expect(src).toContain('originNotAllowedResponse')
    expect(src).not.toContain("Access-Control-Allow-Origin': '*'")
  })
})
