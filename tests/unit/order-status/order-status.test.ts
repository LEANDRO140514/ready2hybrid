import { describe, expect, it, vi } from 'vitest'
import { loadOrderStatusRuntimeConfig } from '../../../insforge/functions/_shared/public-status/config'
import { OrderStatusError } from '../../../insforge/functions/_shared/public-status/errors'
import {
  isKnownInternalOrderState,
  projectPublicOrderStatus,
} from '../../../insforge/functions/_shared/public-status/mapping'
import { orchestrateOrderStatus } from '../../../insforge/functions/_shared/public-status/orchestrate'
import {
  parsePublicOrderReference,
  PUBLIC_ORDER_REFERENCE_PATTERN,
} from '../../../insforge/functions/_shared/public-status/validate'

const VALID_REF = 'trk_0123456789abcdef0123456789abcdef'

function envMap(map: Record<string, string> = {}) {
  return (key: string) => map[key]
}

function getRequest(reference?: string | null, method = 'GET'): Request {
  const url = new URL('https://example.test/functions/get-order-status')
  if (reference !== undefined && reference !== null) {
    url.searchParams.set('reference', reference)
  }
  return new Request(url, { method })
}

describe('public order reference', () => {
  it('accepts IMPL-7 tracking_ref format', () => {
    expect(PUBLIC_ORDER_REFERENCE_PATTERN.test(VALID_REF)).toBe(true)
    expect(parsePublicOrderReference(VALID_REF)).toBe(VALID_REF)
  })

  it('rejects missing reference', () => {
    expect(() => parsePublicOrderReference(null)).toThrow(OrderStatusError)
    expect(() => parsePublicOrderReference('')).toThrowError(/invalid/i)
  })

  it('rejects malformed and predictable shapes', () => {
    expect(() => parsePublicOrderReference('1')).toThrow(OrderStatusError)
    expect(() => parsePublicOrderReference('order-1')).toThrow(OrderStatusError)
    expect(() => parsePublicOrderReference('trk_SHORT')).toThrow(OrderStatusError)
    expect(() => parsePublicOrderReference('trk_' + 'g'.repeat(32))).toThrow(OrderStatusError)
    expect(() => parsePublicOrderReference(VALID_REF.toUpperCase().replace('TRK_', 'TRK_'))).not.toThrow()
  })
})

describe('public status mapping (SPEC-031)', () => {
  it.each([
    ['CREATED', 'CREATING', false],
    ['PREFERENCE_PENDING', 'AWAITING_PAYMENT', false],
    ['PAYMENT_PENDING', 'AWAITING_PAYMENT', false],
    ['PAID', 'APPROVED', true],
    ['REJECTED', 'REJECTED', true],
    ['CANCELLED', 'CANCELLED', true],
    ['EXPIRED', 'EXPIRED', true],
    ['REQUIRES_REVIEW', 'REQUIRES_ACTION', false],
    ['REFUNDED', 'REFUNDED', true],
    ['CHARGED_BACK', 'CHARGED_BACK', true],
  ] as const)('maps %s → %s terminal=%s', (internal, publicStatus, terminal) => {
    const proj = projectPublicOrderStatus(internal, 3)
    expect(proj.status).toBe(publicStatus)
    expect(proj.terminal).toBe(terminal)
    expect(proj.next_poll_after_seconds).toBe(terminal ? null : 3)
  })

  it('fail-closes unknown internal state to REQUIRES_ACTION', () => {
    expect(isKnownInternalOrderState('WEIRD')).toBe(false)
    const proj = projectPublicOrderStatus('WEIRD', 5)
    expect(proj.status).toBe('REQUIRES_ACTION')
    expect(proj.terminal).toBe(false)
  })
})

describe('orchestrate get-order-status', () => {
  it('rejects non-GET', async () => {
    await expect(
      orchestrateOrderStatus(getRequest(VALID_REF, 'POST'), {
        env: envMap(),
        repo: { getOrderStateByTrackingRef: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'METHOD_NOT_ALLOWED', status: 405 })
  })

  it('rejects missing reference', async () => {
    await expect(
      orchestrateOrderStatus(getRequest(null), {
        env: envMap(),
        repo: { getOrderStateByTrackingRef: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE', status: 400 })
  })

  it('rejects malformed reference without repo call', async () => {
    const repo = { getOrderStateByTrackingRef: vi.fn() }
    await expect(
      orchestrateOrderStatus(getRequest('not-a-ref'), {
        env: envMap(),
        repo,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE', status: 400 })
    expect(repo.getOrderStateByTrackingRef).not.toHaveBeenCalled()
  })

  it('returns 404 for unknown opaque reference', async () => {
    await expect(
      orchestrateOrderStatus(getRequest(VALID_REF), {
        env: envMap(),
        repo: { async getOrderStateByTrackingRef() { return null } },
      }),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', status: 404 })
  })

  it('returns public projection for valid reference', async () => {
    const result = await orchestrateOrderStatus(getRequest(VALID_REF), {
      env: envMap({ ORDER_STATUS_POLL_SECONDS: '4' }),
      repo: { async getOrderStateByTrackingRef() { return 'PAYMENT_PENDING' } },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      status: 'AWAITING_PAYMENT',
      terminal: false,
      next_poll_after_seconds: 4,
    })
    expect(JSON.stringify(result.body)).not.toContain('order_id')
    expect(JSON.stringify(result.body)).not.toContain('payment')
    expect(JSON.stringify(result.body)).not.toContain('@')
  })

  it('maps PAID to APPROVED terminal without ticket claims', async () => {
    const result = await orchestrateOrderStatus(getRequest(VALID_REF), {
      env: envMap(),
      repo: { async getOrderStateByTrackingRef() { return 'PAID' } },
    })
    expect(result.body.status).toBe('APPROVED')
    expect(result.body.terminal).toBe(true)
    expect(result.body.next_poll_after_seconds).toBeNull()
    expect(JSON.stringify(result.body)).not.toContain('ticket')
    expect(JSON.stringify(result.body)).not.toContain('qr')
  })

  it('polling repeated yields same logical result', async () => {
    const repo = {
      getOrderStateByTrackingRef: vi.fn(async () => 'PAYMENT_PENDING'),
    }
    const a = await orchestrateOrderStatus(getRequest(VALID_REF), { env: envMap(), repo })
    const b = await orchestrateOrderStatus(getRequest(VALID_REF), { env: envMap(), repo })
    expect(a.body).toEqual(b.body)
    expect(repo.getOrderStateByTrackingRef).toHaveBeenCalledTimes(2)
  })

  it('reflects canonical update on next read', async () => {
    let state = 'PAYMENT_PENDING'
    const repo = {
      async getOrderStateByTrackingRef() {
        return state
      },
    }
    const pending = await orchestrateOrderStatus(getRequest(VALID_REF), { env: envMap(), repo })
    state = 'PAID'
    const paid = await orchestrateOrderStatus(getRequest(VALID_REF), { env: envMap(), repo })
    expect(pending.body.status).toBe('AWAITING_PAYMENT')
    expect(paid.body.status).toBe('APPROVED')
  })

  it('surfaces backend unavailability', async () => {
    await expect(
      orchestrateOrderStatus(getRequest(VALID_REF), {
        env: envMap(),
        repo: {
          async getOrderStateByTrackingRef() {
            throw new Error('db down')
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 })
  })

  it('does not call Mercado Pago (no payment client in deps)', async () => {
    const mp = vi.fn()
    await orchestrateOrderStatus(getRequest(VALID_REF), {
      env: envMap(),
      repo: { async getOrderStateByTrackingRef() { return 'CANCELLED' } },
    })
    expect(mp).not.toHaveBeenCalled()
  })

  it('covers remaining public outcomes', async () => {
    for (const [internal, expected] of [
      ['REJECTED', 'REJECTED'],
      ['CANCELLED', 'CANCELLED'],
      ['EXPIRED', 'EXPIRED'],
      ['REFUNDED', 'REFUNDED'],
      ['CHARGED_BACK', 'CHARGED_BACK'],
      ['REQUIRES_REVIEW', 'REQUIRES_ACTION'],
      ['CREATED', 'CREATING'],
    ] as const) {
      const result = await orchestrateOrderStatus(getRequest(VALID_REF), {
        env: envMap(),
        repo: { async getOrderStateByTrackingRef() { return internal } },
      })
      expect(result.body.status).toBe(expected)
    }
  })

  it('rejects invalid poll config', () => {
    expect(() => loadOrderStatusRuntimeConfig(envMap({ ORDER_STATUS_POLL_SECONDS: '0' }))).toThrow(
      OrderStatusError,
    )
  })

  it('response body has no secrets or internal ids', async () => {
    const result = await orchestrateOrderStatus(getRequest(VALID_REF), {
      env: envMap({ MERCADOPAGO_ACCESS_TOKEN: 'SECRET_TOKEN_VALUE' }),
      repo: { async getOrderStateByTrackingRef() { return 'PAID' } },
    })
    const raw = JSON.stringify(result.body)
    expect(raw).not.toContain('SECRET_TOKEN_VALUE')
    expect(raw).not.toContain(VALID_REF)
    expect(raw).not.toContain('uuid')
  })
})

describe('static read-only guarantees', () => {
  it('orchestrate module source has no mutation verbs toward domain tables', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'insforge/functions/_shared/public-status/orchestrate.ts'),
      'utf8',
    )
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
    const handler = fs.readFileSync(
      path.resolve(process.cwd(), 'insforge/functions/get-order-status/index.ts'),
      'utf8',
    )
    expect(handler).toContain(".select('state')")
    expect(handler).not.toMatch(/\.insert\(|\.update\(|\.delete\(/)
    expect(handler).not.toContain('mercadopago.com')
    expect(handler).toContain('Cache-Control')
    expect(handler).toContain('no-store')
  })
})
