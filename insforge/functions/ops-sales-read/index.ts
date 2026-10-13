import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { labelsForActors, usersFromAuthList } from '../_shared/sales-read/actors.ts'
import { adminFinanceStore, parseFinanceAdjustmentInput, saveFinanceAdjustment } from '../_shared/sales-read/adjust.ts'
import { assembleSalesSnapshot } from '../_shared/sales-read/assemble.ts'
import { classifySalesReadRequest, roleMayReadSales } from '../_shared/sales-read/gate.ts'
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

function dropId(ids: Set<string>, id: string): Set<string> {
  const next = new Set<string>()
  for (const value of ids) {
    if (value !== id) next.add(value)
  }
  return next
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

type QueryResult = { data: unknown; error: { message?: string } | null }

type Query = {
  range: (from: number, to: number) => Promise<QueryResult>
  in?: (column: string, values: string[]) => Query
  eq?: (column: string, value: string) => Query
}

async function loadActorLabels(
  baseUrl: string,
  apiKey: string,
  ids: Set<string>,
): Promise<{ id: string; label: string }[]> {
  if (ids.size === 0) return []
  const found: { id: string; label: string }[] = []
  let pending = new Set(ids)
  let offset = 0
  const limit = 100
  try {
    for (let page = 0; page < 5 && pending.size > 0; page += 1) {
      const response = await fetch(
        `${baseUrl}/api/auth/users?offset=${offset}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      )
      if (!response.ok) return found
      const users = usersFromAuthList(await response.json())
      if (users.length === 0) return found
      for (const actor of labelsForActors(users, pending)) {
        found.push(actor)
      }
      for (const actor of found) pending = dropId(pending, actor.id)
      if (users.length < limit) return found
      offset += users.length
    }
  } catch {
    return found
  }
  return found
}

async function readAll(
  start: () => Query,
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await start().range(from, from + pageSize - 1)
    if (error) throw new Error('READ_FAILED')
    const batch = Array.isArray(data) ? data : []
    for (const row of batch) {
      if (row && typeof row === 'object') rows.push(row as Record<string, unknown>)
    }
    if (batch.length < pageSize) break
  }
  return rows
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
  const view =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { view?: unknown }).view
      : undefined
  const classified = classifySalesReadRequest(view)
  if (!classified.ok) {
    return json(classified.status, { ok: false, error: classified.code }, gate.headers)
  }

  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) {
    return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, gate.headers)
  }

  try {
    const userId = await resolveUserId(baseUrl, req.headers.get('authorization'))
    if (!userId) {
      return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)
    }
    const admin = createAdminClient({ baseUrl, apiKey })
    const { data, error } = await admin.database
      .from('dashboard_readers')
      .select('role')
      .eq('auth_user_id', userId)
      .limit(1)
    if (error) {
      return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
    }
    const role = Array.isArray(data) ? (data[0] as { role?: unknown } | undefined)?.role : null
    if (!roleMayReadSales(role)) {
      return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)
    }
    if (classified.view === 'whoami') {
      return json(200, { ok: true, role, userId }, gate.headers)
    }
    if (classified.view === 'upsert-adjustment') {
      const parsed = parseFinanceAdjustmentInput(body)
      if (!parsed.ok) {
        return json(parsed.status, { ok: false, error: parsed.code }, gate.headers)
      }
      const saved = await saveFinanceAdjustment(
        adminFinanceStore(admin),
        userId,
        parsed.input,
      )
      if (!saved.ok) {
        return json(saved.status, { ok: false, error: saved.code }, gate.headers)
      }
      return json(200, { ok: true }, gate.headers)
    }

    const [
      orders,
      buyers,
      items,
      products,
      payments,
      registrations,
      tickets,
      outbox,
      verifications,
      activity,
      webhooks,
      affiliates,
      members,
      participants,
      adjustments,
    ] = await Promise.all([
      readAll(() => admin.database.from('orders').select(
        'id,buyer_contact_id,state,currency,total_cents,tracking_ref,created_at,updated_at,expires_at,affiliate_code,commercial_snapshot',
      ) as unknown as Query),
      readAll(() => admin.database.from('buyer_contacts').select('id,name,email,phone') as unknown as Query),
      readAll(() => admin.database.from('order_items').select(
        'order_id,product_code,quantity',
      ) as unknown as Query),
      readAll(() => admin.database.from('products').select(
        'code,name,block,kind,team_size,sale_state',
      ) as unknown as Query),
      readAll(() => admin.database.from('payments').select(
        'id,order_id,provider,provider_payment_id,normalized_state,amount_cents,provider_updated_at,created_at',
      ) as unknown as Query),
      readAll(() => admin.database.from('registrations').select(
        'id,order_id,team_id,participant_id',
      ) as unknown as Query),
      readAll(() => admin.database.from('tickets').select(
        'id,registration_id,state,issued_at,folio',
      ) as unknown as Query),
      readAll(() =>
        (admin.database.from('outbox_delivery_jobs').select(
          'domain_event_ref,state,result,updated_at,communication_type',
        ).eq('communication_type', 'TICKET_READY') as unknown as Query)),
      readAll(() => admin.database.from('payment_verification_records').select(
        'order_id,verified_at,merchant_ownership_ok,external_reference_ok,amount_ok,currency_ok,normalized_result',
      ) as unknown as Query),
      readAll(() =>
        (admin.database.from('activity_log').select(
          'created_at,named_action,result,entity_ref,sanitized_metadata',
        ).in('named_action', [
          'CHECKOUT_PREFERENCE_ATTACHED',
          'WEBHOOK_PAYMENT_APPLIED',
          'WEBHOOK_VERIFICATION_REJECTED',
          'TICKET_REVOKED',
        ]) as unknown as Query)),
      readAll(() => admin.database.from('webhook_events').select(
        'payment_id,received_at,processed_at,signature_result,processing_state,result',
      ) as unknown as Query),
      readAll(() => admin.database.from('affiliates').select('code,name') as unknown as Query),
      readAll(() => admin.database.from('team_members').select(
        'team_id,participant_id,role,position',
      ) as unknown as Query),
      readAll(() => admin.database.from('participants').select('id,name') as unknown as Query),
      readAll(() => admin.database.from('payment_finance_adjustments').select(
        'id,order_id,payment_id,provider,provider_fee_cents,provider_fee_tax_cents,other_costs_cents,notes,source,created_by,created_at,updated_by,updated_at',
      ) as unknown as Query),
    ])

    const actorIds = new Set<string>()
    for (const row of adjustments) {
      if (typeof row.created_by === 'string') actorIds.add(row.created_by)
      if (typeof row.updated_by === 'string') actorIds.add(row.updated_by)
    }
    const actors = await loadActorLabels(baseUrl, apiKey, actorIds)

    const snapshot = assembleSalesSnapshot(
      {
        orders,
        buyers,
        items,
        products,
        payments,
        registrations,
        tickets,
        outbox,
        verifications,
        activity,
        webhooks,
        affiliates,
        members,
        participants,
        adjustments,
        actors,
      },
      new Date().toISOString(),
    )
    return json(200, snapshot, gate.headers)
  } catch {
    return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  }
}
