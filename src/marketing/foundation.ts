/**
 * ENFORMA first-party funnel. Meta, GA4 and GHL are not the system of record.
 * eventId is the sporting event (events.id). marketingEventId dedupes one
 * funnel row. Anonymous events never carry email, phone, or name.
 * A sale is orders.state = PAID. Pending is intent, not a sale.
 * Community Partner attribution stays on orders.affiliate_code.
 *
 * Checkout integration contract (not wired):
 * marketing_context = { visitor_id, session_id, first_touch, last_touch }.
 * Buyer identity stays on the buyer-contact payload. The server validates
 * UUIDs, strips unknown attribution keys, and checks event_id + event_code
 * against events. The snapshot is written after the order commits. A bad
 * context yields no snapshot and does not block registration or payment.
 *
 * Anonymous capture contract (not wired): an edge function, never an anon
 * INSERT. Allowlisted event types only. Body cap 4 KiB. Metadata allowlist
 * and size cap. PII keys reject the payload. marketing_event_id is idempotent.
 */

export const ANONYMOUS_FUNNEL_EVENT_TYPES = [
  'LANDING_VIEW',
  'EXPERIENCE_SELECTED',
  'CATEGORY_SELECTED',
  'CHECKOUT_STARTED',
] as const

export const FUNNEL_EVENT_TYPES = [
  ...ANONYMOUS_FUNNEL_EVENT_TYPES,
  'LEAD_IDENTIFIED',
  'PAYMENT_PENDING',
  'PURCHASE',
] as const

export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number]

export const GHL_LIFECYCLE = ['LEAD', 'CHECKOUT_STARTED', 'PAYMENT_PENDING', 'PAID'] as const
export type GhlLifecycle = (typeof GHL_LIFECYCLE)[number]

export const LEGACY_HYBRID_REGISTRO = 'LEGACY_HYBRID_REGISTRO' as const

export const HYBRID_LANDING_CONSENT_SOURCE = 'HYBRID_LANDING_2026' as const
export const HYBRID_LANDING_CONSENT_VERSION = 'marketing-v1' as const

export const CAPTURE_LIMITS = {
  maxBodyBytes: 4096,
  maxMetadataBytes: 512,
  maxValueLength: 200,
} as const

const PII_KEYS = new Set(['email', 'phone', 'name', 'nombre', 'correo', 'telefono', 'whatsapp'])
const META_ALLOW = new Set(['experience', 'cta_location', 'quantity', 'format'])
const TOUCH_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'referrer',
  'landing_path',
  'capturedAt',
] as const

export type Touch = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  gclid?: string
  referrer?: string
  landing_path?: string
  capturedAt?: string
}

export type SportingEvent = {
  eventId: string
  eventCode: string
}

export type FunnelEvent = {
  marketingEventId: string
  eventId: string
  eventCode: string
  visitorId: string
  sessionId: string
  eventType: FunnelEventType
  occurredAt: string
  categoryCode: string | null
  valueCents: number | null
  currency: string | null
  firstTouch: Touch | null
  lastTouch: Touch | null
  metadata: Record<string, string | number>
}

export type MarketingContext = {
  visitor_id: string
  session_id: string
  first_touch: Touch | null
  last_touch: Touch | null
}

export type OrderAttributionSnapshot = {
  orderId: string
  eventId: string
  eventCode: string
  visitorId: string | null
  firstTouch: Touch | null
  lastTouch: Touch | null
  affiliateCode: string | null
  capturedAt: string
}

export type ConsentEvidence = {
  contactConsentAt: string | null
  contactConsentSource: string | null
  contactConsentVersion: string | null
}

export type CaptureResult =
  | { ok: true; duplicate: boolean; event: FunnelEvent }
  | { ok: false; reason: 'pii' | 'event_type' | 'uuid' | 'event' | 'size' | 'metadata' | 'body' }

export function createOpaqueId(): string {
  return crypto.randomUUID()
}

export function isOpaqueId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    && !value.includes('@')
}

export function isSale(orderState: string): boolean {
  return orderState === 'PAID'
}

export function ghlLifecycleFor(eventType: FunnelEventType): GhlLifecycle | null {
  switch (eventType) {
    case 'LEAD_IDENTIFIED':
      return 'LEAD'
    case 'CHECKOUT_STARTED':
      return 'CHECKOUT_STARTED'
    case 'PAYMENT_PENDING':
      return 'PAYMENT_PENDING'
    case 'PURCHASE':
      return 'PAID'
    default:
      return null
  }
}

export function captureMarketingConsent(checked: boolean, at: string): ConsentEvidence {
  if (!checked) {
    return {
      contactConsentAt: null,
      contactConsentSource: null,
      contactConsentVersion: null,
    }
  }
  return {
    contactConsentAt: at,
    contactConsentSource: HYBRID_LANDING_CONSENT_SOURCE,
    contactConsentVersion: HYBRID_LANDING_CONSENT_VERSION,
  }
}

export type LegacyImportRow = {
  source_system: typeof LEGACY_HYBRID_REGISTRO
  original_record_id: string
  original_status: 'paid' | 'pending'
  original_created_at: string
  original_payment_id: string | null
  utm: null
}

export function legacyImportRow(input: {
  originalRecordId: string
  originalStatus: 'paid' | 'pending'
  originalCreatedAt: string
  originalPaymentId: string | null
}): LegacyImportRow {
  return {
    source_system: LEGACY_HYBRID_REGISTRO,
    original_record_id: input.originalRecordId,
    original_status: input.originalStatus,
    original_created_at: input.originalCreatedAt,
    original_payment_id: input.originalPaymentId,
    utm: null,
  }
}

function hasPiiKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  for (const [key, child] of Object.entries(value)) {
    if (PII_KEYS.has(key.toLowerCase())) return true
    if (hasPiiKey(child)) return true
  }
  return false
}

function sanitizeTouch(value: unknown): Touch | null | undefined {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return undefined
  if (hasPiiKey(value)) return undefined
  const out: Touch = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!(TOUCH_KEYS as readonly string[]).includes(key)) continue
    if (typeof raw !== 'string') return undefined
    const trimmed = raw.slice(0, CAPTURE_LIMITS.maxValueLength)
    if (!trimmed) continue
    out[key as keyof Touch] = trimmed
  }
  return out
}

export function sanitizeMarketingContext(raw: unknown): MarketingContext | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (hasPiiKey(raw)) return null
  const body = raw as Record<string, unknown>
  if (!isOpaqueId(String(body.visitor_id ?? ''))) return null
  if (!isOpaqueId(String(body.session_id ?? ''))) return null
  const first = sanitizeTouch(body.first_touch)
  const last = sanitizeTouch(body.last_touch)
  if (first === undefined || last === undefined) return null
  return {
    visitor_id: String(body.visitor_id),
    session_id: String(body.session_id),
    first_touch: first,
    last_touch: last,
  }
}

type Store = {
  visitors: Map<string, { id: string; createdAt: string; lastSeenAt: string }>
  sessions: Map<string, { id: string; visitorId: string }>
  visitorSession: Map<string, string>
  touches: Map<string, { first: Touch | null; last: Touch | null }>
  events: FunnelEvent[]
  links: Map<string, string>
  snapshots: Map<string, OrderAttributionSnapshot>
}

export function createMarketingStore(): Store {
  return {
    visitors: new Map(),
    sessions: new Map(),
    visitorSession: new Map(),
    touches: new Map(),
    events: [],
    links: new Map(),
    snapshots: new Map(),
  }
}

export function ensureVisitor(store: Store, now: string, visitorId = createOpaqueId()): string {
  const existing = store.visitors.get(visitorId)
  if (existing) {
    existing.lastSeenAt = now
    return visitorId
  }
  store.visitors.set(visitorId, { id: visitorId, createdAt: now, lastSeenAt: now })
  store.touches.set(visitorId, { first: null, last: null })
  return visitorId
}

export function startSession(store: Store, visitorId: string, sessionId = createOpaqueId()): string {
  ensureVisitor(store, new Date().toISOString(), visitorId)
  store.sessions.set(sessionId, { id: sessionId, visitorId })
  store.visitorSession.set(visitorId, sessionId)
  return sessionId
}

export function currentSession(store: Store, visitorId: string): string | null {
  return store.visitorSession.get(visitorId) ?? null
}

export function recordTouch(store: Store, visitorId: string, touch: Touch): void {
  const at = touch.capturedAt ?? new Date().toISOString()
  ensureVisitor(store, at, visitorId)
  const slot = store.touches.get(visitorId) ?? { first: null, last: null }
  if (!slot.first) slot.first = touch
  slot.last = touch
  store.touches.set(visitorId, slot)
}

function knownEvent(known: readonly SportingEvent[], eventId: string, eventCode: string): boolean {
  return known.some((row) => row.eventId === eventId && row.eventCode === eventCode)
}

export function ingestAnonymousCapture(
  store: Store,
  raw: unknown,
  options: {
    bodyBytes: number
    knownEvents: readonly SportingEvent[]
    allowedTypes?: readonly string[]
  },
): CaptureResult {
  if (options.bodyBytes > CAPTURE_LIMITS.maxBodyBytes) return { ok: false, reason: 'size' }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'body' }
  if (hasPiiKey(raw)) return { ok: false, reason: 'pii' }
  const body = raw as Record<string, unknown>
  const marketingEventId = String(body.marketing_event_id ?? '')
  const eventId = String(body.event_id ?? '')
  const visitorId = String(body.visitor_id ?? '')
  const sessionId = String(body.session_id ?? '')
  if (!isOpaqueId(marketingEventId) || !isOpaqueId(eventId) || !isOpaqueId(visitorId) || !isOpaqueId(sessionId)) {
    return { ok: false, reason: 'uuid' }
  }
  const prior = store.events.find((row) => row.marketingEventId === marketingEventId)
  if (prior) return { ok: true, duplicate: true, event: prior }
  const eventCode = typeof body.event_code === 'string' ? body.event_code : ''
  if (!knownEvent(options.knownEvents, eventId, eventCode)) return { ok: false, reason: 'event' }
  const allowed = options.allowedTypes ?? ANONYMOUS_FUNNEL_EVENT_TYPES
  const eventType = body.event_type
  if (typeof eventType !== 'string' || !allowed.includes(eventType)) {
    return { ok: false, reason: 'event_type' }
  }
  const metadata = readMetadata(body.metadata)
  if (metadata === undefined) return { ok: false, reason: 'metadata' }
  ensureVisitor(store, new Date().toISOString(), visitorId)
  startSession(store, visitorId, sessionId)
  const touches = store.touches.get(visitorId) ?? { first: null, last: null }
  const row: FunnelEvent = {
    marketingEventId,
    eventId,
    eventCode,
    visitorId,
    sessionId,
    eventType: eventType as FunnelEventType,
    occurredAt: typeof body.occurred_at === 'string' ? body.occurred_at : new Date().toISOString(),
    categoryCode: typeof body.category_code === 'string' ? body.category_code.slice(0, 64) : null,
    valueCents: typeof body.value_cents === 'number' ? body.value_cents : null,
    currency: typeof body.currency === 'string' ? body.currency.slice(0, 3) : null,
    firstTouch: touches.first,
    lastTouch: touches.last,
    metadata,
  }
  store.events.push(row)
  return { ok: true, duplicate: false, event: row }
}

function readMetadata(value: unknown): Record<string, string | number> | undefined {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return undefined
  if (hasPiiKey(value)) return undefined
  const out: Record<string, string | number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!META_ALLOW.has(key)) return undefined
    if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
    if (typeof raw === 'string' && raw.length > CAPTURE_LIMITS.maxValueLength) return undefined
    out[key] = raw
  }
  if (JSON.stringify(out).length > CAPTURE_LIMITS.maxMetadataBytes) return undefined
  return out
}

export function linkVisitor(store: Store, visitorId: string, buyerContactId: string): void {
  if (store.links.has(visitorId)) return
  store.links.set(visitorId, buyerContactId)
}

export function prepareCheckoutAttribution(
  store: Store,
  input: {
    orderId: string
    eventId: string
    eventCode: string
    affiliateCode: string | null
    marketingContext: unknown
    knownEvents: readonly SportingEvent[]
    capturedAt: string
  },
): { blocked: false; snapshot: OrderAttributionSnapshot | null; reason: 'ok' | 'invalid_context' | 'unknown_event' | 'pii' } {
  const existing = store.snapshots.get(input.orderId)
  if (existing) return { blocked: false, snapshot: existing, reason: 'ok' }
  if (hasPiiKey(input.marketingContext)) {
    return { blocked: false, snapshot: null, reason: 'pii' }
  }
  if (!knownEvent(input.knownEvents, input.eventId, input.eventCode)) {
    return { blocked: false, snapshot: null, reason: 'unknown_event' }
  }
  const context = sanitizeMarketingContext(input.marketingContext)
  if (!context) return { blocked: false, snapshot: null, reason: 'invalid_context' }
  const row: OrderAttributionSnapshot = {
    orderId: input.orderId,
    eventId: input.eventId,
    eventCode: input.eventCode,
    visitorId: context.visitor_id,
    firstTouch: context.first_touch,
    lastTouch: context.last_touch,
    affiliateCode: input.affiliateCode,
    capturedAt: input.capturedAt,
  }
  store.snapshots.set(input.orderId, row)
  return { blocked: false, snapshot: row, reason: 'ok' }
}
