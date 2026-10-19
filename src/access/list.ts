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
  /** "Pareja de: X" / "Equipo de: X" for a member who has no contact of their own. */
  contactNote: string | null
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
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ')
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

const DAY_SUFFIX = /\s*(?:[·—–-])\s*(?:Viernes|S[aá]bado|Domingo)\b/giu

/**
 * One label for the same category whether it came from checkout or from the
 * legacy mirror: no day (it has its own column), no "(Open)" nor
 * "(superseded schedule)", and one separator style.
 */
export function categoryLabel(raw: string | null | undefined): string {
  const text = (raw ?? '')
    .replace(DAY_SUFFIX, '')
    .replace(/\s*\((?:open|superseded schedule)\)/giu, '')
    .replace(/\s*[—–]\s*/gu, ' · ')
    .replace(/\s+/gu, ' ')
    .trim()
  return text
}

function peopleOf(names: string[], email: string | null, phone: string | null, buyerName: string | null): {
  name: string
  email: string | null
  phone: string | null
  contactNote: string | null
}[] {
  const buyer = norm(buyerName)
  const captain = buyerName?.trim() || null
  const kind = names.length === 2 ? 'Pareja' : 'Equipo'
  return names.map((name) => {
    const contact = names.length === 1 || (buyer !== '' && norm(name) === buyer)
    const own = contact ? email : null
    const ownPhone = contact ? phone : null
    const note = !own && !ownPhone && names.length > 1 && captain && norm(name) !== buyer
      ? `${kind} de: ${captain}`
      : null
    return { name, email: own, phone: ownPhone, contactNote: note }
  })
}

export type AccessGroup = {
  day: string
  categories: { category: string; teams: { team: string | null; people: AccessPerson[] }[] }[]
}

/** Day, then category, then team: the order used for the printed door sheet. */
export function groupAccessPeople(people: readonly AccessPerson[]): AccessGroup[] {
  const days = new Map<string, Map<string, Map<string, AccessPerson[]>>>()
  for (const person of people) {
    const day = person.session ?? 'Sin día'
    const categories = days.get(day) ?? new Map<string, Map<string, AccessPerson[]>>()
    const teams = categories.get(person.category) ?? new Map<string, AccessPerson[]>()
    const key = person.team ?? ''
    teams.set(key, [...(teams.get(key) ?? []), person])
    categories.set(person.category, teams)
    days.set(day, categories)
  }
  const dayRank = (day: string) => {
    const index = SESSION_DATES.findIndex((item) => item.session === day)
    return index < 0 ? SESSION_DATES.length : index
  }
  const byText = (a: string, b: string) => a.localeCompare(b, 'es')
  return [...days.entries()]
    .sort(([a], [b]) => dayRank(a) - dayRank(b))
    .map(([day, categories]) => ({
      day,
      categories: [...categories.entries()]
        .sort(([a], [b]) => byText(a, b))
        .map(([category, teams]) => ({
          category,
          teams: [...teams.entries()]
            .sort(([a], [b]) => byText(a, b))
            .map(([team, members]) => ({ team: team || null, people: members })),
        })),
    }))
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
        category: categoryLabel(order.productName) || order.productCode || 'Sin categoría',
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
        category: categoryLabel(row.categoryName) || row.categoryCode || 'Sin categoría',
        categoryCode: row.categoryCode,
        team: row.teamName?.trim() || null,
        session: session.session,
        sessionDate: session.sessionDate,
        origin: row.courtesy ? 'Cortesía' : 'Legacy',
        reference: row.recordId,
      })
    }
  }

  // Nobody twice: the same grant (reference + name), and the same person in the
  // same category even when checkout and legacy both carry them. Checkout rows
  // come first, so they win over a legacy copy.
  const seen = new Set<string>()
  const seenPerson = new Set<string>()
  const unique = people.filter((person) => {
    const key = `${norm(person.reference)}\n${norm(person.name)}`
    const personKey = `${norm(person.name)}\n${norm(person.categoryCode ?? person.category)}`
    if (seen.has(key) || seenPerson.has(personKey)) return false
    seen.add(key)
    seenPerson.add(personKey)
    return true
  })
  return unique.sort((a, b) => {
    const day = (a.sessionDate ?? '9999').localeCompare(b.sessionDate ?? '9999')
    if (day !== 0) return day
    const category = a.category.localeCompare(b.category, 'es')
    if (category !== 0) return category
    const team = (a.team ?? '').localeCompare(b.team ?? '', 'es')
    if (team !== 0) return team
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
