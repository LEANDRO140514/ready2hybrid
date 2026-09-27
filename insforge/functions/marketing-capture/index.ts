import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import { createMarketingStore, ingestAnonymousCapture, recordTouch, sanitizeMarketingContext } from '../../../src/marketing/foundation.ts'
import {
  gateRequestOrigin,
  originNotAllowedResponse,
  readConfiguredOrigin,
} from '../_shared/http/origin-guard.ts'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

const ALLOW_METHODS = 'POST, OPTIONS'
const ALLOW_HEADERS = 'Content-Type'
const MAX_BODY = 4096

function gateOrigin(req: Request) {
  const allowedOrigin = readConfiguredOrigin(env, 'CHECKOUT_CORS_ORIGIN')
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    const gate = gateOrigin(req)
    if (!gate.ok) return gate.kind === 'MISSING_CONFIG' ? json(503, { ok: false }, { 'Content-Type': 'application/json' }) : originNotAllowedResponse()
    return new Response(null, { status: 204, headers: gate.headers })
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, reason: 'method' }, { 'Content-Type': 'application/json' })
  }
  const gate = gateOrigin(req)
  if (!gate.ok) {
    return gate.kind === 'MISSING_CONFIG'
      ? json(503, { ok: false }, { 'Content-Type': 'application/json' })
      : originNotAllowedResponse()
  }

  const text = await req.text()
  if (text.length > MAX_BODY) return json(413, { ok: false, reason: 'size' }, gate.headers)
  let raw: Record<string, unknown>
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json(400, { ok: false, reason: 'body' }, gate.headers)
    }
    raw = parsed as Record<string, unknown>
  } catch {
    return json(400, { ok: false, reason: 'body' }, gate.headers)
  }

  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) return json(503, { ok: false }, gate.headers)
  const admin = createAdminClient({ baseUrl, apiKey })
  const eventCode = typeof raw.event_code === 'string' ? raw.event_code : ''
  const { data: events, error: eventError } = await admin.database
    .from('events')
    .select('id,code')
    .eq('code', eventCode)
    .limit(1)
  const event = (events?.[0] ?? null) as { id?: string; code?: string } | null
  if (eventError || !event?.id || event.code !== eventCode) {
    return json(400, { ok: false, reason: 'event' }, gate.headers)
  }
  if (typeof raw.event_id === 'string' && raw.event_id !== event.id) {
    return json(400, { ok: false, reason: 'event' }, gate.headers)
  }
  raw.event_id = event.id

  const store = createMarketingStore()
  const context = sanitizeMarketingContext({
    visitor_id: raw.visitor_id,
    session_id: raw.session_id,
    first_touch: raw.first_touch ?? null,
    last_touch: raw.last_touch ?? null,
  })
  if (context?.first_touch) recordTouch(store, context.visitor_id, context.first_touch)
  if (context?.last_touch && context.last_touch !== context.first_touch) {
    recordTouch(store, context.visitor_id, context.last_touch)
  }
  const parsed = ingestAnonymousCapture(store, raw, {
    bodyBytes: text.length,
    knownEvents: [{ eventId: event.id, eventCode }],
  })
  if (!parsed.ok) return json(400, { ok: false, reason: parsed.reason }, gate.headers)

  const row = parsed.event
  const { data: existing } = await admin.database
    .from('marketing_events')
    .select('marketing_event_id')
    .eq('marketing_event_id', row.marketingEventId)
    .limit(1)
  if (Array.isArray(existing) && existing.length > 0) {
    return json(200, { ok: true, duplicate: true }, gate.headers)
  }

  await admin.database.from('marketing_visitors').insert([{ id: row.visitorId }])
  await admin.database.from('marketing_sessions').insert([{ id: row.sessionId, visitor_id: row.visitorId }])
  const { error } = await admin.database.from('marketing_events').insert([{
    marketing_event_id: row.marketingEventId,
    event_id: row.eventId,
    event_code: row.eventCode,
    visitor_id: row.visitorId,
    session_id: row.sessionId,
    event_type: row.eventType,
    occurred_at: row.occurredAt,
    category_code: row.categoryCode,
    value_cents: row.valueCents,
    currency: row.currency,
    first_touch: row.firstTouch ?? {},
    last_touch: row.lastTouch ?? {},
    metadata: row.metadata,
  }])
  if (error) {
    const message = String(error.message ?? '')
    if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
      return json(200, { ok: true, duplicate: true }, gate.headers)
    }
    console.warn('marketing-capture write skipped')
    return json(200, { ok: true, stored: false }, gate.headers)
  }
  return json(200, { ok: true, duplicate: false }, gate.headers)
}
