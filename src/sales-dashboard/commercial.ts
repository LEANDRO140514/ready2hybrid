/**
 * Commercial intelligence for one sporting event.
 * Current finance reconciliation is not computed here.
 * Legacy paid amounts are historical reported revenue only.
 *
 * Legacy paid date is originalUpdatedAt: the old landing created the row as
 * pending and a person later marked it paid. That timestamp is the historical
 * confirmation time, not a provider settlement time.
 * Legacy pending date is originalCreatedAt.
 */
import {
  approvedAt,
  isSale,
  netRevenueCents,
  participantCount,
  productLabel,
  rangeForFilters,
  type SalesFilters,
  type SalesOrder,
} from './model'

export const ACTIVE_EVENT_CODE = 'HEX-2026'
export const LEGACY_SOURCE = 'LEGACY_HYBRID_REGISTRO'
export const CURRENT_SOURCE = 'READY2HYBRID'
export const HISTORICAL_ATTRIBUTION = 'Sin atribución histórica'

export type LegacyRegistration = {
  id: string
  eventCode: string
  originalStatus: string
  commercialStatus: 'LEGACY_PAID' | 'LEGACY_PENDING' | null
  originalCreatedAt: string | null
  originalUpdatedAt: string | null
  buyerContactId: string | null
  name: string | null
  email: string | null
  phone: string | null
  categoryCode: string | null
  categoryName: string | null
  amountCents: number | null
  currency: string | null
  teamName?: string | null
  participants?: string | null
  notes?: string | null
  hasPaymentId?: boolean
}

export type FunnelEvent = {
  eventCode: string
  visitorId: string
  eventType: string
  occurredAt: string
  orderId: string | null
}

export type CommercialStatus =
  | 'CURRENT_PAID'
  | 'LEGACY_PAID'
  | 'CURRENT_PENDING'
  | 'LEGACY_PENDING'

const RANK: Record<CommercialStatus, number> = {
  CURRENT_PAID: 4,
  LEGACY_PAID: 3,
  CURRENT_PENDING: 2,
  LEGACY_PENDING: 1,
}

export type JourneyItem = {
  at: string
  source: typeof LEGACY_SOURCE | typeof CURRENT_SOURCE
  title: string
  detail: string | null
}

export type ContactRegistration = {
  id: string
  source: typeof LEGACY_SOURCE | typeof CURRENT_SOURCE
  name: string | null
  email: string | null
  phone: string | null
  category: string
  categoryCode: string | null
  status: CommercialStatus
  amountCents: number
  at: string | null
  confirmedAt: string | null
  teamName: string | null
  participants: string | null
  notes: string | null
  hasPaymentId: boolean
}

export type SearchField = 'name' | 'email' | 'phone' | 'category' | 'team'

export type CommercialContact = {
  key: string
  name: string | null
  names: string[]
  email: string | null
  phone: string | null
  phones: string[]
  sharedInbox: boolean
  status: CommercialStatus
  buyer: boolean
  opportunity: boolean
  categoryLabel: string
  categories: string[]
  teamNames: string[]
  productCode: string | null
  partnerLabel: string
  consent: 'recorded' | 'not-recorded'
  firstAt: string | null
  lastAt: string | null
  paidCents: number
  legacyRecordCount: number
  currentRecordCount: number
  firstTouch: string | null
  lastTouch: string | null
  journey: JourneyItem[]
  registrations: ContactRegistration[]
}

export type DirectoryFilters = {
  audience: 'all' | 'buyers' | 'opportunities'
  origin: 'all' | 'current' | 'legacy'
  status: 'all' | CommercialStatus
  consent: 'all' | 'recorded' | 'not-recorded'
  productCode: string
  partner: string
  search: string
}

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  audience: 'all',
  origin: 'all',
  status: 'all',
  consent: 'all',
  productCode: '',
  partner: '',
  search: '',
}

export type CommercialSource = 'all' | 'current' | 'legacy'

type Atom = {
  keyHint: string
  contactId: string | null
  email: string | null
  name: string | null
  phone: string | null
  status: CommercialStatus
  at: string | null
  endAt: string | null
  category: string
  productCode: string | null
  amountCents: number
  partner: string
  consent: boolean
  firstTouch: string | null
  lastTouch: string | null
  legacy: boolean
  journey: JourneyItem[]
  registration: ContactRegistration
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = String(value ?? '').trim().toLowerCase()
  if (!email.includes('@') || email.startsWith('@')) return null
  return email
}

function touchLabel(touch: SalesOrder['firstTouch']): string | null {
  if (!touch) return null
  const parts = [touch.source, touch.campaign].filter((part) => part && part.trim())
  return parts.length ? parts.join(' · ') : null
}

function currentPending(order: SalesOrder): boolean {
  return order.state === 'PAYMENT_PENDING' || order.state === 'PREFERENCE_PENDING'
}

function atomsFromOrders(orders: SalesOrder[]): Atom[] {
  return orders.flatMap((order) => {
    const paid = isSale(order)
    const pending = currentPending(order)
    if (!paid && !pending) return []
    const status: CommercialStatus = paid ? 'CURRENT_PAID' : 'CURRENT_PENDING'
    const at = paid ? approvedAt(order) ?? order.createdAt : order.createdAt
    const category = productLabel(order)
    const code = order.lines[0]?.productCode ?? null
    const partner = order.affiliateCode
      ? order.affiliateName || order.affiliateCode
      : 'Venta directa'
    const journey: JourneyItem[] = [
      {
        at: order.createdAt,
        source: CURRENT_SOURCE,
        title: 'Orden creada',
        detail: category,
      },
    ]
    if (pending) {
      journey.push({
        at: order.createdAt,
        source: CURRENT_SOURCE,
        title: order.state === 'PAYMENT_PENDING' ? 'Pago pendiente' : 'Preferencia pendiente',
        detail: category,
      })
    }
    if (paid && at) {
      journey.push({
        at,
        source: CURRENT_SOURCE,
        title: 'Venta pagada',
        detail: category,
      })
    }
    for (const ticket of order.tickets) {
      if (ticket.issuedAt) {
        journey.push({
          at: ticket.issuedAt,
          source: CURRENT_SOURCE,
          title: 'Boleto emitido',
          detail: ticket.state,
        })
      }
    }
    const name = order.buyerName?.trim() || null
    const email = normalizeEmail(order.buyerEmail)
    const phone = order.buyerPhone?.trim() || null
    return [{
      keyHint: order.id,
      contactId: order.buyerContactId ?? null,
      email,
      name,
      phone,
      status,
      at,
      endAt: at,
      category,
      productCode: code,
      amountCents: paid ? order.totalCents : 0,
      partner,
      consent: order.consentRecorded === true,
      firstTouch: touchLabel(order.firstTouch),
      lastTouch: touchLabel(order.lastTouch),
      legacy: false,
      journey,
      registration: {
        id: order.id,
        source: CURRENT_SOURCE,
        name,
        email,
        phone,
        category,
        categoryCode: code,
        status,
        amountCents: order.totalCents,
        at: order.createdAt,
        confirmedAt: paid ? at : null,
        teamName: null,
        participants: null,
        notes: null,
        hasPaymentId: false,
      },
    }]
  })
}

function atomsFromLegacy(rows: LegacyRegistration[], eventCode: string): Atom[] {
  return rows
    .filter((row) => row.eventCode === eventCode)
    .flatMap((row) => {
      const paid = row.commercialStatus === 'LEGACY_PAID' || row.originalStatus === 'paid'
      const pending = row.commercialStatus === 'LEGACY_PENDING' || row.originalStatus === 'pending'
      if (!paid && !pending) return []
      const status: CommercialStatus = paid ? 'LEGACY_PAID' : 'LEGACY_PENDING'
      const created = row.originalCreatedAt
      const confirmed = row.originalUpdatedAt
      const journey: JourneyItem[] = []
      if (created) {
        journey.push({
          at: created,
          source: LEGACY_SOURCE,
          title: 'Registro histórico pendiente',
          detail: row.categoryName,
        })
      }
      if (paid && confirmed) {
        journey.push({
          at: confirmed,
          source: LEGACY_SOURCE,
          title: 'Confirmación histórica de pago',
          detail: 'Fecha de confirmación histórica',
        })
      }
      const name = row.name?.trim() || null
      const email = normalizeEmail(row.email)
      const phone = row.phone?.trim() || null
      const category = row.categoryName || row.categoryCode || 'Sin categoría'
      return [{
        keyHint: row.id,
        contactId: row.buyerContactId,
        email,
        name,
        phone,
        status,
        at: pending ? created : confirmed ?? created,
        endAt: confirmed ?? created,
        category,
        productCode: row.categoryCode,
        amountCents: paid ? row.amountCents ?? 0 : 0,
        partner: HISTORICAL_ATTRIBUTION,
        consent: false,
        firstTouch: null,
        lastTouch: null,
        legacy: true,
        journey,
        registration: {
          id: row.id,
          source: LEGACY_SOURCE,
          name,
          email,
          phone,
          category,
          categoryCode: row.categoryCode,
          status,
          amountCents: row.amountCents ?? 0,
          at: created,
          confirmedAt: paid ? confirmed : null,
          teamName: row.teamName?.trim() || null,
          participants: row.participants?.trim() || null,
          notes: row.notes?.trim() || null,
          hasPaymentId: row.hasPaymentId === true,
        },
      }]
    })
}

function groupKey(atom: Atom, emailOwners: Map<string, Set<string>>): string {
  if (atom.contactId) return `contact:${atom.contactId}`
  if (atom.email) {
    const owners = emailOwners.get(atom.email)
    if (owners && owners.size === 1) return `contact:${[...owners][0]}`
    if (!owners || owners.size === 0) return `email:${atom.email}`
    return `row:${atom.keyHint}`
  }
  return `row:${atom.keyHint}`
}

export function buildContacts(
  orders: SalesOrder[],
  legacy: LegacyRegistration[],
  eventCode: string,
): CommercialContact[] {
  const atoms = [...atomsFromOrders(orders), ...atomsFromLegacy(legacy, eventCode)]
  const emailOwners = new Map<string, Set<string>>()
  for (const atom of atoms) {
    if (!atom.email || !atom.contactId) continue
    const set = emailOwners.get(atom.email) ?? new Set<string>()
    set.add(atom.contactId)
    emailOwners.set(atom.email, set)
  }
  const groups = new Map<string, Atom[]>()
  for (const atom of atoms) {
    const key = groupKey(atom, emailOwners)
    const list = groups.get(key) ?? []
    list.push(atom)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([key, list]) => {
    const status = list.reduce((best, atom) =>
      RANK[atom.status] > RANK[best] ? atom.status : best, list[0]!.status)
    const dated = list
      .map((atom) => atom.at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(a) - Date.parse(b))
    const journey = list
      .flatMap((atom) => atom.journey)
      .filter((item) => item.at)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const paid = list.filter((atom) => atom.status === 'CURRENT_PAID' || atom.status === 'LEGACY_PAID')
    const current = list.find((atom) => !atom.legacy)
    const names = distinctText(list.map((atom) => atom.name))
    const phones = distinctText(list.map((atom) => atom.phone))
    const categories = [...new Set(list.map((atom) => atom.category).filter(Boolean))]
    const registrations = list
      .map((atom) => atom.registration)
      .sort((a, b) => Date.parse(a.at ?? '') - Date.parse(b.at ?? ''))
    return {
      key,
      name: names[0] ?? null,
      names,
      email: list.find((atom) => atom.email)?.email ?? null,
      phone: phones[0] ?? null,
      phones,
      sharedInbox: names.length > 1,
      status,
      buyer: status === 'CURRENT_PAID' || status === 'LEGACY_PAID',
      opportunity: status === 'CURRENT_PENDING' || status === 'LEGACY_PENDING',
      categoryLabel: categories.join(' · '),
      categories,
      teamNames: distinctText(registrations.map((registration) => registration.teamName)),
      productCode: list.find((atom) => atom.productCode)?.productCode ?? null,
      partnerLabel: current?.partner ?? HISTORICAL_ATTRIBUTION,
      consent: list.some((atom) => atom.consent) ? 'recorded' : 'not-recorded',
      firstAt: dated[0] ?? null,
      lastAt: dated[dated.length - 1] ?? null,
      paidCents: paid.reduce((sum, atom) => sum + atom.amountCents, 0),
      legacyRecordCount: list.filter((atom) => atom.legacy).length,
      currentRecordCount: list.filter((atom) => !atom.legacy).length,
      firstTouch: current?.firstTouch ?? null,
      lastTouch: current?.lastTouch ?? null,
      journey,
      registrations,
    }
  })
}

function distinctText(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = value?.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

export function interestSummary(categories: string[], promoted?: string | null): string {
  const unique = [...new Set(categories.filter(Boolean))]
  if (unique.length === 0) return 'Sin categoría'
  if (unique.length <= 2) return unique.join(' · ')
  const ordered = promoted && unique.includes(promoted)
    ? [promoted, ...unique.filter((category) => category !== promoted)]
    : unique
  const head = ordered.slice(0, 2)
  return `${head.join(' · ')} +${unique.length - head.length} más`
}

export function registrationCountLabel(contact: Pick<CommercialContact, 'legacyRecordCount' | 'currentRecordCount' | 'registrations'>): string {
  const total = contact.legacyRecordCount + contact.currentRecordCount
  const paid = contact.registrations.filter((registration) =>
    registration.status === 'CURRENT_PAID' || registration.status === 'LEGACY_PAID').length
  if (paid >= 2 && paid === total) return `${paid} inscripciones pagadas`
  if (contact.legacyRecordCount > 0 && contact.currentRecordCount === 0) {
    return total === 1 ? '1 registro histórico' : `${total} registros históricos`
  }
  return total === 1 ? '1 registro' : `${total} registros`
}

export function phoneDigitCount(phone: string | null | undefined): number {
  return String(phone ?? '').replace(/\D/g, '').length
}

export function phoneLooksIncomplete(phone: string | null | undefined): boolean {
  const digits = phoneDigitCount(phone)
  return digits > 0 && digits !== 10
}

export function isPairOrRelay(categoryCode: string | null | undefined, categoryName: string | null | undefined): boolean {
  const code = categoryCode ?? ''
  if (code.startsWith('DOB-') || code.startsWith('REL-') || code.startsWith('HALF-DOB-')) return true
  const name = (categoryName ?? '').toLowerCase()
  return name.includes('dobles') || name.includes('relay')
}

export function showDeclaredParticipants(
  categoryCode: string | null | undefined,
  categoryName: string | null | undefined,
  participants: string | null | undefined,
  contactName: string | null | undefined,
): boolean {
  const text = participants?.trim()
  if (!text) return false
  if (text.toLowerCase() === (contactName ?? '').trim().toLowerCase()) return false
  return isPairOrRelay(categoryCode, categoryName)
}

export function contactSearchMatch(contact: CommercialContact, query: string): SearchField[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const hits: SearchField[] = []
  if (contact.names.some((name) => name.toLowerCase().includes(needle))) hits.push('name')
  if ((contact.email ?? '').toLowerCase().includes(needle)) hits.push('email')
  if (contact.phones.some((phone) => phone.toLowerCase().includes(needle))) hits.push('phone')
  if (contact.categories.some((category) => category.toLowerCase().includes(needle))) hits.push('category')
  if (contact.teamNames.some((team) => team.toLowerCase().includes(needle))) hits.push('team')
  return hits
}

export function matchedCategory(contact: CommercialContact, query: string): string | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return null
  return contact.categories.find((category) => category.toLowerCase().includes(needle)) ?? null
}

export function matchedTeam(contact: CommercialContact, query: string): string | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return null
  return contact.teamNames.find((team) => team.toLowerCase().includes(needle)) ?? null
}

export type EventCommercialTotals = {
  knownPaid: number
  knownGrossCents: number
  currentPaid: number
  currentGrossCents: number
  currentParticipants: number
  legacyPaid: number
  legacyGrossCents: number
  legacyPendingRegistrations: number
  currentPending: number
  buyers: number
  opportunities: number
  legacyPendingPeople: number
  currentReconciledNetCents: number
  currentPendingReconciliationCount: number
  currentPendingReconciliationGrossCents: number
}

export function eventCommercialTotals(
  orders: SalesOrder[],
  legacy: LegacyRegistration[],
  eventCode: string,
): EventCommercialTotals {
  const currentPaid = orders.filter(isSale)
  const legacyPaid = legacy.filter(
    (row) => row.eventCode === eventCode && (row.commercialStatus === 'LEGACY_PAID' || row.originalStatus === 'paid'),
  )
  const legacyPending = legacy.filter(
    (row) => row.eventCode === eventCode && (row.commercialStatus === 'LEGACY_PENDING' || row.originalStatus === 'pending'),
  )
  const contacts = buildContacts(orders, legacy, eventCode)
  const unreconciled = currentPaid.filter((order) => order.adjustment == null)
  return {
    knownPaid: currentPaid.length + legacyPaid.length,
    knownGrossCents:
      currentPaid.reduce((sum, order) => sum + order.totalCents, 0) +
      legacyPaid.reduce((sum, row) => sum + (row.amountCents ?? 0), 0),
    currentPaid: currentPaid.length,
    currentGrossCents: currentPaid.reduce((sum, order) => sum + order.totalCents, 0),
    currentParticipants: currentPaid.reduce((sum, order) => sum + participantCount(order), 0),
    legacyPaid: legacyPaid.length,
    legacyGrossCents: legacyPaid.reduce((sum, row) => sum + (row.amountCents ?? 0), 0),
    legacyPendingRegistrations: legacyPending.length,
    currentPending: orders.filter(currentPending).length,
    buyers: contacts.filter((contact) => contact.buyer).length,
    opportunities: contacts.filter((contact) => contact.opportunity).length,
    legacyPendingPeople: contacts.filter((contact) => contact.status === 'LEGACY_PENDING').length,
    currentReconciledNetCents: currentPaid.reduce((sum, order) => sum + (netRevenueCents(order) ?? 0), 0),
    currentPendingReconciliationCount: unreconciled.length,
    currentPendingReconciliationGrossCents: unreconciled.reduce((sum, order) => sum + order.totalCents, 0),
  }
}

function inWindow(iso: string | null, startMs: number, endMs: number): boolean {
  if (!iso) return false
  const ms = Date.parse(iso)
  return !Number.isNaN(ms) && ms >= startMs && ms < endMs
}

export function periodCommercial(
  orders: SalesOrder[],
  legacy: LegacyRegistration[],
  eventCode: string,
  filters: SalesFilters,
  now: Date,
  source: CommercialSource,
) {
  const range = rangeForFilters(filters, now)
  if ('error' in range) {
    return {
      error: range.error,
      currentPaid: 0,
      legacyPaid: 0,
      knownPaid: 0,
      currentGrossCents: 0,
      legacyGrossCents: 0,
      knownGrossCents: 0,
      currentPending: 0,
      legacyPending: 0,
      legacyPendingRows: [] as LegacyRegistration[],
      currentPendingOrders: [] as SalesOrder[],
    }
  }
  const scoped = legacy.filter((row) => row.eventCode === eventCode)
  const currentPaid = orders.filter(
    (order) => isSale(order) && inWindow(approvedAt(order), range.startMs, range.endMs),
  )
  const pendingNow = orders.filter(
    (order) => currentPending(order) && inWindow(order.createdAt, range.startMs, range.endMs),
  )
  const legacyPaid = scoped.filter(
    (row) =>
      (row.commercialStatus === 'LEGACY_PAID' || row.originalStatus === 'paid') &&
      inWindow(row.originalUpdatedAt, range.startMs, range.endMs),
  )
  const legacyPending = scoped.filter(
    (row) =>
      (row.commercialStatus === 'LEGACY_PENDING' || row.originalStatus === 'pending') &&
      inWindow(row.originalCreatedAt, range.startMs, range.endMs),
  )
  const includeCurrent = source !== 'legacy'
  const includeLegacy = source !== 'current'
  return {
    error: null,
    currentPaid: includeCurrent ? currentPaid.length : 0,
    legacyPaid: includeLegacy ? legacyPaid.length : 0,
    knownPaid: (includeCurrent ? currentPaid.length : 0) + (includeLegacy ? legacyPaid.length : 0),
    currentGrossCents: includeCurrent ? currentPaid.reduce((sum, order) => sum + order.totalCents, 0) : 0,
    legacyGrossCents: includeLegacy ? legacyPaid.reduce((sum, row) => sum + (row.amountCents ?? 0), 0) : 0,
    knownGrossCents:
      (includeCurrent ? currentPaid.reduce((sum, order) => sum + order.totalCents, 0) : 0) +
      (includeLegacy ? legacyPaid.reduce((sum, row) => sum + (row.amountCents ?? 0), 0) : 0),
    currentPending: includeCurrent ? pendingNow.length : 0,
    legacyPending: includeLegacy ? legacyPending.length : 0,
    legacyPendingRows: includeLegacy ? legacyPending : [],
    currentPendingOrders: includeCurrent ? pendingNow : [],
  }
}

export function currentFunnel(
  orders: SalesOrder[],
  events: FunnelEvent[],
  eventCode: string,
  filters: SalesFilters,
  now: Date,
) {
  const range = rangeForFilters(filters, now)
  if ('error' in range) {
    return { visitors: 0, experiences: 0, checkouts: 0, orders: 0, paid: 0 }
  }
  const scoped = events.filter(
    (event) => event.eventCode === eventCode && inWindow(event.occurredAt, range.startMs, range.endMs),
  )
  const distinct = (type: string) =>
    new Set(scoped.filter((event) => event.eventType === type).map((event) => event.visitorId)).size
  const created = orders.filter((order) => inWindow(order.createdAt, range.startMs, range.endMs))
  const paid = orders.filter((order) => isSale(order) && inWindow(approvedAt(order), range.startMs, range.endMs))
  return {
    visitors: distinct('LANDING_VIEW'),
    experiences: distinct('EXPERIENCE_SELECTED'),
    checkouts: distinct('CHECKOUT_STARTED'),
    orders: new Set(created.map((order) => order.id)).size,
    paid: new Set(paid.map((order) => order.id)).size,
  }
}

export function legacyFunnel(
  legacy: LegacyRegistration[],
  eventCode: string,
  filters: SalesFilters,
  now: Date,
) {
  const range = rangeForFilters(filters, now)
  if ('error' in range) return { registrations: 0, paid: 0 }
  const scoped = legacy.filter((row) => row.eventCode === eventCode)
  return {
    registrations: scoped.filter((row) => inWindow(row.originalCreatedAt, range.startMs, range.endMs)).length,
    paid: scoped.filter(
      (row) =>
        (row.commercialStatus === 'LEGACY_PAID' || row.originalStatus === 'paid') &&
        inWindow(row.originalUpdatedAt, range.startMs, range.endMs),
    ).length,
  }
}

export function filterContacts(contacts: CommercialContact[], filters: DirectoryFilters): CommercialContact[] {
  return contacts.filter((contact) => {
    if (filters.audience === 'buyers' && !contact.buyer) return false
    if (filters.audience === 'opportunities' && !contact.opportunity) return false
    if (filters.origin === 'current' && contact.currentRecordCount === 0) return false
    if (filters.origin === 'legacy' && contact.legacyRecordCount === 0) return false
    if (filters.status !== 'all' && contact.status !== filters.status) return false
    if (filters.consent !== 'all' && contact.consent !== filters.consent) return false
    if (
      filters.productCode &&
      contact.productCode !== filters.productCode &&
      !contact.categoryLabel.toLowerCase().includes(filters.productCode.toLowerCase())
    ) {
      return false
    }
    if (filters.partner === 'historical' && contact.partnerLabel !== HISTORICAL_ATTRIBUTION) return false
    if (filters.partner === 'direct' && contact.partnerLabel !== 'Venta directa') return false
    if (filters.partner && !['', 'historical', 'direct'].includes(filters.partner) && contact.partnerLabel !== filters.partner) {
      return false
    }
    const query = filters.search.trim()
    if (!query) return true
    return contactSearchMatch(contact, query).length > 0
  })
}

function csvCell(value: string | number | null): string {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function contactsToCsv(contacts: CommercialContact[]): string {
  const header = [
    'source',
    'commercial_status',
    'contact_names',
    'email',
    'phone',
    'registration_count',
    'categories',
    'paid_amount_mxn',
    'first_activity',
    'last_activity',
    'team_names',
    'origin',
    'consent',
    'first_touch',
    'last_touch',
    'community_partner',
  ]
  const lines = contacts.map((contact) => [
    contact.legacyRecordCount && contact.currentRecordCount
      ? `${LEGACY_SOURCE}+${CURRENT_SOURCE}`
      : contact.legacyRecordCount
        ? LEGACY_SOURCE
        : CURRENT_SOURCE,
    contact.status,
    contact.names.join(' | '),
    contact.email,
    contact.phone,
    contact.legacyRecordCount + contact.currentRecordCount,
    contact.categoryLabel,
    (contact.paidCents / 100).toFixed(2),
    contact.firstAt,
    contact.lastAt,
    contact.teamNames.join(' | '),
    contact.legacyRecordCount && contact.currentRecordCount
      ? 'legacy+current'
      : contact.legacyRecordCount
        ? 'legacy'
        : 'current',
    contact.consent === 'recorded' ? 'recorded' : 'not_recorded',
    contact.firstTouch,
    contact.lastTouch,
    contact.partnerLabel === HISTORICAL_ATTRIBUTION ? '' : contact.partnerLabel,
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}

export function pageContacts<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, page) * pageSize
  return rows.slice(start, start + pageSize)
}
