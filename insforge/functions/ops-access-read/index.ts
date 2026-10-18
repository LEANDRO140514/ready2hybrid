import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { roleMayReadAccess } from '../../../src/access/gate.ts'
import { accessInputsFromTables } from '../../../src/access/assemble.ts'
import { buildAccessList } from '../../../src/access/list.ts'
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

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

type PagedQuery = {
  range: (from: number, to: number) => Promise<{ data: unknown; error: unknown }>
}

async function readAll(start: () => unknown): Promise<Record<string, unknown>[]> {
  const pageSize = 1000
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (start() as PagedQuery).range(from, from + pageSize - 1)
    if (error) throw new Error('READ_FAILED')
    const batch = Array.isArray(data) ? data : []
    for (const row of batch) {
      if (row && typeof row === 'object') rows.push(row as Record<string, unknown>)
    }
    if (batch.length < pageSize) break
  }
  return rows
}

export default async function handler(req: Request): Promise<Response> {
  const allowedOrigin = readConfiguredOrigin(env, 'OPS_DASHBOARD_CORS_ORIGIN', 'CHECKOUT_CORS_ORIGIN')
  const gate = gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
  if (req.method === 'OPTIONS') {
    if (!gate.ok) return gate.kind === 'MISSING_CONFIG'
      ? json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, { 'Content-Type': 'application/json' })
      : originNotAllowedResponse()
    const { 'Content-Type': _type, 'Cache-Control': _cache, ...preflight } = gate.headers
    return new Response(null, { status: 204, headers: preflight })
  }
  if (!gate.ok) {
    return gate.kind === 'MISSING_CONFIG'
      ? json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, { 'Content-Type': 'application/json' })
      : originNotAllowedResponse()
  }
  if (req.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, gate.headers)

  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, gate.headers)
  const header = req.headers.get('authorization')
  const match = /^Bearer\s+(\S+)/i.exec(header ?? '')
  if (!match?.[1]) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)
  const session = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${match[1]}` },
  })
  if (!session.ok) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)
  const sessionBody = await session.json() as { user?: { id?: unknown } }
  const userId = sessionBody.user?.id
  if (typeof userId !== 'string' || !userId) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)

  const admin = createAdminClient({ baseUrl, apiKey })
  const reader = await admin.database.from('dashboard_readers').select('role').eq('auth_user_id', userId).limit(1)
  if (reader.error) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  const role = Array.isArray(reader.data) ? (reader.data[0] as { role?: unknown } | undefined)?.role : null
  if (!roleMayReadAccess(role)) return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)

  try {
    const [orders, payments, manuals, registrations, participants, members, teams, contacts, tickets, products, legacy] = await Promise.all([
      readAll(() => admin.database.from('orders').select('id,state,buyer_contact_id')),
      readAll(() => admin.database.from('payments').select('order_id,provider_payment_id,normalized_state')),
      readAll(() => admin.database.from('manual_sale_resolutions').select('order_id')),
      readAll(() => admin.database.from('registrations').select('id,order_id,state,product_code,participant_id,team_id')),
      readAll(() => admin.database.from('participants').select('id,name')),
      readAll(() => admin.database.from('team_members').select('team_id,participant_id,state')),
      readAll(() => admin.database.from('teams').select('id,name,product_code')),
      readAll(() => admin.database.from('buyer_contacts').select('id,name,email,phone')),
      readAll(() => admin.database.from('tickets').select('id,registration_id,state,folio')),
      readAll(() => admin.database.from('products').select('code,name')),
      readAll(() => admin.database.from('legacy_registrations').select(
        'id,original_record_id,commercial_status,courtesy,original_name,original_email,original_phone,normalized_product_code,category_code_raw,category_name_raw,team_name_raw,participants_raw,original_payment_id',
      ).eq('event_code', 'HEX-2026')),
    ])
    const input = accessInputsFromTables({
      orders, payments, manuals, registrations, participants, members, teams, contacts, tickets, products, legacy,
    })
    return json(200, { ok: true, people: buildAccessList(input.orders, input.legacy) }, gate.headers)
  } catch {
    return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  }
}
