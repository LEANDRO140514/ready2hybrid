/**
 * Contact list for marketing: who bought, who is pending, who left a contact.
 * Built on the server (`ops-commercial-read`, view `contacts`). The client
 * only filters and exports what the server already allowed this role to see.
 */
export type MarketingStatus = 'PAID' | 'PENDING' | 'LEAD'

export type MarketingContact = {
  key: string
  name: string | null
  email: string | null
  phone: string | null
  status: MarketingStatus
  origin: 'current' | 'legacy' | 'current+legacy'
  categories: string[]
  paidCents: number
  firstAt: string | null
  lastAt: string | null
  saleAt: string | null
  registeredAt: string | null
  importedAt: string | null
  paymentCountedOnCurrent: boolean
  /** Counted sales after the payment-id cross. Pending and rejected rows are not included. */
  purchaseCount: number
  /** Products on those counted sales. Pending registrations stay in categories. */
  purchasedProducts: string[]
  consent: 'recorded' | 'not-recorded'
}

export type MarketingPayload = {
  eventCode: string
  contacts: MarketingContact[]
  /** Distinct landing visitors, anonymous included. */
  visitors: number
  /** Visitors who left a contact (a subset of the contacts above). */
  identifiedVisitors: number
}

export type MarketingFilters = {
  status: 'all' | MarketingStatus
  consent: 'all' | 'recorded' | 'not-recorded'
  product: string
  saleFrom: string
  saleTo: string
  search: string
}

export const EMPTY_MARKETING_FILTERS: MarketingFilters = {
  status: 'all',
  consent: 'all',
  product: '',
  saleFrom: '',
  saleTo: '',
  search: '',
}

export const MARKETING_STATUS_LABEL: Record<MarketingStatus, string> = {
  PAID: 'Compró',
  PENDING: 'Pendiente de pago',
  LEAD: 'Dejó sus datos, sin pago',
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function parseContact(value: unknown): MarketingContact[] {
  if (!value || typeof value !== 'object') return []
  const row = value as Record<string, unknown>
  if (typeof row.key !== 'string') return []
  if (row.status !== 'PAID' && row.status !== 'PENDING' && row.status !== 'LEAD') return []
  return [{
    key: row.key,
    name: text(row.name),
    email: text(row.email),
    phone: text(row.phone),
    status: row.status,
    origin: row.origin === 'legacy' || row.origin === 'current+legacy' ? row.origin : 'current',
    categories: Array.isArray(row.categories)
      ? row.categories.filter((item): item is string => typeof item === 'string')
      : [],
    paidCents: typeof row.paidCents === 'number' ? row.paidCents : 0,
    firstAt: text(row.firstAt),
    lastAt: text(row.lastAt),
    saleAt: text(row.saleAt),
    registeredAt: text(row.registeredAt),
    importedAt: text(row.importedAt),
    paymentCountedOnCurrent: row.paymentCountedOnCurrent === true,
    purchaseCount: typeof row.purchaseCount === 'number' && row.purchaseCount > 0 ? row.purchaseCount : 0,
    purchasedProducts: Array.isArray(row.purchasedProducts)
      ? row.purchasedProducts.filter((item): item is string => typeof item === 'string')
      : [],
    consent: row.consent === 'recorded' ? 'recorded' : 'not-recorded',
  }]
}

const INTERNAL_EMAIL = /^enforma\.sports\.society\+/
const TEST_EMAILS = new Set(['leandro.m.espinosa@gmail.com', 'valentina.et2011@gmail.com'])

export function isExcludedMarketingContact(contact: Pick<MarketingContact, 'email'>): boolean {
  const email = contact.email?.trim().toLowerCase() ?? ''
  return email !== '' && (INTERNAL_EMAIL.test(email) || TEST_EMAILS.has(email))
}

const STATUS_RANK: Record<MarketingStatus, number> = { PAID: 3, PENDING: 2, LEAD: 1 }

function minIso(values: (string | null)[]): string | null {
  const dated = values.filter((value): value is string => value != null).sort()
  return dated[0] ?? null
}

function maxIso(values: (string | null)[]): string | null {
  const dated = values.filter((value): value is string => value != null).sort()
  return dated[dated.length - 1] ?? null
}

function mergeContacts(list: MarketingContact[]): MarketingContact {
  const best = [...list].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0]!
  if (list.length === 1) return best
  const origins = new Set(list.map((item) => item.origin))
  return {
    ...best,
    name: list.find((item) => item.name)?.name ?? null,
    email: list.find((item) => item.email)?.email ?? null,
    phone: list.find((item) => item.phone)?.phone ?? null,
    origin: origins.size > 1 || origins.has('current+legacy') ? 'current+legacy' : best.origin,
    categories: [...new Set(list.flatMap((item) => item.categories))],
    paidCents: list.reduce((sum, item) => sum + item.paidCents, 0),
    purchaseCount: list.reduce((sum, item) => sum + item.purchaseCount, 0),
    purchasedProducts: [...new Set(list.flatMap((item) => item.purchasedProducts))],
    firstAt: minIso(list.map((item) => item.firstAt)),
    lastAt: maxIso(list.map((item) => item.lastAt)),
    saleAt: maxIso(list.map((item) => item.saleAt)),
    registeredAt: minIso(list.map((item) => item.registeredAt)),
    importedAt: maxIso(list.map((item) => item.importedAt)),
    paymentCountedOnCurrent: list.some((item) => item.paymentCountedOnCurrent),
    consent: list.some((item) => item.consent === 'recorded') ? 'recorded' : 'not-recorded',
  }
}

/**
 * Last line of defence before an export: internal and test contacts out, and
 * rows that share an email or a Mexican phone collapse into one person. The
 * server already does this; running it again is idempotent.
 */
export function prepareMarketingContacts(contacts: MarketingContact[]): MarketingContact[] {
  const kept = contacts.filter((contact) => !isExcludedMarketingContact(contact))
  const parent = kept.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]!
    return root
  }
  const owner = new Map<string, number>()
  kept.forEach((contact, index) => {
    const email = contact.email?.trim().toLowerCase() ?? ''
    const phone = normalizeMxPhone(contact.phone)
    for (const key of [email ? `e:${email}` : null, phone ? `p:${phone}` : null]) {
      if (!key) continue
      const seen = owner.get(key)
      if (seen === undefined) owner.set(key, index)
      else parent[find(index)] = find(seen)
    }
  })
  const groups = new Map<number, MarketingContact[]>()
  kept.forEach((contact, index) => {
    const root = find(index)
    groups.set(root, [...(groups.get(root) ?? []), contact])
  })
  return [...groups.values()].map(mergeContacts)
}

export type MarketingExportStats = {
  rows: number
  withEmail: number
  withPhone: number
}

/** What each download would contain, counted from the rows themselves. */
export function marketingExportStats(contacts: MarketingContact[]): { general: MarketingExportStats; meta: MarketingExportStats } {
  const general = {
    rows: contacts.length,
    withEmail: contacts.filter((contact) => contact.email).length,
    withPhone: contacts.filter((contact) => contact.phone).length,
  }
  const metaLines = marketingContactsToMetaCsv(contacts).split('\n').slice(1).map((line) => line.split(','))
  return {
    general,
    meta: {
      rows: metaLines.length,
      withEmail: metaLines.filter((cells) => cells[0]).length,
      withPhone: metaLines.filter((cells) => cells[1]).length,
    },
  }
}

export function parseMarketingPayload(value: unknown): MarketingPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La lista de contactos no tiene el formato esperado.')
  }
  const row = value as Record<string, unknown>
  if (!Array.isArray(row.contacts)) {
    throw new Error('La lista de contactos no tiene el formato esperado.')
  }
  return {
    eventCode: typeof row.eventCode === 'string' ? row.eventCode : 'HEX-2026',
    contacts: prepareMarketingContacts(row.contacts.flatMap(parseContact)),
    visitors: typeof row.visitors === 'number' ? row.visitors : 0,
    identifiedVisitors: typeof row.identifiedVisitors === 'number' ? row.identifiedVisitors : 0,
  }
}

function inMarketingDate(contact: MarketingContact, filters: MarketingFilters): boolean {
  if (!filters.saleFrom && !filters.saleTo) return true
  const paid = contact.status === 'PAID'
  const iso = paid ? contact.saleAt ?? contact.lastAt : contact.registeredAt ?? contact.firstAt
  if (!iso) return false
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return false
  if (filters.saleFrom && ms < Date.parse(`${filters.saleFrom}T06:00:00.000Z`)) return false
  if (filters.saleTo && ms >= Date.parse(`${filters.saleTo}T06:00:00.000Z`) + 86_400_000) return false
  return true
}

export function filterMarketingContacts(
  contacts: MarketingContact[],
  filters: MarketingFilters,
): MarketingContact[] {
  const query = filters.search.trim().toLowerCase()
  return contacts.filter((contact) => {
    if (filters.status !== 'all' && contact.status !== filters.status) return false
    if (filters.consent !== 'all' && contact.consent !== filters.consent) return false
    if (filters.product && !contact.categories.some((category) => category.toLowerCase().includes(filters.product.toLowerCase()))) {
      return false
    }
    if (!inMarketingDate(contact, filters)) return false
    if (!query) return true
    return [contact.name, contact.email, contact.phone, ...contact.categories]
      .some((field) => field?.toLowerCase().includes(query))
  })
}

export function marketingCounts(contacts: MarketingContact[]): Record<MarketingStatus, number> {
  const counts: Record<MarketingStatus, number> = { PAID: 0, PENDING: 0, LEAD: 0 }
  for (const contact of contacts) counts[contact.status] += 1
  return counts
}

/**
 * Spreadsheet formula injection: a cell that starts with = or @, or with +/-
 * followed by anything but a phone-like number, is prefixed so Excel and
 * Sheets read it as text. Names and categories come from the public landing.
 */
function csvCell(value: string | number | null): string {
  let cell = value == null ? '' : String(value)
  const phoneLike = /^[+-][\d\s().-]+$/.test(cell)
  if (/^[=@\t\r]/.test(cell) || (/^[+-]/.test(cell) && !phoneLike)) cell = `'${cell}`
  if (/[",\n\r]/.test(cell)) return `"${cell.replaceAll('"', '""')}"`
  return cell
}

/** UTF-8 byte order mark so Excel reads accents instead of guessing ANSI. */
export const CSV_BOM = '\uFEFF'

export function csvWithBom(csv: string): string {
  return csv.startsWith(CSV_BOM) ? csv : CSV_BOM + csv
}

/**
 * RFC 4180 field for the Meta file. Besides comma, quote and line breaks, a
 * field with any whitespace is quoted too: a multi-word last name such as
 * "águila aviles" must not be split into two cells by a reader that breaks on
 * spaces, which would push the next value into the wrong column.
 */
function metaCell(value: string): string {
  return /[",\s]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * Meta customer file. Compatibility is pending an official check or a real
 * import. This exporter does not claim that check.
 *
 * Phone is written only when the number already has a confirmed international
 * calling code. A local number leaves phone empty and keeps email, fn and ln.
 * Country is filled only when that code identifies one country. The general
 * export keeps the original phone.
 */
export const META_CUSTOMER_COLUMNS = ['email', 'phone', 'fn', 'ln', 'country'] as const

export const META_FORMAT_STATUS = 'pending-official-check' as const

function metaEmail(value: string | null): string {
  const email = value?.trim().toLowerCase() ?? ''
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ? email : ''
}

/**
 * Mexican mobile/landline for Meta: 10 national digits (also written with
 * +52, 52, 521 or 0052 in front, with spaces, dashes or parentheses) become
 * +52XXXXXXXXXX. Anything else is not valid and returns null.
 */
export function normalizeMxPhone(value: string | null | undefined): string | null {
  let digits = (value ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3)
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2)
  return /^[2-9]\d{9}$/.test(digits) ? `+52${digits}` : null
}

function metaPhone(value: string | null): { phone: string; country: string } {
  const raw = value?.trim() ?? ''
  if (!raw) return { phone: '', country: '' }
  const mexican = normalizeMxPhone(raw)
  if (mexican) return { phone: mexican, country: 'MX' }
  const compact = raw.replace(/[\s().-]/g, '')
  const explicit = compact.startsWith('+') || compact.startsWith('00')
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits) return { phone: '', country: '' }
  if (digits.startsWith('52')) return { phone: '', country: '' }
  if (explicit && digits.startsWith('44') && digits.length === 12) return { phone: `+${digits}`, country: 'GB' }
  if (explicit && digits.startsWith('34') && digits.length === 11) return { phone: `+${digits}`, country: 'ES' }
  if (explicit && digits.startsWith('33') && digits.length === 11) return { phone: `+${digits}`, country: 'FR' }
  // +1 is shared by the US, Canada and the Caribbean: the code alone does not
  // identify one country, so country stays empty instead of guessing.
  if (explicit && digits.startsWith('1') && digits.length === 11) return { phone: `+${digits}`, country: '' }
  return { phone: '', country: '' }
}

function metaName(value: string | null): { fn: string; ln: string } {
  const letters = (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  const [fn, ...rest] = letters.split(' ').filter(Boolean)
  return { fn: fn ?? '', ln: rest.join(' ') }
}

export function marketingContactsToMetaCsv(contacts: MarketingContact[]): string {
  const lines = [META_CUSTOMER_COLUMNS.join(',')]
  for (const contact of contacts) {
    const email = metaEmail(contact.email)
    const { phone, country } = metaPhone(contact.phone)
    if (!email && !phone) continue
    const { fn, ln } = metaName(contact.name)
    lines.push([email, phone, fn, ln, phone ? country : ''].map(metaCell).join(','))
  }
  return lines.join('\n')
}

export function marketingContactsToCsv(contacts: MarketingContact[]): string {
  const header = [
    'name',
    'email',
    'phone',
    'status',
    'categories',
    'purchase_count',
    'purchased_products',
    'paid_amount_mxn',
    'fecha_venta',
    'fecha_registro',
    'fecha_importacion',
    'origin',
    'consent',
  ]
  const lines = contacts.map((contact) => [
    contact.name,
    contact.email,
    contact.phone,
    contact.status,
    contact.categories.join(' | '),
    contact.purchaseCount ?? 0,
    (contact.purchasedProducts ?? []).join(' | '),
    (contact.paidCents / 100).toFixed(2),
    contact.saleAt,
    contact.registeredAt,
    contact.importedAt,
    contact.origin,
    contact.consent === 'recorded' ? 'recorded' : 'not_recorded',
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}
