/**
 * One money rule for both sources.
 * Same Mercado Pago payment id counts once (the Ready2Hybrid order, including
 * a sale resolved by hand). Same person and product without that shared id
 * stays in both totals and goes to review: it may be two real purchases.
 * A legacy row that disappears from the source stays in the total and is flagged.
 */
export type LedgerOrder = {
  id: string
  state: string
  totalCents: number
  email: string | null
  productCode: string | null
  approvedPaymentIds: string[]
}

export type LedgerLegacy = {
  id: string
  commercialStatus: string | null
  email: string | null
  productCode: string | null
  amountCents: number | null
  paymentId: string | null
  missingSince: string | null
}

export type LedgerOverride = {
  legacyId: string
  field: 'amount_cents'
  valueCents: number
  conflict: boolean
}

export type LedgerReviewKind = 'same-person-product' | 'missing-from-source' | 'local-conflict'

export type LedgerReview = {
  kind: LedgerReviewKind
  legacyId: string
  orderId: string | null
}

export type SourceLedger = {
  currentSales: number
  currentCents: number
  manualSales: number
  manualCents: number
  legacySales: number
  legacyCents: number
  confirmedSales: number
  confirmedCents: number
  excludedLegacyIds: string[]
  review: LedgerReview[]
}

export function normalizeLedgerEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? ''
  if (!email.includes('@') || email.startsWith('@')) return null
  return email
}

export function legacyAmountAlreadyInCurrent(
  paymentId: string | null | undefined,
  approvedPaymentIds: ReadonlySet<string>,
): boolean {
  const id = paymentId?.trim()
  return Boolean(id) && approvedPaymentIds.has(id!)
}

export function buildSourceLedger(input: {
  orders: LedgerOrder[]
  legacy: LedgerLegacy[]
  manualOrderIds: ReadonlySet<string>
  overrides?: LedgerOverride[]
}): SourceLedger {
  const paid = input.orders.filter((order) => order.state === 'PAID')
  const manual = input.orders.filter(
    (order) => order.state !== 'PAID' && input.manualOrderIds.has(order.id),
  )
  const confirmedOrders = [...paid, ...manual]
  const approvedIds = new Set<string>()
  for (const order of confirmedOrders) {
    for (const id of order.approvedPaymentIds) {
      const trimmed = id.trim()
      if (trimmed) approvedIds.add(trimmed)
    }
  }
  const overrideByLegacy = new Map<string, LedgerOverride>()
  for (const override of input.overrides ?? []) {
    if (override.field === 'amount_cents') overrideByLegacy.set(override.legacyId, override)
  }

  const excludedLegacyIds: string[] = []
  const review: LedgerReview[] = []
  let legacySales = 0
  let legacyCents = 0
  const countedLegacy: LedgerLegacy[] = []

  for (const row of input.legacy) {
    if (row.commercialStatus !== 'LEGACY_PAID') continue
    if (row.missingSince) {
      review.push({ kind: 'missing-from-source', legacyId: row.id, orderId: null })
    }
    const override = overrideByLegacy.get(row.id)
    if (override?.conflict) {
      review.push({ kind: 'local-conflict', legacyId: row.id, orderId: null })
    }
    const paymentId = row.paymentId?.trim() || null
    if (legacyAmountAlreadyInCurrent(paymentId, approvedIds)) {
      excludedLegacyIds.push(row.id)
      continue
    }
    const amount = override ? override.valueCents : row.amountCents ?? 0
    legacySales += 1
    legacyCents += amount
    countedLegacy.push(row)
  }

  const orderKey = new Map<string, string>()
  for (const order of confirmedOrders) {
    const email = normalizeLedgerEmail(order.email)
    const product = order.productCode?.trim() || null
    if (!email || !product) continue
    orderKey.set(`${email}\n${product}`, order.id)
  }
  for (const row of countedLegacy) {
    const email = normalizeLedgerEmail(row.email)
    const product = row.productCode?.trim() || null
    if (!email || !product) continue
    const orderId = orderKey.get(`${email}\n${product}`)
    if (!orderId) continue
    review.push({ kind: 'same-person-product', legacyId: row.id, orderId })
  }

  const currentCents = paid.reduce((sum, order) => sum + order.totalCents, 0)
  const manualCents = manual.reduce((sum, order) => sum + order.totalCents, 0)
  return {
    currentSales: paid.length,
    currentCents,
    manualSales: manual.length,
    manualCents,
    legacySales,
    legacyCents,
    confirmedSales: paid.length + manual.length + legacySales,
    confirmedCents: currentCents + manualCents + legacyCents,
    excludedLegacyIds,
    review,
  }
}

export const EXPIRED_HOLD_ANOMALY = 'Checkout vencido sigue en PAYMENT_PENDING'
export const APPROVED_NOT_PAID_ANOMALY = 'Pago APPROVED y la orden no está PAID'

export function splitAttention<T extends { type: string; orderId: string }>(
  anomalies: T[],
  manualOrderIds: ReadonlySet<string>,
): { active: T[]; expiredHolds: T[]; resolvedManually: T[] } {
  const expiredHolds: T[] = []
  const resolvedManually: T[] = []
  const active: T[] = []
  for (const row of anomalies) {
    if (row.type === EXPIRED_HOLD_ANOMALY) expiredHolds.push(row)
    else if (row.type === APPROVED_NOT_PAID_ANOMALY && manualOrderIds.has(row.orderId)) {
      resolvedManually.push(row)
    } else active.push(row)
  }
  return { active, expiredHolds, resolvedManually }
}
