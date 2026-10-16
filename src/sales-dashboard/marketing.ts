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

export function marketingContactsToCsv(contacts: MarketingContact[]): string {
  const header = [
    'name',
    'email',
    'phone',
    'status',
    'categories',
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
    (contact.paidCents / 100).toFixed(2),
    contact.saleAt,
    contact.registeredAt,
    contact.importedAt,
    contact.origin,
    contact.consent === 'recorded' ? 'recorded' : 'not_recorded',
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}
