// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildPurchaseEvent,
  fbcFromTouch,
  hashIdentifier,
  normalizeEmail,
  normalizePhone,
  type PurchaseContext,
} from '../../../insforge/functions/_shared/meta-capi/event'

const sha = (value: string) => createHash('sha256').update(value).digest('hex')

const base: PurchaseContext = {
  orderId: 'o-1',
  trackingRef: 'HEX-ABC123',
  totalCents: 275000,
  approvedAt: '2026-10-24T18:00:00.000Z',
  productCodes: ['IND-H'],
  buyerContactId: 'b-1',
  contact: { email: ' Ana@Example.COM ', phone: '999 123 4567', consent: true },
  touch: { fbclid: 'IwAR123', capturedAt: '2026-10-24T17:00:00.000Z' },
}
const URL = 'https://hybrid-experience.enforma.mx/'
const opts = {
  eventSourceUrl: URL,
  actionSource: 'system_generated' as const,
  now: new Date('2026-10-25T00:00:00Z'),
  includeContactData: false,
}
const withContact = { ...opts, includeContactData: true }

describe('identifier normalization and hashing', () => {
  it('lowercases and trims email, rejects non-emails', () => {
    expect(normalizeEmail(' Ana@Example.COM ')).toBe('ana@example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })

  it('normalizes Mexican phones to country code + 10 digits', () => {
    expect(normalizePhone('999 123 4567')).toBe('529991234567')
    expect(normalizePhone('+52 999 123 4567')).toBe('529991234567')
    expect(normalizePhone('+52 1 999 123 4567')).toBe('529991234567')
    expect(normalizePhone('52-999-123-4567')).toBe('529991234567')
  })

  it('drops phones that cannot be trusted', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })

  it('hashes with lowercase hex SHA-256', async () => {
    expect(await hashIdentifier('ana@example.com')).toBe(sha('ana@example.com'))
  })
})

describe('fbc from the stored touch', () => {
  it('builds fb.1.<click ms>.<fbclid>', () => {
    expect(fbcFromTouch({ fbclid: 'IwAR123', capturedAt: '2026-10-24T17:00:00.000Z' })).toBe(
      `fb.1.${Date.parse('2026-10-24T17:00:00.000Z')}.IwAR123`,
    )
  })

  it('returns null without fbclid or without a usable timestamp', () => {
    expect(fbcFromTouch({ capturedAt: '2026-10-24T17:00:00.000Z' })).toBeNull()
    expect(fbcFromTouch({ fbclid: 'x' })).toBeNull()
    expect(fbcFromTouch({ fbclid: 'x', capturedAt: 'garbage' })).toBeNull()
    expect(fbcFromTouch(null)).toBeNull()
  })
})

describe('buildPurchaseEvent', () => {
  it('uses tracking_ref as event_id and the approval time as event_time', async () => {
    const built = await buildPurchaseEvent(base, opts)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.event.event_name).toBe('Purchase')
    expect(built.event.event_id).toBe('HEX-ABC123')
    expect(built.event.event_time).toBe(Math.floor(Date.parse(base.approvedAt!) / 1000))
    expect(built.event.action_source).toBe('system_generated')
    expect(built.event.event_source_url).toBe(URL)
  })

  it('sends value in pesos with MXN and the product codes', async () => {
    const built = await buildPurchaseEvent(base, opts)
    if (!built.ok) throw new Error('expected ok')
    expect(built.event.custom_data).toEqual({
      currency: 'MXN',
      value: 2750,
      content_ids: ['IND-H'],
      content_type: 'product',
      num_items: 1,
    })
  })

  it('sends no email or phone by default, even for a buyer who gave marketing consent', async () => {
    const built = await buildPurchaseEvent(base, opts)
    if (!built.ok) throw new Error('expected ok')
    expect(built.event.user_data.em).toBeUndefined()
    expect(built.event.user_data.ph).toBeUndefined()
    const text = JSON.stringify(built.event)
    expect(text).not.toContain(sha('ana@example.com'))
    expect(text).not.toContain(sha('529991234567'))
    expect(text).not.toContain('ana@example.com')
    expect(text).not.toContain('9991234567')
    expect(built.event.user_data.external_id).toEqual([sha('b-1')])
  })

  it('with the contact switch on, hashes email and phone only with consent and never ships raw PII', async () => {
    const built = await buildPurchaseEvent(base, withContact)
    if (!built.ok) throw new Error('expected ok')
    expect(built.event.user_data.em).toEqual([sha('ana@example.com')])
    expect(built.event.user_data.ph).toEqual([sha('529991234567')])
    const text = JSON.stringify(built.event)
    expect(text).not.toContain('ana@example.com')
    expect(text).not.toContain('Ana@Example')
    expect(text).not.toContain('9991234567')
  })

  it('with the contact switch on, still omits email and phone when there is no marketing consent', async () => {
    const ctx = { ...base, contact: { ...base.contact!, consent: false } }
    const built = await buildPurchaseEvent(ctx, withContact)
    if (!built.ok) throw new Error('expected ok')
    expect(built.event.user_data.em).toBeUndefined()
    expect(built.event.user_data.ph).toBeUndefined()
  })

  it('always carries a pseudonymous external_id so Meta never rejects it as anonymous', async () => {
    const ctx = { ...base, contact: null, touch: null }
    const built = await buildPurchaseEvent(ctx, opts)
    if (!built.ok) throw new Error('expected ok')
    expect(built.event.user_data.external_id).toEqual([sha('b-1')])
    expect(built.event.user_data.fbc).toBeUndefined()
  })

  it('adds fbc when the touch has a click id', async () => {
    const built = await buildPurchaseEvent(base, opts)
    if (!built.ok) throw new Error('expected ok')
    expect(built.event.user_data.fbc).toBe(`fb.1.${Date.parse('2026-10-24T17:00:00.000Z')}.IwAR123`)
  })

  it('skips events Meta would reject: older than 7 days, zero value, no approval time', async () => {
    expect(await buildPurchaseEvent(base, { ...opts, now: new Date('2026-11-05T00:00:00Z') })).toEqual({
      ok: false,
      reason: 'TOO_OLD',
    })
    expect(await buildPurchaseEvent({ ...base, totalCents: 0 }, opts)).toEqual({ ok: false, reason: 'ZERO_VALUE' })
    expect(await buildPurchaseEvent({ ...base, approvedAt: null }, opts)).toEqual({
      ok: false,
      reason: 'NO_APPROVAL_TIME',
    })
  })
})
