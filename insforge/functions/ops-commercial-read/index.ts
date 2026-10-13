import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import {
  classifyCommercialRead,
  roleMayReadCommercialAggregates,
  roleMayReadCommercialDirectory,
} from '../_shared/commercial/gate.ts'
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

  let body: { view?: unknown; eventCode?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'INVALID_REQUEST' }, gate.headers)
  }
  const classified = classifyCommercialRead(body.view)
  if (!classified.ok) return json(classified.status, { ok: false, error: classified.code }, gate.headers)
  const eventCode = typeof body.eventCode === 'string' && body.eventCode ? body.eventCode : 'HEX-2026'
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
  if (!roleMayReadCommercialAggregates(role)) {
    return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)
  }
  if (classified.view !== 'aggregates' && !roleMayReadCommercialDirectory(role)) {
    return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)
  }

  const legacyColumns = classified.view === 'aggregates'
    ? 'id,event_code,original_status,commercial_status,original_created_at,original_updated_at,category_code_raw,category_name_raw,amount_cents,currency'
    : 'id,event_code,original_status,commercial_status,original_created_at,original_updated_at,buyer_contact_id,original_name,original_email,original_phone,category_code_raw,category_name_raw,amount_cents,currency,team_name_raw,participants_raw,notes_raw,original_payment_id'
  const [legacyResult, funnelResult] = await Promise.all([
    admin.database
      .from('legacy_registrations')
      .select(legacyColumns)
      .eq('event_code', eventCode),
    admin.database
      .from('marketing_events')
      .select('event_code,visitor_id,event_type,occurred_at')
      .eq('event_code', eventCode),
  ])
  if (legacyResult.error || funnelResult.error) {
    return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  }
  const legacy = (Array.isArray(legacyResult.data) ? legacyResult.data : []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: record.id,
      eventCode: record.event_code,
      originalStatus: record.original_status,
      commercialStatus: record.commercial_status,
      originalCreatedAt: record.original_created_at,
      originalUpdatedAt: record.original_updated_at,
      buyerContactId: classified.view === 'aggregates' ? null : record.buyer_contact_id,
      name: classified.view === 'aggregates' ? null : record.original_name,
      email: classified.view === 'aggregates' ? null : record.original_email,
      phone: classified.view === 'aggregates' ? null : record.original_phone,
      categoryCode: record.category_code_raw,
      categoryName: record.category_name_raw,
      amountCents: record.amount_cents,
      currency: record.currency,
      teamName: classified.view === 'aggregates' ? null : record.team_name_raw ?? null,
      participants: classified.view === 'aggregates' ? null : record.participants_raw ?? null,
      notes: classified.view === 'aggregates' ? null : record.notes_raw ?? null,
      hasPaymentId: classified.view === 'aggregates'
        ? false
        : typeof record.original_payment_id === 'string' && record.original_payment_id.trim() !== '',
    }
  })
  const funnel = (Array.isArray(funnelResult.data) ? funnelResult.data : []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      eventCode: record.event_code,
      visitorId: record.visitor_id,
      eventType: record.event_type,
      occurredAt: record.occurred_at,
      orderId: null,
    }
  })
  if (classified.view === 'aggregates') {
    return json(200, {
      ok: true,
      eventCode,
      legacyPaid: legacy.filter((row) => row.commercialStatus === 'LEGACY_PAID').length,
      legacyPending: legacy.filter((row) => row.commercialStatus === 'LEGACY_PENDING').length,
      legacyGrossCents: legacy.reduce((sum, row) => (
        row.commercialStatus === 'LEGACY_PAID' && typeof row.amountCents === 'number'
          ? sum + row.amountCents
          : sum
      ), 0),
      funnelEvents: funnel.length,
      legacy,
      funnel,
    }, gate.headers)
  }
  return json(200, { ok: true, eventCode, legacy, funnel }, gate.headers)
}
