import { describe, expect, it } from 'vitest'

import { roleMayReadCommercialDirectory } from '../../../insforge/functions/_shared/commercial/gate.ts'
import {
  buildContacts,
  contactSearchMatch,
  contactsToCsv,
  currentFunnel,
  eventCommercialTotals,
  filterContacts,
  HISTORICAL_ATTRIBUTION,
  interestSummary,
  EMPTY_DIRECTORY_FILTERS,
  legacyFunnel,
  periodCommercial,
  registrationCountLabel,
  showDeclaredParticipants,
  type LegacyRegistration,
} from '../../../src/sales-dashboard/commercial'
import { stripAggregateIdentity } from '../../../src/sales-dashboard/port'
import { EMPTY_FILTERS, netRevenueCents, type SalesOrder } from '../../../src/sales-dashboard/model'

const now = new Date('2026-09-23T18:00:00.000Z')

function order(partial: Partial<SalesOrder> & Pick<SalesOrder, 'id' | 'state' | 'totalCents'>): SalesOrder {
  return {
    trackingRef: partial.id,
    currency: 'MXN',
    createdAt: '2026-09-20T15:00:00.000Z',
    updatedAt: null,
    expiresAt: null,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: null,
    buyerName: 'Ana López',
    buyerEmail: 'ana@example.com',
    buyerPhone: '999',
    lines: [{
      productCode: 'IND-H',
      productName: 'Individual Hombre',
      block: 'COMPITE',
      kind: 'competitor',
      saleState: 'AVAILABLE',
      teamSize: 1,
      quantity: 1,
    }],
    payments: partial.state === 'PAID' ? [{
      id: `${partial.id}-pay`,
      provider: 'MERCADOPAGO',
      providerPaymentId: 'secret-pay',
      normalizedState: 'APPROVED',
      amountCents: partial.totalCents,
      providerUpdatedAt: '2026-09-20T16:00:00.000Z',
      createdAt: '2026-09-20T16:00:00.000Z',
    }] : [],
    tickets: [],
    roster: [],
    activity: [],
    webhooks: [],
    verifications: [],
    adjustment: null,
    ...partial,
  }
}

function legacy(partial: Partial<LegacyRegistration> & Pick<LegacyRegistration, 'id' | 'originalStatus'>): LegacyRegistration {
  return {
    eventCode: 'HEX-2026',
    commercialStatus: partial.originalStatus === 'paid' ? 'LEGACY_PAID' : 'LEGACY_PENDING',
    originalCreatedAt: '2026-08-01T12:00:00.000Z',
    originalUpdatedAt: '2026-08-02T12:00:00.000Z',
    buyerContactId: null,
    name: 'Persona',
    email: 'persona@example.com',
    phone: '9990000000',
    categoryCode: 'IND-H',
    categoryName: 'Individual Hombre',
    amountCents: 100000,
    currency: 'MXN',
    ...partial,
  }
}

describe('unified commercial intelligence', () => {
  it('lets OWNER open the contact directory and keeps FINANCE on aggregates', () => {
    expect(roleMayReadCommercialDirectory('OWNER')).toBe(true)
    expect(roleMayReadCommercialDirectory('FINANCE')).toBe(false)
  })

  it('keeps the event total independent of the date range and out of reconciliation', () => {
    const current = order({ id: 'cur-1', state: 'PAID', totalCents: 150000, adjustment: null })
    const historical = legacy({ id: 'leg-1', originalStatus: 'paid', amountCents: 999900 })
    const totals = eventCommercialTotals([current], [historical], 'HEX-2026')
    const again = eventCommercialTotals([current], [historical], 'HEX-2026')
    const today = periodCommercial([current], [historical], 'HEX-2026', { ...EMPTY_FILTERS, preset: 'today' }, now, 'all')
    const month = periodCommercial([current], [historical], 'HEX-2026', EMPTY_FILTERS, now, 'all')
    expect(totals).toEqual(again)
    expect(totals.knownPaid).toBe(2)
    expect(totals.knownGrossCents).toBe(150000 + 999900)
    expect(totals.currentPendingReconciliationCount).toBe(1)
    expect(totals.currentPendingReconciliationGrossCents).toBe(150000)
    expect(totals.currentReconciledNetCents).toBe(netRevenueCents(current) ?? 0)
    expect(today.knownGrossCents).not.toBe(totals.knownGrossCents)
    expect(month.knownPaid).toBe(1)
  })

  it('treats a paid contact as a buyer and keeps every source row', () => {
    const contacts = buildContacts(
      [order({
        id: 'cur-ana',
        state: 'PAID',
        totalCents: 150000,
        buyerContactId: 'contact-ana',
        buyerEmail: 'ana@example.com',
      })],
      [
        legacy({ id: 'row-a', originalStatus: 'pending', email: 'ana@example.com', name: 'Ana López' }),
        legacy({ id: 'row-b', originalStatus: 'pending', email: 'marta@example.com', name: 'Marta' }),
        legacy({ id: 'row-c', originalStatus: 'pending', email: 'marta@example.com', name: 'Marta' }),
        legacy({ id: 'row-d', originalStatus: 'pending', email: 'otra@example.com', name: 'Ana López' }),
      ],
      'HEX-2026',
    )
    const ana = contacts.find((contact) => contact.email === 'ana@example.com')
    const marta = contacts.find((contact) => contact.email === 'marta@example.com')
    const other = contacts.find((contact) => contact.email === 'otra@example.com')
    expect(ana?.buyer).toBe(true)
    expect(ana?.opportunity).toBe(false)
    expect(ana?.legacyRecordCount).toBe(1)
    expect(marta?.legacyRecordCount).toBe(2)
    expect(marta?.opportunity).toBe(true)
    expect(other?.key).not.toBe(ana?.key)
    expect(contacts.filter((contact) => contact.opportunity)).toHaveLength(2)
  })

  it('does not merge an ambiguous email or label legacy as a direct sale', () => {
    const contacts = buildContacts(
      [
        order({ id: 'a', state: 'PAID', totalCents: 100, buyerContactId: 'c1', buyerEmail: 'shared@example.com', buyerName: 'Uno' }),
        order({ id: 'b', state: 'PAYMENT_PENDING', totalCents: 100, buyerContactId: 'c2', buyerEmail: 'shared@example.com', buyerName: 'Dos', createdAt: '2026-09-21T12:00:00.000Z' }),
      ],
      [legacy({ id: 'loose', originalStatus: 'pending', email: 'shared@example.com', buyerContactId: null })],
      'HEX-2026',
    )
    const loose = contacts.find((contact) => contact.key === 'row:loose')
    expect(loose).toBeTruthy()
    expect(loose?.partnerLabel).toBe(HISTORICAL_ATTRIBUTION)
    expect(contacts.filter((contact) => contact.email === 'shared@example.com')).toHaveLength(3)
  })

  it('counts current visitors by distinct visitor and does not invent a legacy visitor stage', () => {
    const funnel = currentFunnel(
      [order({ id: 'o1', state: 'PAID', totalCents: 100 })],
      [
        { eventCode: 'HEX-2026', visitorId: 'v1', eventType: 'LANDING_VIEW', occurredAt: '2026-09-22T12:00:00.000Z', orderId: null },
        { eventCode: 'HEX-2026', visitorId: 'v1', eventType: 'LANDING_VIEW', occurredAt: '2026-09-22T12:05:00.000Z', orderId: null },
        { eventCode: 'HEX-2026', visitorId: 'v2', eventType: 'CHECKOUT_STARTED', occurredAt: '2026-09-22T12:06:00.000Z', orderId: null },
      ],
      'HEX-2026',
      EMPTY_FILTERS,
      now,
    )
    const historical = legacyFunnel(
      [legacy({ id: 'p', originalStatus: 'paid' }), legacy({ id: 'q', originalStatus: 'pending' })],
      'HEX-2026',
      EMPTY_FILTERS,
      now,
    )
    expect(funnel.visitors).toBe(1)
    expect(funnel.orders).toBe(1)
    expect(funnel.paid).toBe(1)
    expect(historical).toEqual({ registrations: 0, paid: 0 })
    expect('visitors' in historical).toBe(false)
  })

  it('exports the filtered commercial rows without payment credentials', () => {
    const contacts = buildContacts(
      [order({ id: 'cur-1', state: 'PAID', totalCents: 150000, consentRecorded: true, firstTouch: { source: 'ig', campaign: 'launch' } })],
      [],
      'HEX-2026',
    )
    const csv = contactsToCsv(contacts)
    expect(csv).toContain('ana@example.com')
    expect(csv).toContain('recorded')
    expect(csv).toContain('ig · launch')
    expect(csv).not.toContain('secret-pay')
    expect(csv).not.toContain('providerPaymentId')
    expect(csv).not.toContain('token')
    expect(csv).toContain('registration_count')
  })

  it('keeps Eric as one buyer journey with two paid registrations', () => {
    const contacts = buildContacts([], [
      legacy({
        id: 'eric-relay',
        originalStatus: 'paid',
        name: 'Eric Gibellini',
        email: 'eric@hybrid.example',
        phone: '9991234567',
        categoryCode: 'REL-2H2M',
        categoryName: 'Relay Mixto 2H+2M',
        amountCents: 320000,
        teamName: 'SPOSI Y MORES',
        participants: 'Ana, Beto, Carla, Diego',
        hasPaymentId: true,
      }),
      legacy({
        id: 'eric-dobles',
        originalStatus: 'paid',
        name: 'Eric Gibellini',
        email: 'eric@hybrid.example',
        phone: '9991234567',
        categoryCode: 'DOB-SAB-MH',
        categoryName: 'Dobles Mixto',
        amountCents: 250000,
        teamName: 'TEAM 305',
        participants: 'Eric Gibellini, Marta Ruiz',
        hasPaymentId: true,
      }),
    ], 'HEX-2026')
    expect(contacts).toHaveLength(1)
    const eric = contacts[0]!
    expect(eric.buyer).toBe(true)
    expect(eric.opportunity).toBe(false)
    expect(eric.paidCents).toBe(570000)
    expect(eric.registrations).toHaveLength(2)
    expect(registrationCountLabel(eric)).toBe('2 inscripciones pagadas')
    expect(eric.registrations.map((row) => row.amountCents)).toEqual([320000, 250000])
  })

  it('keeps Alan as one buyer with four source rows and flags the second name', () => {
    const pending = (id: string, at: string) => legacy({
      id,
      originalStatus: 'pending',
      name: 'Alan Fernando Santillan Alba',
      email: 'alan@hybrid.example',
      phone: '9995555555',
      categoryCode: 'DOB-SAB-HH',
      categoryName: 'Dobles Hombres',
      amountCents: 250000,
      participants: 'Alan Fernando Santillan Alba, Bruno Díaz',
      originalCreatedAt: at,
      originalUpdatedAt: at,
    })
    const contacts = buildContacts([], [
      pending('alan-1', '2026-09-11T00:04:10.035Z'),
      pending('alan-2', '2026-09-11T00:06:03.621Z'),
      pending('alan-3', '2026-09-11T00:16:06.424Z'),
      legacy({
        id: 'alan-paid',
        originalStatus: 'paid',
        name: 'Bruno Díaz',
        email: 'alan@hybrid.example',
        phone: '9995555555',
        categoryCode: 'DOB-SAB-HH',
        categoryName: 'Dobles Hombres',
        amountCents: 250000,
        participants: 'Bruno Díaz, Carla Méndez',
        originalCreatedAt: '2026-09-11T00:25:59.609Z',
        originalUpdatedAt: '2026-09-11T07:23:17.966Z',
        hasPaymentId: true,
        notes: 'Pago via referencia',
      }),
    ], 'HEX-2026')
    expect(contacts).toHaveLength(1)
    const alan = contacts[0]!
    expect(alan.buyer).toBe(true)
    expect(alan.opportunity).toBe(false)
    expect(alan.sharedInbox).toBe(true)
    expect(alan.names).toEqual(['Alan Fernando Santillan Alba', 'Bruno Díaz'])
    expect(alan.registrations).toHaveLength(4)
    expect(alan.registrations.filter((row) => row.status === 'LEGACY_PENDING')).toHaveLength(3)
    expect(alan.paidCents).toBe(250000)
    expect(alan.registrations[3]?.participants).toBe('Bruno Díaz, Carla Méndez')
    expect(filterContacts([alan], { ...EMPTY_DIRECTORY_FILTERS, audience: 'opportunities' })).toHaveLength(0)
  })

  it('explains search hits and does not index participant free text', () => {
    const contacts = buildContacts([], [
      legacy({
        id: 'wod',
        originalStatus: 'pending',
        name: 'Luis Peña',
        email: 'luis@example.com',
        phone: '9992222222',
        categoryCode: 'WOD-M',
        categoryName: 'Workout Experience Mujer',
        participants: 'Luis Peña',
      }),
      legacy({
        id: 'pair',
        originalStatus: 'paid',
        name: 'Nora Díaz',
        email: 'nora@example.com',
        phone: '9981112233',
        categoryCode: 'DOB-SAB-MM',
        categoryName: 'Dobles Mujeres',
        teamName: 'FF Endurance',
        participants: 'Nora Díaz, Erika Solís',
      }),
    ], 'HEX-2026')
    const workout = contacts.find((contact) => contact.email === 'luis@example.com')!
    const pair = contacts.find((contact) => contact.email === 'nora@example.com')!
    expect(contactSearchMatch(workout, 'eri')).toEqual(['category'])
    expect(interestSummary(workout.categories, 'Workout Experience Mujer')).toBe('Workout Experience Mujer')
    expect(contactSearchMatch(pair, '998111')).toEqual(['phone'])
    expect(contactSearchMatch(pair, 'nora@')).toEqual(['email'])
    expect(contactSearchMatch(pair, 'nora')).toEqual(['name', 'email'])
    expect(contactSearchMatch(pair, 'endurance')).toEqual(['team'])
    expect(contactSearchMatch(pair, 'erika')).toEqual([])
    expect(showDeclaredParticipants('IND-H', 'Individual Hombre', 'Luis Peña', 'Luis Peña')).toBe(false)
    expect(showDeclaredParticipants('DOB-SAB-MM', 'Dobles Mujeres', 'Nora Díaz, Erika Solís', 'Nora Díaz')).toBe(true)
    expect(filterContacts(contacts, { ...EMPTY_DIRECTORY_FILTERS, search: 'eri' }).map((contact) => contact.email)).toEqual(['luis@example.com'])
  })

  it('strips directory identity from aggregate reads', () => {
    const stripped = stripAggregateIdentity([
      legacy({
        id: 'pii',
        originalStatus: 'paid',
        email: 'secret@example.com',
        phone: '9990000000',
        name: 'Nombre',
        teamName: 'Equipo',
        participants: 'Uno, Dos',
        notes: 'nota',
        hasPaymentId: true,
      }),
    ])
    expect(stripped[0]).toMatchObject({
      name: null,
      email: null,
      phone: null,
      teamName: null,
      participants: null,
      notes: null,
      hasPaymentId: false,
    })
  })
})
