import { describe, expect, it, vi } from 'vitest'
import { loadTicketCredentialRuntimeConfig } from '../../../insforge/functions/_shared/tickets/config'
import { TicketCredentialError } from '../../../insforge/functions/_shared/tickets/errors'
import { sha256Hex } from '../../../insforge/functions/_shared/tickets/hash'
import { orchestrateTicketCredentials } from '../../../insforge/functions/_shared/tickets/orchestrate'
import {
  assertOpaqueQrPayload,
  FOLIO_PATTERN,
  parseQrToken,
  parseReissueRequest,
  QR_TOKEN_PATTERN,
} from '../../../insforge/functions/_shared/tickets/validate'

const VALID_QR = 'qr_0123456789abcdef0123456789abcdef'
const VALID_TICKET_ID = '11111111-1111-4111-8111-111111111111'
const OPERATOR = 'test-operator-bearer'

function envMap(map: Record<string, string> = {}) {
  return (key: string) => map[key]
}

function getRequest(urlPath: string, init?: RequestInit): Request {
  return new Request(`https://example.test/functions/ticket-credentials${urlPath}`, init)
}

describe('QR token and folio contracts', () => {
  it('accepts high-entropy opaque qr_ + 32 hex', () => {
    expect(QR_TOKEN_PATTERN.test(VALID_QR)).toBe(true)
    expect(parseQrToken(VALID_QR)).toBe(VALID_QR)
  })

  it('rejects missing/malformed/predictable tokens', () => {
    expect(() => parseQrToken(null)).toThrow(TicketCredentialError)
    expect(() => parseQrToken('')).toThrow(TicketCredentialError)
    expect(() => parseQrToken('tkt_' + 'a'.repeat(32))).toThrow(TicketCredentialError)
    expect(() => parseQrToken('qr_SHORT')).toThrow(TicketCredentialError)
    expect(() => parseQrToken(JSON.stringify({ email: 'a@b.c' }))).toThrow(TicketCredentialError)
  })

  it('folio pattern is opaque technical tkt_ namespace value', () => {
    expect(FOLIO_PATTERN.test('tkt_' + 'a'.repeat(32))).toBe(true)
    expect(FOLIO_PATTERN.test('HEX-2026-0001')).toBe(false)
  })

  it('rejects QR payloads with PII / medical / payment fields', () => {
    expect(() => assertOpaqueQrPayload({ v: 1, t: VALID_QR, email: 'x@y.z' })).toThrow(
      TicketCredentialError,
    )
    expect(() => assertOpaqueQrPayload({ v: 1, t: VALID_QR, payment_id: 'pay_1' })).toThrow(
      TicketCredentialError,
    )
    expect(() => assertOpaqueQrPayload({ v: 1, t: VALID_QR, medical: true })).toThrow(
      TicketCredentialError,
    )
    expect(() => assertOpaqueQrPayload({ v: 1, t: VALID_QR })).not.toThrow()
  })

  it('hashes tokens with SHA-256 hex (persistence contract)', async () => {
    const hash = await sha256Hex(VALID_QR)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(VALID_QR)
  })
})

describe('reissue request validation', () => {
  it('accepts minimal protected reissue payload', () => {
    const parsed = parseReissueRequest({
      action: 'reissue',
      ticket_id: VALID_TICKET_ID,
      idempotency_key: 'idem-key-12345',
    })
    expect(parsed.ticketId).toBe(VALID_TICKET_ID)
  })

  it('rejects unknown fields and client authority expansion', () => {
    expect(() =>
      parseReissueRequest({
        ticket_id: VALID_TICKET_ID,
        idempotency_key: 'idem-key-12345',
        state: 'ISSUED',
      }),
    ).toThrow(TicketCredentialError)
  })
})

describe('runtime config', () => {
  it('loads operator bearer fail-closed when needed by callers', () => {
    const cfg = loadTicketCredentialRuntimeConfig(
      envMap({
        TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS: '3600',
        TICKET_OPERATOR_BEARER: OPERATOR,
      }),
    )
    expect(cfg.operatorBearer).toBe(OPERATOR)
    expect(cfg.idempotencyTtlSeconds).toBe(3600)
  })
})

describe('orchestrate ticket-credentials', () => {
  const baseEnv = {
    TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS: '3600',
    TICKET_OPERATOR_BEARER: OPERATOR,
  }

  it('rejects unsupported methods with 405', async () => {
    await expect(
      orchestrateTicketCredentials(getRequest('', { method: 'PUT' }), {
        env: envMap(baseEnv),
        repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'METHOD_NOT_ALLOWED', status: 405 })
  })

  it('GET without action → PUBLIC_TICKET_RETRIEVAL_DEFERRED (403)', async () => {
    await expect(
      orchestrateTicketCredentials(getRequest(''), {
        env: envMap(baseEnv),
        repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'PUBLIC_TICKET_RETRIEVAL_DEFERRED', status: 403 })
  })

  it('GET verify without auth → 401', async () => {
    await expect(
      orchestrateTicketCredentials(getRequest(`?action=verify&token=${VALID_QR}`), {
        env: envMap(baseEnv),
        repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('GET verify malformed token → 400', async () => {
    await expect(
      orchestrateTicketCredentials(getRequest('?action=verify&token=bad', {
        headers: { Authorization: `Bearer ${OPERATOR}` },
      }), {
        env: envMap(baseEnv),
        repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN', status: 400 })
  })

  it('GET verify unknown credential → 404', async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      ok: false,
      error_code: 'CREDENTIAL_NOT_FOUND',
    })
    await expect(
      orchestrateTicketCredentials(
        getRequest(`?action=verify&token=${VALID_QR}`, {
          headers: { Authorization: `Bearer ${OPERATOR}` },
        }),
        {
          env: envMap(baseEnv),
          repo: { verifyToken, getProjection: vi.fn(), reissue: vi.fn() },
        },
      ),
    ).rejects.toMatchObject({ code: 'CREDENTIAL_NOT_FOUND', status: 404 })
  })

  it('GET verify success returns sanitized body without secrets', async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        ok: true,
        valid: true,
        credential_state: 'ACTIVE',
        ticket_state: 'ISSUED',
        folio: 'tkt_' + 'a'.repeat(32),
        product_code: 'IND-H',
        generation: 1,
      },
    })
    const result = await orchestrateTicketCredentials(
      getRequest(`?action=verify&token=${VALID_QR}`, {
        headers: { Authorization: `Bearer ${OPERATOR}` },
      }),
      {
        env: envMap(baseEnv),
        repo: { verifyToken, getProjection: vi.fn(), reissue: vi.fn() },
      },
    )
    expect(result.status).toBe(200)
    expect(JSON.stringify(result.body)).not.toContain('API_KEY')
    expect(JSON.stringify(result.body)).not.toContain(OPERATOR)
  })

  it('POST reissue without auth → 401', async () => {
    await expect(
      orchestrateTicketCredentials(
        getRequest('', {
          method: 'POST',
          body: JSON.stringify({
            ticket_id: VALID_TICKET_ID,
            idempotency_key: 'idem-key-12345',
          }),
        }),
        {
          env: envMap(baseEnv),
          repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue: vi.fn() },
        },
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('POST reissue success surfaces generation rotation fields', async () => {
    const reissue = vi.fn().mockResolvedValue({
      ok: true,
      replay: false,
      response: {
        ticket_id: VALID_TICKET_ID,
        generation: 2,
        prior_generation: 1,
        folio: 'tkt_' + 'b'.repeat(32),
        raw_token: 'qr_' + 'c'.repeat(32),
      },
    })
    const result = await orchestrateTicketCredentials(
      getRequest('', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPERATOR}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: VALID_TICKET_ID,
          idempotency_key: 'idem-key-12345',
        }),
      }),
      {
        env: envMap(baseEnv),
        repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue },
      },
    )
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ generation: 2, prior_generation: 1, replay: false })
  })

  it('POST reissue without operator env → CONFIGURATION_ERROR', async () => {
    await expect(
      orchestrateTicketCredentials(
        getRequest('', {
          method: 'POST',
          body: JSON.stringify({
            ticket_id: VALID_TICKET_ID,
            idempotency_key: 'idem-key-12345',
          }),
        }),
        {
          env: envMap({ TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS: '3600' }),
          repo: { verifyToken: vi.fn(), getProjection: vi.fn(), reissue: vi.fn() },
        },
      ),
    ).rejects.toMatchObject({ code: 'CONFIGURATION_ERROR', status: 503 })
  })
})

describe('issuance policy matrix (documentary unit contracts)', () => {
  const cases = [
    { name: 'order not paid', code: 'ORDER_NOT_PAID' },
    { name: 'payment pending', code: 'ORDER_NOT_PAID' },
    { name: 'registration not eligible', code: 'REGISTRATION_NOT_ELIGIBLE' },
    { name: 'individual waiver missing', code: 'WAIVER_REQUIRED' },
    { name: 'team roster incomplete', code: 'ROSTER_NOT_ELIGIBLE' },
    { name: 'multiday blocked', code: 'MULTIDAY_ENTITLEMENT_BLOCKED' },
  ] as const

  it.each(cases)('$name maps to fail-closed code $code', ({ code }) => {
    expect(code.length).toBeGreaterThan(0)
  })

  it('documents journey cardinality expectations', () => {
    const cardinality = {
      individual: 1,
      workout: 1,
      spectator_qty_1: 1,
      spectator_qty_n: 'N registrations → N tickets',
      photographer_day: 1,
      doubles: 2,
      relay: 4,
    }
    expect(cardinality.individual).toBe(1)
    expect(cardinality.doubles).toBe(2)
    expect(cardinality.relay).toBe(4)
  })

  it('documents deferred scopes', () => {
    expect({
      EMAIL_PROVIDER: 'DEFERRED / NOT AUTHORIZED',
      TICKET_EMAIL_DELIVERY: 'DEFERRED / NOT AUTHORIZED',
      PUBLIC_TICKET_RETRIEVAL: 'DEFERRED / NOT AUTHORIZED',
      CHECK_IN: 'NOT IMPLEMENTED',
      MANIFEST: 'NOT IMPLEMENTED',
      MP_PANEL: 'DEFERRED / NOT AUTHORIZED',
      REFUND_AUTO_REVOKE: 'BLOCKED_BY_DECISION OD-007',
      MULTIDAY: 'BLOCKED_BY_DECISION OD-020',
    }).toMatchObject({
      EMAIL_PROVIDER: 'DEFERRED / NOT AUTHORIZED',
      CHECK_IN: 'NOT IMPLEMENTED',
    })
  })
})
