import { describe, expect, it, vi } from 'vitest'
import { loadTeamRosterRuntimeConfig } from '../../../insforge/functions/_shared/teams/config'
import { TeamRosterError } from '../../../insforge/functions/_shared/teams/errors'
import { sha256Hex } from '../../../insforge/functions/_shared/teams/hash'
import { orchestrateTeamRoster } from '../../../insforge/functions/_shared/teams/orchestrate'
import {
  INVITATION_TOKEN_PATTERN,
  parseAcceptInvitationRequest,
  parseInvitationToken,
} from '../../../insforge/functions/_shared/teams/validate'

const VALID_TOKEN = 'inv_0123456789abcdef0123456789abcdef'

function envMap(map: Record<string, string> = {}) {
  return (key: string) => map[key]
}

function getRequest(token?: string | null, method = 'GET'): Request {
  const url = new URL('https://example.test/functions/team-roster')
  if (token !== undefined && token !== null) {
    url.searchParams.set('token', token)
  }
  return new Request(url, { method })
}

describe('invitation token', () => {
  it('accepts inv_ + 32 hex', () => {
    expect(INVITATION_TOKEN_PATTERN.test(VALID_TOKEN)).toBe(true)
    expect(parseInvitationToken(VALID_TOKEN)).toBe(VALID_TOKEN)
  })

  it('rejects missing/malformed/predictable tokens', () => {
    expect(() => parseInvitationToken(null)).toThrow(TeamRosterError)
    expect(() => parseInvitationToken('')).toThrow(TeamRosterError)
    expect(() => parseInvitationToken('1')).toThrow(TeamRosterError)
    expect(() => parseInvitationToken('team-1')).toThrow(TeamRosterError)
    expect(() => parseInvitationToken('inv_SHORT')).toThrow(TeamRosterError)
    expect(() => parseInvitationToken('trk_' + 'a'.repeat(32))).toThrow(TeamRosterError)
  })
})

describe('accept payload', () => {
  it('accepts minimal authorized payload', () => {
    const parsed = parseAcceptInvitationRequest({
      token: VALID_TOKEN,
      idempotency_key: 'idem-key-12345',
      participant: { public_ref: 'part_abc' },
      waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
    })
    expect(parsed.token).toBe(VALID_TOKEN)
  })

  it('rejects unknown fields and client authority', () => {
    expect(() =>
      parseAcceptInvitationRequest({
        token: VALID_TOKEN,
        idempotency_key: 'idem-key-12345',
        waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
        team_size: 2,
      }),
    ).toThrow(TeamRosterError)
    expect(() =>
      parseAcceptInvitationRequest({
        token: VALID_TOKEN,
        idempotency_key: 'idem-key-12345',
        waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
        extra: true,
      }),
    ).toThrow(TeamRosterError)
  })

  it('rejects missing waiver acceptance', () => {
    expect(() =>
      parseAcceptInvitationRequest({
        token: VALID_TOKEN,
        idempotency_key: 'idem-key-12345',
      }),
    ).toThrow(TeamRosterError)
  })
})

describe('orchestrate team-roster', () => {
  const waiverEnv = {
    CHECKOUT_WAIVER_DOCUMENT_TYPE: 'COMPETITION',
    CHECKOUT_WAIVER_VERSION: 'v1',
    TEAM_ROSTER_IDEMPOTENCY_TTL_SECONDS: '3600',
  }

  it('rejects non-GET/POST', async () => {
    await expect(
      orchestrateTeamRoster(getRequest(VALID_TOKEN, 'PUT'), {
        env: envMap(waiverEnv),
        repo: { getByTokenHash: vi.fn(), acceptInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'METHOD_NOT_ALLOWED' })
  })

  it('GET missing token → INVALID_TOKEN', async () => {
    await expect(
      orchestrateTeamRoster(getRequest(null), {
        env: envMap(waiverEnv),
        repo: { getByTokenHash: vi.fn(), acceptInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('GET malformed token → INVALID_TOKEN', async () => {
    await expect(
      orchestrateTeamRoster(getRequest('bad'), {
        env: envMap(waiverEnv),
        repo: { getByTokenHash: vi.fn(), acceptInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('GET unknown token → 404 mapping', async () => {
    const getByTokenHash = vi.fn(async () => ({
      ok: false as const,
      error_code: 'INVITATION_NOT_FOUND',
    }))
    await expect(
      orchestrateTeamRoster(getRequest(VALID_TOKEN), {
        env: envMap(waiverEnv),
        repo: { getByTokenHash, acceptInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND', status: 404 })
  })

  it('GET valid projection has no PII/internal IDs', async () => {
    const projection = {
      status: 'OPEN',
      product_name: 'Dobles Mixto',
      required_members: 2,
      completed_members: 1,
      remaining_members: 1,
      accepting_members: true,
      waiver: { document_type: 'COMPETITION', version: 'v1' },
    }
    const getByTokenHash = vi.fn(async () => ({ ok: true as const, projection }))
    const result = await orchestrateTeamRoster(getRequest(VALID_TOKEN), {
      env: envMap(waiverEnv),
      repo: { getByTokenHash, acceptInvitation: vi.fn() },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual(projection)
    const json = JSON.stringify(result.body)
    expect(json).not.toMatch(/order_id|team_id|participant_id|email|phone|secret/i)
    const hash = await sha256Hex(VALID_TOKEN)
    expect(getByTokenHash).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: hash }),
    )
  })

  it('GET inactive invitation', async () => {
    await expect(
      orchestrateTeamRoster(getRequest(VALID_TOKEN), {
        env: envMap(waiverEnv),
        repo: {
          getByTokenHash: vi.fn(async () => ({
            ok: false as const,
            error_code: 'INVITATION_INACTIVE',
          })),
          acceptInvitation: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({ code: 'INVITATION_INACTIVE' })
  })

  it('GET unpaid returns projection PAYMENT_REQUIRED (not accepting)', async () => {
    const result = await orchestrateTeamRoster(getRequest(VALID_TOKEN), {
      env: envMap(waiverEnv),
      repo: {
        getByTokenHash: vi.fn(async () => ({
          ok: true as const,
          projection: {
            status: 'PAYMENT_REQUIRED',
            product_name: 'Dobles',
            required_members: 2,
            completed_members: 1,
            remaining_members: 1,
            accepting_members: false,
          },
        })),
        acceptInvitation: vi.fn(),
      },
    })
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ status: 'PAYMENT_REQUIRED', accepting_members: false })
  })

  it('POST valid accept', async () => {
    const acceptInvitation = vi.fn(async () => ({
      ok: true as const,
      replay: false,
      response: {
        status: 'MEMBER_ACCEPTED',
        required_members: 2,
        completed_members: 2,
        remaining_members: 0,
        terminal: true,
      },
    }))
    const req = new Request('https://example.test/functions/team-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: VALID_TOKEN,
        idempotency_key: 'idem-accept-001',
        participant: { public_ref: 'part_member' },
        waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
      }),
    })
    const result = await orchestrateTeamRoster(req, {
      env: envMap(waiverEnv),
      repo: { getByTokenHash: vi.fn(), acceptInvitation },
    })
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ status: 'MEMBER_ACCEPTED', terminal: true })
    expect(acceptInvitation).toHaveBeenCalledTimes(1)
  })

  it('POST rejects outdated waiver version', async () => {
    const req = new Request('https://example.test/functions/team-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: VALID_TOKEN,
        idempotency_key: 'idem-accept-002',
        waiver: { document_type: 'COMPETITION', version: 'old', accepted: true },
      }),
    })
    await expect(
      orchestrateTeamRoster(req, {
        env: envMap(waiverEnv),
        repo: { getByTokenHash: vi.fn(), acceptInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'WAIVER_REQUIRED' })
  })

  it('POST without waiver config → WAIVER_CONFIGURATION_REQUIRED', async () => {
    const req = new Request('https://example.test/functions/team-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: VALID_TOKEN,
        idempotency_key: 'idem-accept-003',
        waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
      }),
    })
    await expect(
      orchestrateTeamRoster(req, {
        env: envMap({}),
        repo: { getByTokenHash: vi.fn(), acceptInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: 'WAIVER_CONFIGURATION_REQUIRED' })
  })

  it('POST idempotent replay returns same logical body', async () => {
    const body = {
      status: 'MEMBER_ACCEPTED',
      required_members: 2,
      completed_members: 2,
      remaining_members: 0,
      terminal: true,
    }
    const acceptInvitation = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, replay: false, response: body })
      .mockResolvedValueOnce({ ok: true, replay: true, response: body })

    const makeReq = () =>
      new Request('https://example.test/functions/team-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: VALID_TOKEN,
          idempotency_key: 'idem-same',
          waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
        }),
      })

    const a = await orchestrateTeamRoster(makeReq(), {
      env: envMap(waiverEnv),
      repo: { getByTokenHash: vi.fn(), acceptInvitation },
    })
    const b = await orchestrateTeamRoster(makeReq(), {
      env: envMap(waiverEnv),
      repo: { getByTokenHash: vi.fn(), acceptInvitation },
    })
    expect(a.body).toEqual(b.body)
  })

  it('POST roster full / duplicate / conflict', async () => {
    for (const code of ['ROSTER_FULL', 'DUPLICATE_PARTICIPANT', 'CONFLICT'] as const) {
      await expect(
        orchestrateTeamRoster(
          new Request('https://example.test/functions/team-roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: VALID_TOKEN,
              idempotency_key: `idem-${code}`,
              waiver: { document_type: 'COMPETITION', version: 'v1', accepted: true },
            }),
          }),
          {
            env: envMap(waiverEnv),
            repo: {
              getByTokenHash: vi.fn(),
              acceptInvitation: vi.fn(async () => ({ ok: false as const, error_code: code })),
            },
          },
        ),
      ).rejects.toMatchObject({ code })
    }
  })

  it('does not call Mercado Pago (repo-only)', async () => {
    const getByTokenHash = vi.fn(async () => ({
      ok: true as const,
      projection: {
        status: 'OPEN',
        product_name: 'X',
        required_members: 2,
        completed_members: 1,
        remaining_members: 1,
        accepting_members: true,
      },
    }))
    await orchestrateTeamRoster(getRequest(VALID_TOKEN), {
      env: envMap(waiverEnv),
      repo: { getByTokenHash, acceptInvitation: vi.fn() },
    })
    expect(getByTokenHash).toHaveBeenCalled()
  })
})

describe('team roster config', () => {
  it('loads CORS and waiver from env', () => {
    const cfg = loadTeamRosterRuntimeConfig(
      envMap({
        TEAM_ROSTER_CORS_ORIGIN: 'https://example.com',
        CHECKOUT_WAIVER_DOCUMENT_TYPE: 'COMPETITION',
        CHECKOUT_WAIVER_VERSION: 'v1',
        TEAM_ROSTER_IDEMPOTENCY_TTL_SECONDS: '120',
      }),
    )
    expect(cfg.corsOrigin).toBe('https://example.com')
    expect(cfg.waiverRequiredDocumentType).toBe('COMPETITION')
    expect(cfg.idempotencyTtlSeconds).toBe(120)
  })
})

describe('static guarantees', () => {
  it('source modules do not reference Mercado Pago or tickets', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const root = path.resolve('insforge/functions/_shared/teams')
    const files = await fs.readdir(root)
    for (const file of files) {
      const text = await fs.readFile(path.join(root, file), 'utf8')
      expect(text).not.toMatch(/mercadopago|ticket_credential|createPreference|qr_/i)
      expect(text).not.toMatch(/INSERT INTO|UPDATE public\.|\.insert\(/i)
    }
  })
})
