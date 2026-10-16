/**
 * Contact list for marketing (retargeting outside the platform).
 * Carries contact PII and sale amounts. No provider fees, no costs, no
 * payment ids, no free-text notes. Only OWNER and MARKETING may read it.
 */
export type MarketingContactStatus = 'PAID' | 'PENDING' | 'LEAD'

export type MarketingContact = {
  key: string
  name: string | null
  email: string | null
  phone: string | null
  status: MarketingContactStatus
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

export type ContactSources = {
  buyers: Record<string, unknown>[]
  orders: Record<string, unknown>[]
  items: Record<string, unknown>[]
  products: Record<string, unknown>[]
  legacy: Record<string, unknown>[]
  /** Approved Mercado Pago ids already counted on a current order. */
  approvedPaymentIds?: ReadonlySet<string>
  /** Approved-payment time by order id. Falls back to the order update time. */
  saleAtByOrderId?: ReadonlyMap<string, string>
}

const RANK: Record<MarketingContactStatus, number> = { PAID: 3, PENDING: 2, LEAD: 1 }

const PENDING_STATES = new Set(['PAYMENT_PENDING', 'PREFERENCE_PENDING'])

function paymentAlreadyCounted(value: unknown, approved: ReadonlySet<string> | undefined): boolean {
  if (!approved || typeof value !== 'string') return false
  const id = value.trim()
  return id.length > 0 && approved.has(id)
}

type Atom = {
  keyHint: string
  email: string | null
  name: string | null
  phone: string | null
  status: MarketingContactStatus
  legacy: boolean
  category: string | null
  paidCents: number
  at: string | null
  saleAt: string | null
  registeredAt: string | null
  importedAt: string | null
  paymentCountedOnCurrent: boolean
  consent: boolean
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function normalizeContactEmail(value: unknown): string | null {
  const email = text(value)?.toLowerCase() ?? null
  if (!email || !email.includes('@') || email.startsWith('@')) return null
  return email
}

function orderStatus(state: unknown): MarketingContactStatus {
  if (state === 'PAID') return 'PAID'
  if (typeof state === 'string' && PENDING_STATES.has(state)) return 'PENDING'
  return 'LEAD'
}

function legacyStatus(row: Record<string, unknown>): MarketingContactStatus | null {
  if (row.commercial_status === 'LEGACY_PAID' || row.original_status === 'paid') return 'PAID'
  if (row.commercial_status === 'LEGACY_PENDING' || row.original_status === 'pending') return 'PENDING'
  return null
}

export function assembleMarketingContacts(source: ContactSources): MarketingContact[] {
  const productNames = new Map<string, string>()
  for (const product of source.products) {
    const code = text(product.code)
    if (code) productNames.set(code, text(product.name) ?? code)
  }
  const categoriesByOrder = new Map<string, string[]>()
  for (const item of source.items) {
    const orderId = text(item.order_id)
    const code = text(item.product_code)
    if (!orderId || !code) continue
    const list = categoriesByOrder.get(orderId) ?? []
    list.push(productNames.get(code) ?? code)
    categoriesByOrder.set(orderId, list)
  }
  const buyers = new Map<string, Record<string, unknown>>()
  for (const buyer of source.buyers) {
    const id = text(buyer.id)
    if (id) buyers.set(id, buyer)
  }

  const atoms: Atom[] = []
  const ordered = new Set<string>()
  for (const order of source.orders) {
    const contactId = text(order.buyer_contact_id)
    const buyer = contactId ? buyers.get(contactId) : undefined
    if (!buyer) continue
    ordered.add(contactId!)
    const status = orderStatus(order.state)
    const total = typeof order.total_cents === 'number' ? order.total_cents : 0
    const orderId = text(order.id)
    atoms.push({
      keyHint: `contact:${contactId}`,
      email: normalizeContactEmail(buyer.email),
      name: text(buyer.name),
      phone: text(buyer.phone),
      status,
      legacy: false,
      category: (categoriesByOrder.get(String(order.id)) ?? []).join(' · ') || null,
      paidCents: status === 'PAID' ? total : 0,
      at: text(order.updated_at) ?? text(order.created_at),
      saleAt: status === 'PAID' ? source.saleAtByOrderId?.get(orderId ?? '') ?? text(order.updated_at) : null,
      registeredAt: text(order.created_at),
      importedAt: null,
      paymentCountedOnCurrent: false,
      consent: text(buyer.contact_consent_at) != null,
    })
  }
  // Identified contacts that never reached an order still belong to the list.
  for (const [id, buyer] of buyers) {
    if (ordered.has(id)) continue
    atoms.push({
      keyHint: `contact:${id}`,
      email: normalizeContactEmail(buyer.email),
      name: text(buyer.name),
      phone: text(buyer.phone),
      status: 'LEAD',
      legacy: false,
      category: null,
      paidCents: 0,
      at: text(buyer.created_at),
      saleAt: null,
      registeredAt: text(buyer.created_at),
      importedAt: null,
      paymentCountedOnCurrent: false,
      consent: text(buyer.contact_consent_at) != null,
    })
  }
  for (const row of source.legacy) {
    const status = legacyStatus(row)
    if (!status) continue
    const amount = typeof row.amount_cents === 'number' ? row.amount_cents : 0
    const countedOnCurrent = status === 'PAID' && paymentAlreadyCounted(row.original_payment_id, source.approvedPaymentIds)
    atoms.push({
      keyHint: `legacy:${String(row.id)}`,
      email: normalizeContactEmail(row.original_email),
      name: text(row.original_name),
      phone: text(row.original_phone),
      status,
      legacy: true,
      category: text(row.category_name_raw) ?? text(row.category_code_raw),
      paidCents: status === 'PAID' && !countedOnCurrent ? amount : 0,
      at: text(row.original_updated_at) ?? text(row.original_created_at),
      saleAt: status === 'PAID' ? text(row.original_updated_at) : null,
      registeredAt: text(row.original_created_at),
      importedAt: text(row.imported_at),
      paymentCountedOnCurrent: countedOnCurrent,
      consent: false,
    })
  }

  const groups = new Map<string, Atom[]>()
  for (const atom of atoms) {
    const key = atom.email ? `email:${atom.email}` : atom.keyHint
    const list = groups.get(key) ?? []
    list.push(atom)
    groups.set(key, list)
  }

  return [...groups.entries()].map(([key, list]) => {
    const status = list.reduce<MarketingContactStatus>(
      (best, atom) => (RANK[atom.status] > RANK[best] ? atom.status : best),
      'LEAD',
    )
    const dated = list
      .map((atom) => atom.at)
      .filter((value): value is string => value != null)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
    const hasLegacy = list.some((atom) => atom.legacy)
    const hasCurrent = list.some((atom) => !atom.legacy)
    // Only PAID atoms carry an amount, so pending duplicates add nothing.
    const paid = list.reduce((sum, atom) => sum + atom.paidCents, 0)
    const datedSale = list.map((atom) => atom.saleAt).filter((value): value is string => value != null).sort()
    const datedRegister = list.map((atom) => atom.registeredAt).filter((value): value is string => value != null).sort()
    const datedImport = list.map((atom) => atom.importedAt).filter((value): value is string => value != null).sort()
    return {
      key,
      name: list.find((atom) => atom.name)?.name ?? null,
      email: list.find((atom) => atom.email)?.email ?? null,
      phone: list.find((atom) => atom.phone)?.phone ?? null,
      status,
      origin: hasLegacy && hasCurrent ? 'current+legacy' : hasLegacy ? 'legacy' : 'current',
      categories: [...new Set(list.map((atom) => atom.category).filter((c): c is string => c != null))],
      paidCents: paid,
      firstAt: dated[0] ?? null,
      lastAt: dated[dated.length - 1] ?? null,
      saleAt: datedSale[datedSale.length - 1] ?? null,
      registeredAt: datedRegister[0] ?? null,
      importedAt: datedImport[datedImport.length - 1] ?? null,
      paymentCountedOnCurrent: list.some((atom) => atom.paymentCountedOnCurrent),
      consent: list.some((atom) => atom.consent) ? 'recorded' : 'not-recorded',
    }
  })
}
