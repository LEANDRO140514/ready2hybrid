import { describe, expect, it } from 'vitest'
import { classifyLegacyRow, planImport } from '../../../scripts/legacy-hybrid-registro/classify.mjs'

const catalog = new Set([
  'IND-H', 'IND-M', 'DOB-SAB-HH', 'WOD-M', 'FOT-SAB', 'DOB-VIE-HH', 'DOB-SAB-MM',
])

function row(overrides: Record<string, string> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    category_code: 'IND-H',
    category_name: 'Individual Hombre (Open)',
    category_bloque: 'COMPITE',
    team_name: '',
    participants: 'Atleta Uno',
    contact_name: '  Ana  ',
    contact_email: ' Ana@Example.com ',
    contact_phone: '9991234567',
    amount: '1500',
    currency: 'MXN',
    status: 'paid',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
    mp_payment_id: '1234567890',
    notes: '',
    ...overrides,
  }
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    catalogCodes: catalog,
    contactsByEmail: new Map<string, string[]>(),
    alreadyImported: new Set<string>(),
    ...overrides,
  }
}

describe('legacy hybrid registro import', () => {
  it('keeps paid and pending as legacy commercial states and preserves the payment id', () => {
    const paid = classifyLegacyRow(row(), context())
    const pending = classifyLegacyRow(row({
      id: '22222222-2222-4222-8222-222222222222',
      status: 'pending',
      mp_payment_id: '',
    }), context())
    expect(paid.commercialStatus).toBe('LEGACY_PAID')
    expect(paid.originalPaymentId).toBe('1234567890')
    expect(paid.amountCents).toBe(150000)
    expect(pending.commercialStatus).toBe('LEGACY_PENDING')
    expect(pending.originalPaymentId).toBeNull()
    expect(paid.createsOperationalRecords).toBe(false)
    expect(paid.sourceSystem).toBe('LEGACY_HYBRID_REGISTRO')
  })

  it('does not invent consent or attribution', () => {
    const item = classifyLegacyRow(row({ notes: 'pagado en efectivo' }), context())
    expect(item.consent).toBeNull()
    expect(item.attribution).toEqual({
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      fbclid: null,
      gclid: null,
      visitorId: null,
      sessionId: null,
    })
  })

  it('maps a known inactive category and reviews an unknown one', () => {
    const workout = classifyLegacyRow(row({ category_code: 'WOD-M' }), context())
    const photographer = classifyLegacyRow(row({ category_code: 'FOT-SAB' }), context())
    const unknown = classifyLegacyRow(row({ category_code: 'NOT-A-CODE' }), context())
    expect(workout.normalizedProductCode).toBe('WOD-M')
    expect(photographer.normalizedProductCode).toBe('FOT-SAB')
    expect(unknown.normalizedProductCode).toBeNull()
    expect(unknown.disposition).toBe('REVIEW_REQUIRED')
    expect(unknown.reviewReason).toContain('UNMAPPED_CATEGORY')
  })

  it('links one exact email and refuses name-only or phone-only matches', () => {
    const contacts = new Map([
      ['ana@example.com', ['contact-1']],
      ['other@example.com', ['contact-2']],
    ])
    const matched = classifyLegacyRow(row(), context({ contactsByEmail: contacts }))
    const sameName = classifyLegacyRow(row({
      id: '33333333-3333-4333-8333-333333333333',
      contact_email: 'new@example.com',
      contact_phone: '9991234567',
    }), context({ contactsByEmail: contacts }))
    expect(matched.buyerContactId).toBe('contact-1')
    expect(matched.originalEmail).toBe('ana@example.com')
    expect(matched.originalName).toBe('Ana')
    expect(matched.originalPhone).toBe('9991234567')
    expect(sameName.buyerContactId).toBeNull()
    expect(sameName.disposition).toBe('IMPORTED')
  })

  it('does not merge when the email matches more than one contact', () => {
    const contacts = new Map([['ana@example.com', ['contact-1', 'contact-2']]])
    const item = classifyLegacyRow(row(), context({ contactsByEmail: contacts }))
    expect(item.buyerContactId).toBeNull()
    expect(item.disposition).toBe('REVIEW_REQUIRED')
    expect(item.reviewReason).toContain('AMBIGUOUS_CONTACT')
  })

  it('imports each source row once and reconciles a repeated file as duplicates', () => {
    const rows = [
      row(),
      row({ id: '22222222-2222-4222-8222-222222222222', status: 'pending', mp_payment_id: '' }),
    ]
    const first = planImport(rows, context())
    expect(first.total).toBe(2)
    expect(first.imported + first.reviewRequired + first.duplicates + first.rejected).toBe(2)
    expect(first.newContacts).toBe(0)
    const second = planImport(rows, context({
      alreadyImported: new Set(rows.map((item) => item.id)),
    }))
    expect(second.duplicates).toBe(2)
    expect(second.imported).toBe(0)
    expect(second.total).toBe(second.imported + second.reviewRequired + second.duplicates + second.rejected)
  })
})
