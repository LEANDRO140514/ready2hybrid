import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { checkoutRequestSchema } from '../../../insforge/functions/_shared/checkout/validate'
import { captureMarketingConsent, isSale } from '../../../src/marketing/foundation'
import { attachMarketingAfterOrder } from '../../../src/marketing/persist'

const migration = readFileSync('insforge/migrations/0034_first-party-marketing.sql', 'utf8')

describe('production activation contracts', () => {
  it('requires consent source and version exactly when a timestamp exists', () => {
    expect(migration).toContain('contact_consent_at IS NULL')
    expect(migration).toContain('contact_consent_source IS NULL')
    expect(migration).toContain('contact_consent_version IS NULL')
    expect(migration).toContain("NEW.contact_consent_source := 'HYBRID_LANDING_2026'")
    expect(migration).toContain("NEW.contact_consent_version := 'marketing-v1'")
    expect(migration).not.toContain('paid_payment_id')
    expect(migration).toContain('Do not apply 0032 or 0033 with it.')
    const executableSql = migration.replace(/--[^\n]*/g, '')
    expect(executableSql).not.toContain('0032')
    expect(executableSql).not.toContain('0033')
    const checked = captureMarketingConsent(true, '2026-09-25T06:30:00.000Z')
    const unchecked = captureMarketingConsent(false, '2026-09-25T06:30:00.000Z')
    expect(checked.contactConsentSource).toBe('HYBRID_LANDING_2026')
    expect(checked.contactConsentVersion).toBe('marketing-v1')
    expect(unchecked).toEqual({
      contactConsentAt: null,
      contactConsentSource: null,
      contactConsentVersion: null,
    })
    expect(isSale('PAID')).toBe(true)
    expect(captureMarketingConsent(false, '2026-09-25T06:30:00.000Z').contactConsentAt).toBeNull()
  })

  it('accepts a checkout body whose marketing context is ignored when it carries contact fields', async () => {
    const parsed = checkoutRequestSchema.safeParse({
      product_code: 'IND-H',
      idempotency_key: 'idem-key-123',
      buyer: { email: 'buyer@example.com', name: 'Buyer', contact_consent: false },
      marketing_context: { email: 'buyer@example.com', visitor_id: 'nope' },
    })
    expect(parsed.success).toBe(true)
    const outcome = await attachMarketingAfterOrder({
      context: { email: 'buyer@example.com' },
      knownEvents: [{ eventId: '11111111-1111-4111-8111-111111111111', eventCode: 'HEX-2026' }],
      order: {
        orderId: 'order-1',
        eventId: '11111111-1111-4111-8111-111111111111',
        eventCode: 'HEX-2026',
        buyerContactId: 'buyer-1',
        affiliateCode: 'ENFORMA',
      },
      capturedAt: '2026-09-25T06:30:00.000Z',
      write: async () => {
        throw new Error('db down')
      },
    })
    expect(outcome).toBe('skipped')
  })

  it('does not fail checkout when the marketing write throws', async () => {
    const visitor = '11111111-1111-4111-8111-111111111111'
    const session = '22222222-2222-4222-8222-222222222222'
    const outcome = await attachMarketingAfterOrder({
      context: {
        visitor_id: visitor,
        session_id: session,
        first_touch: { utm_campaign: 'launch-a' },
        last_touch: { utm_campaign: 'launch-b' },
      },
      knownEvents: [{ eventId: visitor, eventCode: 'HEX-2026' }],
      order: {
        orderId: 'order-1',
        eventId: visitor,
        eventCode: 'HEX-2026',
        buyerContactId: 'buyer-1',
        affiliateCode: 'ENFORMA',
      },
      capturedAt: '2026-09-25T06:30:00.000Z',
      write: async () => {
        throw new Error('db down')
      },
    })
    expect(outcome).toBe('failed')
  })
})
