import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { accessInputsFromTables } from '../../../src/access/assemble'
import { roleMayReadAccess } from '../../../src/access/gate'
import {
  accessListToCsv,
  buildAccessList,
  categoryLabel,
  filterAccessPeople,
  groupAccessPeople,
  type AccessLegacyInput,
  type AccessOrderInput,
} from '../../../src/access/list'
import { approvedWithoutTicket } from '../../../src/sales-dashboard/source-ledger'

const julianOrder: AccessOrderInput = {
  id: '0fc38f29-394e-4802-aa4d-21822de213f6',
  state: 'REQUIRES_REVIEW',
  manual: true,
  productCode: 'DOB-SAB-HH',
  productName: 'Dobles Hombres · Sábado',
  team: null,
  buyerName: 'Julian Alberto Alcocer Vazquez',
  buyerEmail: 'alcocer.consultorialegal@outlook.com',
  buyerPhone: '9990000000',
  approvedPaymentIds: ['182736992364'],
  reference: null,
  people: ['Julian Alberto Alcocer Vazquez', 'Luis Fernando Zumarraga Manzanero'],
}

const julianLegacy: AccessLegacyInput = {
  recordId: 'fe4bf2a5-6679-432b-a0ee-9355132f8e26',
  commercialStatus: 'LEGACY_PAID',
  courtesy: false,
  name: 'Julián Alberto Alcocer Vázquez',
  email: 'alcocer.consultorialegal@outlook.com',
  phone: '9990000000',
  categoryCode: 'DOB-SAB-HH',
  categoryName: 'Dobles Hombres · Sábado',
  teamName: 'Los Toros',
  participants: '["Julián Alberto Alcocer Vázquez","Luis Fernando Zumarraga Manzanero"]',
  paymentId: '182736992364',
}

describe('access list', () => {
  it('lists Julián and Luis once, from the legacy ticket', () => {
    const people = buildAccessList([julianOrder], [julianLegacy])
    expect(people.map((person) => person.name)).toEqual([
      'Luis Fernando Zumarraga Manzanero',
      'Julián Alberto Alcocer Vázquez',
    ])
    expect(people.every((person) => person.origin === 'Legacy')).toBe(true)
    expect(people.every((person) => person.reference === julianLegacy.recordId)).toBe(true)
    expect(people.every((person) => person.team === 'Los Toros')).toBe(true)
    expect(people.every((person) => person.session === 'Sábado' && person.sessionDate === '2026-11-14')).toBe(true)
    expect(people[1]?.email).toBe('alcocer.consultorialegal@outlook.com')
    expect(people[0]?.email).toBeNull()
    expect(JSON.stringify(people)).not.toMatch(/amount|cents|total/i)
  })

  it('drops a refunded order and a cancelled legacy row', () => {
    const people = buildAccessList(
      [{
        ...julianOrder,
        id: 'refund',
        state: 'REFUNDED',
        manual: false,
        approvedPaymentIds: ['999'],
        people: ['Devuelto'],
        reference: 'tkt_refund',
      }],
      [{
        ...julianLegacy,
        recordId: 'cancelled',
        commercialStatus: 'LEGACY_CANCELLED',
        paymentId: '888',
        participants: 'Cancelado',
      }],
    )
    expect(people).toEqual([])
  })

  it('keeps a courtesy inscription and labels it', () => {
    const people = buildAccessList([], [{
      ...julianLegacy,
      recordId: 'courtesy-1',
      courtesy: true,
      paymentId: '0',
      name: 'Carol Cauich',
      participants: 'Carol Cauich',
      teamName: null,
      categoryCode: 'IND-M',
      categoryName: 'Individual Mujer',
    }])
    expect(people).toHaveLength(1)
    expect(people[0]?.origin).toBe('Cortesía')
  })

  it('prefers the Ready2Hybrid ticket when that order is PAID', () => {
    const people = buildAccessList(
      [{
        ...julianOrder,
        state: 'PAID',
        manual: false,
        reference: 'tkt_paid',
        people: ['Ana Victoria Sosa Baeza'],
        team: 'Equipo',
      }],
      [julianLegacy],
    )
    expect(people.map((person) => person.reference)).toEqual(['tkt_paid'])
    expect(people[0]?.origin).toBe('Checkout')
  })

  it('searches name, phone and reference, and exports a dated CSV', () => {
    const people = buildAccessList([julianOrder], [julianLegacy])
    expect(filterAccessPeople(people, 'zumarraga').map((person) => person.name)).toEqual([
      'Luis Fernando Zumarraga Manzanero',
    ])
    expect(filterAccessPeople(people, 'fe4bf2a5')).toHaveLength(2)
    const csv = accessListToCsv(people)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('14/11/2026')
    expect(csv).not.toMatch(/\$|amount|cents/)
  })

  it('says whose partner a member without contact is', () => {
    const pair = buildAccessList([], [{ ...julianLegacy, name: 'Julián Alberto Alcocer Vázquez' }])
    const luis = pair.find((person) => person.name.startsWith('Luis'))
    const julian = pair.find((person) => person.name.startsWith('Julián'))
    expect(luis?.contactNote).toBe('Pareja de: Julián Alberto Alcocer Vázquez')
    expect(julian?.contactNote).toBeNull()

    const relay = buildAccessList([], [{
      ...julianLegacy,
      recordId: 'relay',
      paymentId: null,
      categoryCode: 'REL-4H',
      categoryName: 'Relay 4 Hombres',
      name: 'Capitán Uno',
      participants: 'Capitán Uno, Dos, Tres, Cuatro',
    }])
    expect(relay.find((person) => person.name === 'Dos')?.contactNote).toBe('Equipo de: Capitán Uno')
    expect(relay.find((person) => person.name === 'Capitán Uno')?.email).toBe(julianLegacy.email)
  })

  it('uses one category label for checkout and legacy, without the day', () => {
    expect(categoryLabel('Dobles Hombres · Sábado')).toBe('Dobles Hombres')
    expect(categoryLabel('Fotógrafo — Sábado')).toBe('Fotógrafo')
    expect(categoryLabel('Individual Hombre (Open)')).toBe('Individual Hombre')
    expect(categoryLabel('Dobles Mujeres · Viernes (superseded schedule)')).toBe('Dobles Mujeres')
    expect(categoryLabel('Público — Pase 3 Días')).toBe(categoryLabel('Público · Pase 3 Días'))
    const people = buildAccessList(
      [{ ...julianOrder, state: 'PAID', manual: false, reference: 'tkt', people: ['Otra Persona'] }],
      [{ ...julianLegacy, recordId: 'leg', paymentId: null, participants: 'Alguien Más', name: 'Alguien Más' }],
    )
    expect(new Set(people.map((person) => person.category))).toEqual(new Set(['Dobles Hombres']))
    expect(people.every((person) => person.session === 'Sábado')).toBe(true)
  })

  it('lists nobody twice when checkout and legacy both carry them', () => {
    const people = buildAccessList(
      [{ ...julianOrder, state: 'PAID', manual: false, reference: 'tkt', approvedPaymentIds: ['111'], people: ['Ana Sosa'], buyerName: 'Ana Sosa' }],
      [{ ...julianLegacy, recordId: 'dup', paymentId: '222', name: 'ANA SOSA', participants: 'Ana  Sosa' }],
    )
    expect(people.filter((person) => person.name.toLowerCase().includes('sosa'))).toHaveLength(1)
    expect(people[0]?.origin).toBe('Checkout')
  })

  it('orders by day, then category, then team, and groups the same way for print', () => {
    const make = (name: string, category: string, team: string | null, code: string) => ({
      ...julianLegacy,
      recordId: name,
      paymentId: null,
      name,
      participants: name,
      categoryCode: code,
      categoryName: category,
      teamName: team,
    })
    const people = buildAccessList([], [
      make('Zoe Uno', 'Individual Mujer', null, 'IND-M'),
      make('Beto Dos', 'Dobles Hombres', 'Zorros', 'DOB-VIE-HH'),
      make('Ana Tres', 'Dobles Hombres', 'Águilas', 'DOB-SAB-HH'),
      make('Cai Cuatro', 'Dobles Hombres', 'Águilas', 'DOB-SAB-HH'),
    ])
    const groups = groupAccessPeople(people)
    expect(groups.map((group) => group.day)).toEqual(['Viernes', 'Sábado', 'Sin día'])
    const saturday = groups.find((group) => group.day === 'Sábado')!
    expect(saturday.categories[0]?.category).toBe('Dobles Hombres')
    expect(saturday.categories[0]?.teams[0]).toMatchObject({ team: 'Águilas' })
    expect(saturday.categories[0]?.teams[0]?.people.map((person) => person.name)).toEqual(['Cai Cuatro', 'Ana Tres'])
  })

  it('hides a hand-resolved order from the unpaid-approved banner', () => {
    const orders = [
      { id: julianOrder.id, state: 'REQUIRES_REVIEW', payments: [{ normalizedState: 'APPROVED' }] },
      { id: 'open', state: 'REQUIRES_REVIEW', payments: [{ normalizedState: 'APPROVED' }] },
    ]
    expect(approvedWithoutTicket(orders, new Set([julianOrder.id])).map((order) => order.id)).toEqual(['open'])
  })

  it('rejects finance and allows reception roles', () => {
    expect(roleMayReadAccess('OWNER')).toBe(true)
    expect(roleMayReadAccess('OPERATIONS_MANAGER')).toBe(true)
    expect(roleMayReadAccess('CHECKIN_STAFF')).toBe(true)
    expect(roleMayReadAccess('FINANCE')).toBe(false)
    expect(roleMayReadAccess('MARKETING')).toBe(false)
  })

  it('builds Julián from table rows and never selects money columns', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'insforge/functions/ops-access-read/index.ts'),
      'utf8',
    )
    const gate = source.indexOf('roleMayReadAccess(role)')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(source.indexOf("from('orders')"))
    expect(source).not.toMatch(/amount_cents|total_cents/)
    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\(/)

    const input = accessInputsFromTables({
      orders: [{ id: julianOrder.id, state: 'REQUIRES_REVIEW', buyer_contact_id: 'buyer' }],
      payments: [{ order_id: julianOrder.id, provider_payment_id: '182736992364', normalized_state: 'APPROVED', amount_cents: 250000 }],
      manuals: [{ order_id: julianOrder.id }],
      registrations: [{ id: 'reg', order_id: julianOrder.id, state: 'CANCELLED', product_code: 'DOB-SAB-HH', participant_id: 'p1', team_id: 'team' }],
      participants: [
        { id: 'p1', name: 'Julian Alberto Alcocer Vazquez' },
        { id: 'p2', name: 'Luis Fernando Zumarraga Manzanero' },
      ],
      members: [
        { team_id: 'team', participant_id: 'p1', state: 'COMPLETE' },
        { team_id: 'team', participant_id: 'p2', state: 'COMPLETE' },
      ],
      teams: [{ id: 'team', name: '', product_code: 'DOB-SAB-HH' }],
      contacts: [{ id: 'buyer', name: 'Julian Alberto Alcocer Vazquez', email: 'alcocer.consultorialegal@outlook.com', phone: '9990000000' }],
      tickets: [],
      products: [{ code: 'DOB-SAB-HH', name: 'Dobles Hombres · Sábado' }],
      legacy: [{
        id: 'mirror',
        original_record_id: julianLegacy.recordId,
        commercial_status: 'LEGACY_PAID',
        courtesy: false,
        original_name: julianLegacy.name,
        original_email: julianLegacy.email,
        original_phone: julianLegacy.phone,
        normalized_product_code: 'DOB-SAB-HH',
        category_name_raw: julianLegacy.categoryName,
        team_name_raw: 'Los Toros',
        participants_raw: julianLegacy.participants,
        original_payment_id: '182736992364',
        amount_cents: 250000,
      }],
    })
    const people = buildAccessList(input.orders, input.legacy)
    expect(people).toHaveLength(2)
    expect(people.map((person) => person.origin)).toEqual(['Legacy', 'Legacy'])
  })
})
