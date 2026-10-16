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
    contacts: row.contacts.flatMap(parseContact),
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

/**
 * Meta customer-list columns checked against the accessible formatting guide
 * at https://help.bir.ch/en/articles/6303601-custom-audiences-formatting-guidelines
 * on 2026-10-16. That guide states the headers and examples Meta accepts.
 * Meta's own help page returned 403, so this is a structural check, not an
 * upload. Ads Manager hashes the file; this export stays plaintext.
 *
 * A phone keeps an international code that is already present. 52 is not
 * added to a local number. Country is the ISO code only when that calling
 * code identifies one country; otherwise the cell stays empty.
 */
export const META_CUSTOMER_COLUMNS = ['email', 'phone', 'fn', 'ln', 'country'] as const

export const META_ACCEPTED_COLUMNS = [
  'email',
  'phone',
  'fn',
  'st',
  'country',
  'doby',
  'dobm',
  'dobd',
  'zip',
  'extern_id',
] as const

function metaEmail(value: string | null): string {
  const email = value?.trim().toLowerCase() ?? ''
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ? email : ''
}

function metaPhone(value: string | null): { phone: string; country: string } {
  const raw = value?.trim() ?? ''
  if (!raw) return { phone: '', country: '' }
  const compact = raw.replace(/[\s().-]/g, '')
  const explicit = compact.startsWith('+') || compact.startsWith('00')
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits) return { phone: '', country: '' }
  if (digits.startsWith('52') && digits.length === 12) return { phone: digits, country: 'MX' }
  if (explicit && digits.startsWith('521') && digits.length === 13) {
    return { phone: `52${digits.slice(3)}`, country: 'MX' }
  }
  if (explicit && digits.startsWith('44') && digits.length === 12) return { phone: digits, country: 'GB' }
  if (explicit && digits.startsWith('34') && digits.length === 11) return { phone: digits, country: 'ES' }
  if (explicit && digits.startsWith('33') && digits.length === 11) return { phone: digits, country: 'FR' }
  return { phone: digits, country: '' }
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
    lines.push([email, phone, fn, ln, phone ? country : ''].join(','))
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
