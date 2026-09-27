import { describe, expect, it } from 'vitest'

import {
  CAPTURE_LIMITS,
  captureMarketingConsent,
  createMarketingStore,
  createOpaqueId,
  currentSession,
  ensureVisitor,
  ingestAnonymousCapture,
  isOpaqueId,
  isSale,
  legacyImportRow,
  linkVisitor,
  prepareCheckoutAttribution,
  recordTouch,
  sanitizeMarketingContext,
  startSession,
  type SportingEvent,
} from '../../../src/marketing/foundation'

const NOW = '2026-09-25T06:30:00.000Z'
const LATER = '2026-09-25T07:00:00.000Z'
const HEX: SportingEvent = { eventId: createOpaqueId(), eventCode: 'HEX-2026' }
const NEXT: SportingEvent = { eventId: createOpaqueId(), eventCode: 'HEX-2027' }

function touch(campaign: string, at: string) {
  return {
    utm_source: 'meta',
    utm_medium: 'paid',
    utm_campaign: campaign,
    referrer: 'https://instagram.com/',
    landing_path: '/',
    capturedAt: at,
  }
}

function captureBody(event: SportingEvent, marketingEventId: string, extra: Record<string, unknown> = {}) {
  return {
    marketing_event_id: marketingEventId,
    event_id: event.eventId,
    event_code: event.eventCode,
    visitor_id: createOpaqueId(),
    session_id: createOpaqueId(),
    event_type: 'LANDING_VIEW',
    occurred_at: NOW,
    ...extra,
  }
}

describe('first-party marketing foundation', () => {
  it('keeps a sporting event id distinct from the funnel idempotency key', () => {
    const store = createMarketingStore()
    const visitorId = ensureVisitor(store, NOW)
    const first = startSession(store, visitorId)
    const next = startSession(store, visitorId, createOpaqueId())
    expect(isOpaqueId(visitorId)).toBe(true)
    expect(currentSession(store, visitorId)).toBe(next)
    expect(next).not.toBe(first)

    const marketingEventId = createOpaqueId()
    const saved = ingestAnonymousCapture(store, captureBody(HEX, marketingEventId, {
      visitor_id: visitorId,
      session_id: next,
    }), { bodyBytes: 400, knownEvents: [HEX, NEXT] })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.event.eventId).toBe(HEX.eventId)
    expect(saved.event.eventCode).toBe('HEX-2026')
    expect(saved.event.marketingEventId).toBe(marketingEventId)
    expect(saved.event.marketingEventId).not.toBe(saved.event.eventId)
  })

  it('stores the same visitor under two sporting events and dedupes a retry', () => {
    const store = createMarketingStore()
    const key = createOpaqueId()
    const first = ingestAnonymousCapture(store, captureBody(HEX, key), {
      bodyBytes: 400,
      knownEvents: [HEX, NEXT],
    })
    const retry = ingestAnonymousCapture(store, captureBody(HEX, key, { event_type: 'PURCHASE' }), {
      bodyBytes: 400,
      knownEvents: [HEX, NEXT],
    })
    const other = ingestAnonymousCapture(store, captureBody(NEXT, createOpaqueId()), {
      bodyBytes: 400,
      knownEvents: [HEX, NEXT],
    })
    expect(first.ok && retry.ok && other.ok).toBe(true)
    if (!first.ok || !retry.ok || !other.ok) return
    expect(retry.duplicate).toBe(true)
    expect(retry.event.eventType).toBe('LANDING_VIEW')
    expect(store.events).toHaveLength(2)
    expect(store.events.map((row) => row.eventCode).sort()).toEqual(['HEX-2026', 'HEX-2027'])
  })

  it('keeps first touch and updates last touch', () => {
    const store = createMarketingStore()
    const visitorId = ensureVisitor(store, NOW)
    recordTouch(store, visitorId, touch('launch-a', NOW))
    recordTouch(store, visitorId, touch('launch-b', LATER))
    const saved = ingestAnonymousCapture(store, captureBody(HEX, createOpaqueId(), {
      visitor_id: visitorId,
      session_id: startSession(store, visitorId),
    }), { bodyBytes: 400, knownEvents: [HEX] })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.event.firstTouch?.utm_campaign).toBe('launch-a')
    expect(saved.event.lastTouch?.utm_campaign).toBe('launch-b')
  })

  it('records consent evidence only when the box is checked', () => {
    const checked = captureMarketingConsent(true, NOW)
    const unchecked = captureMarketingConsent(false, NOW)
    expect(checked).toEqual({
      contactConsentAt: NOW,
      contactConsentSource: 'HYBRID_LANDING_2026',
      contactConsentVersion: 'marketing-v1',
    })
    expect(unchecked.contactConsentAt).toBeNull()
    expect(unchecked.contactConsentSource).toBeNull()
    expect(unchecked.contactConsentVersion).toBeNull()
    expect(isSale('PAID')).toBe(true)
    expect(captureMarketingConsent(false, NOW).contactConsentAt).toBeNull()
  })

  it('drops a marketing context that carries contact fields and still allows checkout', () => {
    const visitorId = createOpaqueId()
    const sessionId = createOpaqueId()
    const clean = sanitizeMarketingContext({
      visitor_id: visitorId,
      session_id: sessionId,
      first_touch: touch('launch-a', NOW),
      last_touch: touch('launch-a', NOW),
      email: 'person@example.com',
    })
    expect(clean).toBeNull()
    const store = createMarketingStore()
    const blocked = prepareCheckoutAttribution(store, {
      orderId: 'order-pii',
      eventId: HEX.eventId,
      eventCode: HEX.eventCode,
      affiliateCode: 'ENFORMA',
      marketingContext: { visitor_id: visitorId, session_id: sessionId, email: 'person@example.com' },
      knownEvents: [HEX],
      capturedAt: NOW,
    })
    expect(blocked.blocked).toBe(false)
    expect(blocked.snapshot).toBeNull()
    expect(blocked.reason).toBe('pii')
  })

  it('writes one immutable order snapshot and keeps the affiliate code on it', () => {
    const store = createMarketingStore()
    const visitorId = createOpaqueId()
    const sessionId = createOpaqueId()
    const context = {
      visitor_id: visitorId,
      session_id: sessionId,
      first_touch: touch('launch-a', NOW),
      last_touch: touch('launch-a', NOW),
    }
    const first = prepareCheckoutAttribution(store, {
      orderId: 'order-1',
      eventId: HEX.eventId,
      eventCode: HEX.eventCode,
      affiliateCode: 'ENFORMA',
      marketingContext: context,
      knownEvents: [HEX],
      capturedAt: NOW,
    })
    const second = prepareCheckoutAttribution(store, {
      orderId: 'order-1',
      eventId: NEXT.eventId,
      eventCode: NEXT.eventCode,
      affiliateCode: 'OTHER',
      marketingContext: {
        ...context,
        last_touch: touch('launch-b', LATER),
      },
      knownEvents: [HEX, NEXT],
      capturedAt: LATER,
    })
    expect(first.blocked).toBe(false)
    expect(second.snapshot).toEqual(first.snapshot)
    expect(first.snapshot?.eventId).toBe(HEX.eventId)
    expect(first.snapshot?.affiliateCode).toBe('ENFORMA')
    expect(first.snapshot?.lastTouch?.utm_campaign).toBe('launch-a')
    expect(JSON.stringify(first.snapshot)).not.toContain('@')
  })

  it('rejects anonymous payloads that include contact fields or an unknown event type', () => {
    const store = createMarketingStore()
    const pii = ingestAnonymousCapture(store, captureBody(HEX, createOpaqueId(), {
      metadata: { email: 'person@example.com', experience: 'compite' },
    }), { bodyBytes: 400, knownEvents: [HEX] })
    const click = ingestAnonymousCapture(store, captureBody(HEX, createOpaqueId(), {
      event_type: 'BUTTON_CLICK',
    }), { bodyBytes: 200, knownEvents: [HEX] })
    const huge = ingestAnonymousCapture(store, captureBody(HEX, createOpaqueId()), {
      bodyBytes: CAPTURE_LIMITS.maxBodyBytes + 1,
      knownEvents: [HEX],
    })
    expect(pii).toEqual({ ok: false, reason: 'pii' })
    expect(click).toEqual({ ok: false, reason: 'event_type' })
    expect(huge).toEqual({ ok: false, reason: 'size' })
    expect(store.events).toHaveLength(0)
    linkVisitor(store, ensureVisitor(store, NOW), 'contact-1')
  })

  it('rejects purchase, a bad uuid, an unknown event, and oversized metadata on the anonymous endpoint', () => {
    const store = createMarketingStore()
    const known = [HEX]
    const purchase = ingestAnonymousCapture(store, captureBody(HEX, createOpaqueId(), { event_type: 'PURCHASE' }), {
      bodyBytes: 300,
      knownEvents: known,
    })
    const uuid = ingestAnonymousCapture(store, captureBody(HEX, 'not-a-uuid'), {
      bodyBytes: 300,
      knownEvents: known,
    })
    const foreign = ingestAnonymousCapture(store, captureBody(NEXT, createOpaqueId()), {
      bodyBytes: 300,
      knownEvents: known,
    })
    const metadata = ingestAnonymousCapture(store, captureBody(HEX, createOpaqueId(), {
      metadata: { experience: 'x'.repeat(CAPTURE_LIMITS.maxMetadataBytes) },
    }), { bodyBytes: 800, knownEvents: known })
    expect(purchase).toMatchObject({ ok: false, reason: 'event_type' })
    expect(uuid).toMatchObject({ ok: false, reason: 'uuid' })
    expect(foreign).toMatchObject({ ok: false, reason: 'event' })
    expect(metadata).toMatchObject({ ok: false, reason: 'metadata' })
    expect(store.events).toHaveLength(0)
  })

  it('keeps a pending legacy row without invented UTMs', () => {
    const row = legacyImportRow({
      originalRecordId: 'legacy-1',
      originalStatus: 'pending',
      originalCreatedAt: '2025-11-01T15:00:00.000Z',
      originalPaymentId: 'mp-123',
    })
    expect(row.source_system).toBe('LEGACY_HYBRID_REGISTRO')
    expect(row.original_status).toBe('pending')
    expect(row.original_created_at).toBe('2025-11-01T15:00:00.000Z')
    expect(row.original_payment_id).toBe('mp-123')
    expect(row.utm).toBeNull()
    expect(isSale('PAYMENT_PENDING')).toBe(false)
  })
})
