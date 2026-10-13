import { createPartner, setPartnerActive, updatePartner, roleMayAdministerPartners } from '../../../src/partners/admin.ts'
import type { CommunityPartner, PartnerProfile } from '../../../src/partners/contract.ts'
import type { PartnerStore } from '../../../src/partners/admin.ts'
import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import {
  gateRequestOrigin,
  originNotAllowedResponse,
  readConfiguredOrigin,
} from '../_shared/http/origin-guard.ts'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

const ALLOW_METHODS = 'POST, OPTIONS'
const ALLOW_HEADERS = 'Content-Type, Authorization'

function gateOrigin(req: Request) {
  const allowedOrigin = readConfiguredOrigin(
    env,
    'OPS_DASHBOARD_CORS_ORIGIN',
    'CHECKOUT_CORS_ORIGIN',
  )
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function fromRow(row: Record<string, unknown> | null): CommunityPartner | null {
  if (!row) return null
  const code = text(row.code)
  const studioName = text(row.name)
  const createdAt = text(row.created_at)
  if (!code || !studioName || !createdAt) return null
  return {
    code,
    studioName,
    contactName: text(row.contact_name) ?? '',
    phone: text(row.contact_phone) ?? '',
    email: text(row.contact_email) ?? '',
    active: row.active === true,
    createdAt,
    locksLaunchPrice: row.locks_launch_price !== false,
  }
}

type QueryResult = { data: unknown; error: { message?: string } | null }

function adminStore(admin: {
  database: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => { limit: (n: number) => Promise<QueryResult> }
        order: (column: string, options: { ascending: boolean }) => Promise<QueryResult>
      }
      insert: (rows: Record<string, unknown>[]) => Promise<QueryResult>
      update: (row: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<QueryResult>
      }
    }
  }
}): PartnerStore {
  const table = () => admin.database.from('affiliates')
  return {
    async find(code) {
      const result = await table().select(
        'code,name,contact_name,contact_email,contact_phone,active,created_at,locks_launch_price',
      ).eq('code', code).limit(1)
      if (result.error) throw new Error('PARTNER_IO')
      const rows = Array.isArray(result.data) ? result.data : []
      const row = rows[0]
      return fromRow(row && typeof row === 'object' ? row as Record<string, unknown> : null)
    },
    async list() {
      const result = await table().select(
        'code,name,contact_name,contact_email,contact_phone,active,created_at,locks_launch_price',
      ).order('created_at', { ascending: false })
      if (result.error) throw new Error('PARTNER_IO')
      const rows = Array.isArray(result.data) ? result.data : []
      const partners: CommunityPartner[] = []
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const partner = fromRow(row as Record<string, unknown>)
        if (partner) partners.push(partner)
      }
      return partners
    },
    async insert(partner) {
      const result = await table().insert([{
        code: partner.code,
        name: partner.studioName,
        contact_name: partner.contactName,
        contact_phone: partner.phone,
        contact_email: partner.email,
        active: true,
        locks_launch_price: true,
        commission_bps: 0,
        created_at: partner.createdAt,
      }])
      if (result.error) {
        const message = result.error.message ?? ''
        if (message.includes('duplicate') || message.includes('23505')) throw new Error('CODE_TAKEN')
        throw new Error('PARTNER_IO')
      }
    },
    async updateProfile(code, profile: PartnerProfile) {
      const result = await table().update({
        name: profile.studioName,
        contact_name: profile.contactName,
        contact_phone: profile.phone,
        contact_email: profile.email,
      }).eq('code', code)
      if (result.error) throw new Error('PARTNER_IO')
    },
    async setActive(code, active) {
      const result = await table().update({ active }).eq('code', code)
      if (result.error) throw new Error('PARTNER_IO')
    },
    async log(entry) {
      const result = await admin.database.from('activity_log').insert([{
        actor_ref: 'edge:ops-partners',
        named_action: entry.action,
        entity_type: 'affiliate',
        entity_ref: entry.code,
        result: 'OK',
        sanitized_metadata: entry.metadata,
      }])
      if (result.error) throw new Error('PARTNER_IO')
    },
  }
}

async function resolveUserId(baseUrl: string, header: string | null): Promise<string | null> {
  const match = /^Bearer\s+(\S+)/i.exec(header ?? '')
  if (!match?.[1]) return null
  const response = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${match[1]}` },
  })
  if (!response.ok) return null
  const body = (await response.json()) as { user?: { id?: unknown } }
  return typeof body.user?.id === 'string' && body.user.id ? body.user.id : null
}

function commandPayload(body: Record<string, unknown>): unknown {
  const profile = body.profile
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
    return { ...(profile as Record<string, unknown>), code: body.code }
  }
  return body
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    const gate = gateOrigin(req)
    if (!gate.ok) {
      if (gate.kind === 'MISSING_CONFIG') {
        return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
      }
      return originNotAllowedResponse()
    }
    const { 'Content-Type': _type, 'Cache-Control': _cache, ...preflight } = gate.headers
    return new Response(null, { status: 204, headers: preflight })
  }

  const gate = gateOrigin(req)
  if (!gate.ok) {
    if (gate.kind === 'MISSING_CONFIG') {
      return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
    }
    return originNotAllowedResponse()
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, gate.headers)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'INVALID_REQUEST' }, gate.headers)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { ok: false, error: 'INVALID_REQUEST' }, gate.headers)
  }
  const record = body as Record<string, unknown>
  const action = record.action
  if (action !== 'list' && action !== 'create' && action !== 'update' && action !== 'set-active') {
    return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)
  }

  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) {
    return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, gate.headers)
  }

  try {
    const userId = await resolveUserId(baseUrl, req.headers.get('authorization'))
    if (!userId) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)
    const admin = createAdminClient({ baseUrl, apiKey })
    const { data, error } = await admin.database
      .from('dashboard_readers')
      .select('role')
      .eq('auth_user_id', userId)
      .limit(1)
    if (error) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
    const role = Array.isArray(data) ? (data[0] as { role?: unknown } | undefined)?.role : null
    if (!roleMayAdministerPartners(role)) {
      return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)
    }

    const store = adminStore(admin)
    if (action === 'list') {
      const partners = await store.list()
      return json(200, { ok: true, partners }, gate.headers)
    }
    const payload = commandPayload(record)
    if (action === 'create') {
      const created = await createPartner(store, payload, new Date().toISOString())
      if (!created.ok) return json(created.status, { ok: false, error: created.code }, gate.headers)
      return json(200, { ok: true, partner: created.value }, gate.headers)
    }
    if (action === 'update') {
      const updated = await updatePartner(store, payload)
      if (!updated.ok) return json(updated.status, { ok: false, error: updated.code }, gate.headers)
      return json(200, { ok: true, partner: updated.value }, gate.headers)
    }
    const toggled = await setPartnerActive(store, record)
    if (!toggled.ok) return json(toggled.status, { ok: false, error: toggled.code }, gate.headers)
    return json(200, { ok: true, partner: toggled.value }, gate.headers)
  } catch {
    return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  }
}
