/**
 * One person per access grant. Same Mercado Pago payment id is one grant:
 * a PAID Ready2Hybrid order wins; otherwise the legacy row (including courtesy)
 * wins over a hand-resolved order that never issued a ticket here.
 */

export type AccessOrigin = 'Checkout' | 'Legacy' | 'Cortesía'

export type AccessPerson = {
  name: string
  email: string | null
  phone: string | null
  category: string
  categoryCode: string | null
  team: string | null
  session: string | null
  sessionDate: string | null
  origin: AccessOrigin
  reference: string
}

export type AccessOrderInput = {
  id: string
  state: string
  manual: boolean
  productCode: string | null
  productName: string | null
  team: string | null
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  approvedPaymentIds: string[]
  reference: string | null
  people: string[]
}

export type AccessLegacyInput = {
  recordId: string
  commercialStatus: string | null
  courtesy: boolean
  name: string | null
  email: string | null
  phone: string | null
  categoryCode: string | null
  categoryName: string | null
  teamName: string | null
  participants: string | null
  paymentId: string | null
}

const SESSION_DATES: { token: string; session: string; date: string }[] = [
  { token: 'VIE', session: 'Viernes', date: '2026-11-13' },
  { token: 'SAB', session: 'Sábado', date: '2026-11-14' },
  { token: 'DOM', session: 'Domingo', date: '2026-11-15' },
]

export function parseParticipantNames(raw: string | null | undefined, fallback: string | null): string[] {
  const text = raw?.trim() ?? ''
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) {
        const names = parsed
          .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
          .map((item) => item.trim())
        if (names.length > 0) return names
      }
    } catch {
      // A comma list is the other shape the mirror stores.
    }
  }
  if (text) {
    const parts = text.split(',').map((item) => item.trim()).filter(Boolean)
    if (parts.length > 0) return parts
  }
  const buyer = fallback?.trim()
  return buyer ? [buyer] : []
}

export function sessionFor(categoryCode: string | null, categoryName: string | null): {
  session: string | null
  sessionDate: string | null
} {
  const code = (categoryCode ?? '').toUpperCase()
  const name = (categoryName ?? '').toUpperCase()
  for (const item of SESSION_DATES) {
    const inCode = code.includes(item.token)
    const inName = name.includes(item.session.toUpperCase()) || name.includes(item.token)
    if (inCode || inName) return { session: item.session, sessionDate: item.date }
  }
  return { session: null, sessionDate: null }
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1]! : name
}

function csvDate(iso: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

function peopleOf(names: string[], email: string | null, phone: string | null, buyerName: string | null): {
  name: string
  email: string | null
  phone: string | null
}[] {
  const buyer = norm(buyerName)
  return names.map((name) => {
    const contact = names.length === 1 || (buyer !== '' && norm(name) === buyer)
    return {
      name,
      email: contact ? email : null,
      phone: contact ? phone : null,
    }
  })
}

export function buildAccessList(
  orders: readonly AccessOrderInput[],
  legacy: readonly AccessLegacyInput[],
): AccessPerson[] {
  const paidPaymentIds = new Set<string>()
  for (const order of orders) {
    if (order.state !== 'PAID') continue
    for (const id of order.approvedPaymentIds) {
      const trimmed = id.trim()
      if (trimmed) paidPaymentIds.add(trimmed)
    }
  }
  const legacyKept = legacy.filter((row) => {
    if (row.commercialStatus !== 'LEGACY_PAID') return false
    const paymentId = row.paymentId?.trim() ?? ''
    return paymentId === '' || !paidPaymentIds.has(paymentId)
  })
  const legacyPaymentIds = new Set(
    legacyKept
      .map((row) => row.paymentId?.trim() ?? '')
      .filter((id) => id !== ''),
  )
  const people: AccessPerson[] = []

  for (const order of orders) {
    if (order.state === 'REFUNDED' || order.state === 'CHARGED_BACK') continue
    const paid = order.state === 'PAID'
    const manual = order.manual && !paid
    if (!paid && !manual) continue
    if (order.approvedPaymentIds.some((id) => legacyPaymentIds.has(id.trim()))) continue
    const session = sessionFor(order.productCode, order.productName)
    const names = order.people.length > 0 ? order.people : parseParticipantNames(null, order.buyerName)
    for (const person of peopleOf(names, order.buyerEmail, order.buyerPhone, order.buyerName)) {
      people.push({
        ...person,
        category: order.productName?.trim() || order.productCode || 'Sin categoría',
        categoryCode: order.productCode,
        team: order.team?.trim() || null,
        session: session.session,
        sessionDate: session.sessionDate,
        origin: 'Checkout',
        reference: order.reference?.trim() || order.id,
      })
    }
  }

  for (const row of legacyKept) {
    const session = sessionFor(row.categoryCode, row.categoryName)
    const names = parseParticipantNames(row.participants, row.name)
    for (const person of peopleOf(names, row.email, row.phone, row.name)) {
      people.push({
        ...person,
        category: row.categoryName?.trim() || row.categoryCode || 'Sin categoría',
        categoryCode: row.categoryCode,
        team: row.teamName?.trim() || null,
        session: session.session,
        sessionDate: session.sessionDate,
        origin: row.courtesy ? 'Cortesía' : 'Legacy',
        reference: row.recordId,
      })
    }
  }

  const seen = new Set<string>()
  const unique = people.filter((person) => {
    const key = `${norm(person.reference)}\n${norm(person.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique.sort((a, b) => {
    const day = (a.sessionDate ?? '9999').localeCompare(b.sessionDate ?? '9999')
    if (day !== 0) return day
    return lastName(a.name).localeCompare(lastName(b.name), 'es')
  })
}

export function filterAccessPeople(people: readonly AccessPerson[], query: string): AccessPerson[] {
  const needle = norm(query)
  if (!needle) return [...people]
  return people.filter((person) =>
    norm(person.name).includes(needle)
    || norm(person.email).includes(needle)
    || norm(person.phone).includes(needle)
    || norm(person.reference).includes(needle),
  )
}

export function accessListToCsv(people: readonly AccessPerson[]): string {
  const header = ['NOMBRE', 'CORREO', 'TELEFONO', 'CATEGORIA', 'EQUIPO', 'SESION', 'FECHA', 'ORIGEN', 'REFERENCIA']
  const lines = people.map((person) => [
    person.name,
    person.email ?? '',
    person.phone ?? '',
    person.category,
    person.team ?? '',
    person.session ?? '',
    csvDate(person.sessionDate),
    person.origin,
    person.reference,
  ].map(csvCell).join(','))
  return `\uFEFF${[header.join(','), ...lines].join('\n')}`
}
