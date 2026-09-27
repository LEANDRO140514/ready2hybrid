/**
 * Sales Control V1 reporting rules.
 *
 * Sale = orders.state === 'PAID'.
 * Revenue = orders.total_cents (MXN cents), reconcilable with payments.amount_cents.
 * Approval date for reporting = provider_updated_at of the payment that
 * produced PAID (paid_payment_id, else the PAID activity reference, else
 * the only APPROVED payment). There is no paid_at column.
 *
 * Day boundaries use America/Mérida (fixed UTC−6, no DST), same offset as
 * staged pricing.
 */

export type SalesPayment = {
  id: string
  provider: string
  providerPaymentId: string
  normalizedState: string
  amountCents: number | null
  providerUpdatedAt: string | null
  createdAt: string | null
}

export type SalesTicket = {
  id: string
  state: string
  issuedAt: string | null
  folio: string | null
  emailState: string | null
  emailResult: string | null
  emailUpdatedAt: string | null
}

export type SalesRosterMember = {
  name: string | null
  role: string | null
  position: number | null
}

export type SalesActivity = {
  at: string
  action: string
  result: string | null
  paymentRef?: string | null
}

export type SalesWebhook = {
  receivedAt: string | null
  processedAt: string | null
  signatureResult: string | null
  processingState: string | null
  result: string | null
}

export type SalesVerification = {
  verifiedAt: string | null
  merchantOk: boolean | null
  referenceOk: boolean | null
  amountOk: boolean | null
  currencyOk: boolean | null
  normalizedResult: string | null
}

export type SalesLine = {
  productCode: string
  productName: string
  block: string
  kind: string
  saleState: string | null
  teamSize: number
  quantity: number
}

export type FinanceAdjustment = {
  id: string
  orderId: string
  paymentId: string
  provider: string
  providerFeeCents: number
  providerFeeTaxCents: number
  otherCostsCents: number
  notes: string | null
  source: 'MANUAL' | 'PROVIDER'
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  createdByLabel: string | null
  updatedByLabel: string | null
}

export type SaveAdjustmentInput = {
  orderId: string
  paymentId: string
  providerFeeCents: number
  providerFeeTaxCents: number
  otherCostsCents: number
  notes: string | null
}

export type SalesOrder = {
  id: string
  trackingRef: string
  state: string
  currency: string
  totalCents: number
  createdAt: string
  updatedAt: string | null
  expiresAt: string | null
  affiliateCode: string | null
  affiliateName: string | null
  commercialStage: string | null
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  buyerContactId?: string | null
  consentRecorded?: boolean
  visitorId?: string | null
  firstTouch?: { source: string | null; campaign: string | null } | null
  lastTouch?: { source: string | null; campaign: string | null } | null
  lines: SalesLine[]
  payments: SalesPayment[]
  tickets: SalesTicket[]
  roster: SalesRosterMember[]
  activity: SalesActivity[]
  webhooks: SalesWebhook[]
  verifications: SalesVerification[]
  adjustment: FinanceAdjustment | null
  /** Set only when orders.paid_payment_id exists. Historical rows omit it. */
  paidPaymentId?: string | null
}

export type SalesSnapshot = {
  generatedAt: string
  orders: SalesOrder[]
}

export type PeriodPreset = 'today' | '7d' | '30d' | 'custom'

export type SalesFilters = {
  preset: PeriodPreset
  customFrom: string
  customTo: string
  productCode: string
  group: string
  orderState: string
  provider: string
  affiliate: string
  search: string
  reconciliation: '' | 'pending' | 'reconciled'
}

export const EMPTY_FILTERS: SalesFilters = {
  preset: '30d',
  customFrom: '',
  customTo: '',
  productCode: '',
  group: '',
  orderState: '',
  provider: '',
  affiliate: '',
  search: '',
  reconciliation: '',
}

const MERIDA_SHIFT_MS = 6 * 60 * 60 * 1000

export type CommercialGroup =
  | 'COMPITE'
  | 'HALF'
  | 'ASISTE'
  | 'OTROS'

export function commercialGroup(line: SalesLine): CommercialGroup {
  const retired =
    line.saleState === 'RETIRED_PRODUCT' ||
    line.saleState === 'SUPERSEDED_SCHEDULE_VARIANT'
  if (retired || line.kind === 'workout' || line.kind === 'press') return 'OTROS'
  if (line.block === 'COMPITE' && line.kind === 'competitor') return 'COMPITE'
  if (line.block === 'EXPERIENCE' && line.kind === 'competitor') return 'HALF'
  if (line.block === 'ASISTE' && line.kind === 'spectator') return 'ASISTE'
  return 'OTROS'
}

export const GROUP_LABEL: Record<CommercialGroup, string> = {
  COMPITE: 'COMPITE',
  HALF: 'EXPERIENCE / ½ HYBRID',
  ASISTE: 'ASISTE / Público',
  OTROS: 'OTROS / HISTÓRICOS',
}

export function isSale(order: SalesOrder): boolean {
  return order.state === 'PAID'
}

export function processingCostCents(order: SalesOrder): number | null {
  const row = order.adjustment
  if (!row) return null
  return row.providerFeeCents + row.providerFeeTaxCents + row.otherCostsCents
}

/** Null means the costs were not captured. Zero means they were captured as $0. */
export function netRevenueCents(order: SalesOrder): number | null {
  const cost = processingCostCents(order)
  if (cost == null) return null
  return order.totalCents - cost
}

export function reconciliationStatus(
  order: SalesOrder,
): 'pending' | 'reconciled' | 'na' {
  if (!isSale(order)) return 'na'
  return order.adjustment ? 'reconciled' : 'pending'
}

export function reconciliationLabel(order: SalesOrder): string {
  const status = reconciliationStatus(order)
  if (status === 'pending') return 'PENDIENTE DE CONCILIAR'
  if (status === 'reconciled') return 'CONCILIADA'
  return '—'
}

export function effectiveFeeRate(order: SalesOrder): number | null {
  if (!order.adjustment || order.totalCents <= 0) return null
  return order.adjustment.providerFeeCents / order.totalCents
}

/**
 * The payment that produced the valid PAID transition.
 * paid_payment_id wins. Otherwise the earliest WEBHOOK_PAYMENT_APPLIED / PAID
 * reference. A single APPROVED payment covers rows written before that
 * evidence. Several APPROVED payments without evidence are not guessed.
 */
export function approvedPayment(order: SalesOrder): SalesPayment | null {
  if (order.paidPaymentId) {
    return order.payments.find((row) => row.id === order.paidPaymentId) ?? null
  }
  const winningRef = order.activity
    .filter((row) => row.action === 'WEBHOOK_PAYMENT_APPLIED' && row.result === 'PAID' && row.paymentRef)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]?.paymentRef
  if (winningRef) {
    return (
      order.payments.find((row) => row.providerPaymentId === winningRef) ?? null
    )
  }
  const approved = order.payments.filter((row) => row.normalizedState === 'APPROVED')
  if (approved.length === 1) return approved[0] ?? null
  return null
}

/** Reporting date. provider_updated_at, then WEBHOOK_PAYMENT_APPLIED / PAID. */
export function approvedAt(order: SalesOrder): string | null {
  const payment = approvedPayment(order)
  if (payment?.providerUpdatedAt) return payment.providerUpdatedAt
  const applied = order.activity
    .filter(
      (row) =>
        row.action === 'WEBHOOK_PAYMENT_APPLIED' && row.result === 'PAID',
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return applied.at(-1)?.at ?? null
}

export function participantCount(order: SalesOrder): number {
  return order.lines.reduce(
    (sum, line) => sum + line.quantity * line.teamSize,
    0,
  )
}

export function quantityCount(order: SalesOrder): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function primaryLine(order: SalesOrder): SalesLine | null {
  return order.lines[0] ?? null
}

export function productLabel(order: SalesOrder): string {
  if (order.lines.length === 0) return 'Sin producto'
  return order.lines.map((line) => line.productName).join(' · ')
}

export function productCodes(order: SalesOrder): string {
  return order.lines.map((line) => line.productCode).join(' | ')
}

function meridaParts(ms: number): { y: number; m: number; d: number } {
  const shifted = new Date(ms - MERIDA_SHIFT_MS)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  }
}

/** UTC instant of 00:00 America/Mérida on the Merida calendar day of `ms`. */
export function meridaDayStartMs(ms: number): number {
  const { y, m, d } = meridaParts(ms)
  return Date.UTC(y, m, d, 6, 0, 0, 0)
}

export function meridaDayKey(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const { y, m, d } = meridaParts(ms)
  const month = String(m + 1).padStart(2, '0')
  const day = String(d).padStart(2, '0')
  return `${y}-${month}-${day}`
}

export type DateRange = { startMs: number; endMs: number }

export function rangeForFilters(
  filters: SalesFilters,
  now: Date,
): DateRange | { error: string } {
  const startToday = meridaDayStartMs(now.getTime())
  const day = 24 * 60 * 60 * 1000
  if (filters.preset === 'today') {
    return { startMs: startToday, endMs: startToday + day }
  }
  if (filters.preset === '7d') {
    return { startMs: startToday - 6 * day, endMs: startToday + day }
  }
  if (filters.preset === '30d') {
    return { startMs: startToday - 29 * day, endMs: startToday + day }
  }
  const from = parseDay(filters.customFrom)
  const to = parseDay(filters.customTo)
  if (from == null || to == null) {
    return { error: 'Indica un rango válido (AAAA-MM-DD).' }
  }
  if (to < from) return { error: 'La fecha final es anterior a la inicial.' }
  return { startMs: from, endMs: to + day }
}

function parseDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const ms = Date.UTC(y, m - 1, d, 6, 0, 0, 0)
  const back = meridaParts(ms)
  if (back.y !== y || back.m !== m - 1 || back.d !== d) return null
  return ms
}

function inRange(iso: string | null, range: DateRange): boolean {
  if (!iso) return false
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return false
  return ms >= range.startMs && ms < range.endMs
}

function matchesAttributes(order: SalesOrder, filters: SalesFilters): boolean {
  if (filters.orderState && order.state !== filters.orderState) return false
  if (filters.productCode) {
    const hit = order.lines.some((line) => line.productCode === filters.productCode)
    if (!hit) return false
  }
  if (filters.group) {
    const hit = order.lines.some((line) => commercialGroup(line) === filters.group)
    if (!hit) return false
  }
  if (filters.provider) {
    const hit = order.payments.some((row) => row.provider === filters.provider)
    if (!hit) return false
  }
  if (filters.affiliate === 'DIRECT' && order.affiliateCode) return false
  if (
    filters.affiliate &&
    filters.affiliate !== 'DIRECT' &&
    order.affiliateCode !== filters.affiliate
  ) {
    return false
  }
  const reconciliation = reconciliationStatus(order)
  if (filters.reconciliation === 'pending' && reconciliation !== 'pending') return false
  if (filters.reconciliation === 'reconciled' && reconciliation !== 'reconciled') return false
  const q = filters.search.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    order.buyerName,
    order.buyerEmail,
    order.buyerPhone,
    order.id,
    order.trackingRef,
    ...order.payments.map((row) => row.providerPaymentId),
  ]
  return haystack.some((value) => (value ?? '').toLowerCase().includes(q))
}

export type TimelineEvent = {
  at: string
  title: string
  detail: string | null
}

export function buildTimeline(order: SalesOrder): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { at: order.createdAt, title: 'Orden creada', detail: order.state },
  ]
  for (const row of order.activity) {
    if (row.action === 'CHECKOUT_PREFERENCE_ATTACHED') {
      events.push({
        at: row.at,
        title: 'Preferencia de pago creada',
        detail: row.result,
      })
    } else if (row.action === 'WEBHOOK_PAYMENT_APPLIED') {
      events.push({ at: row.at, title: 'Pago aplicado', detail: row.result })
    } else if (row.action === 'WEBHOOK_VERIFICATION_REJECTED') {
      events.push({
        at: row.at,
        title: 'Verificación rechazada',
        detail: row.result,
      })
    } else if (row.action === 'TICKET_REVOKED') {
      events.push({ at: row.at, title: 'Boleto revocado', detail: row.result })
    }
  }
  for (const hook of order.webhooks) {
    if (hook.receivedAt) {
      events.push({
        at: hook.receivedAt,
        title: 'Webhook recibido',
        detail: hook.signatureResult,
      })
    }
    if (hook.processedAt) {
      events.push({
        at: hook.processedAt,
        title: 'Webhook procesado',
        detail: hook.result ?? hook.processingState,
      })
    }
  }
  for (const row of order.verifications) {
    if (row.verifiedAt) {
      events.push({
        at: row.verifiedAt,
        title: 'Pago verificado',
        detail: row.normalizedResult,
      })
    }
  }
  for (const row of order.payments) {
    if (row.createdAt) {
      events.push({
        at: row.createdAt,
        title: 'Pago registrado',
        detail: `${row.provider} · ${row.normalizedState}`,
      })
    }
  }
  for (const ticket of order.tickets) {
    if (ticket.issuedAt) {
      events.push({
        at: ticket.issuedAt,
        title: 'Boleto generado',
        detail: ticket.state,
      })
    }
    if (ticket.emailState === 'SENT' && ticket.emailUpdatedAt) {
      events.push({
        at: ticket.emailUpdatedAt,
        title: 'Correo enviado',
        detail: 'SENT',
      })
    } else if (ticket.emailResult && ticket.emailUpdatedAt) {
      events.push({
        at: ticket.emailUpdatedAt,
        title: 'Envío de correo',
        detail: ticket.emailResult,
      })
    }
  }
  return events
    .filter((event) => event.at && !Number.isNaN(Date.parse(event.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export type Anomaly = {
  id: string
  orderId: string
  type: string
  buyer: string
  amountCents: number
  at: string | null
}

function buyerSummary(order: SalesOrder): string {
  const name = order.buyerName?.trim()
  if (name) return name
  return order.trackingRef || order.id.slice(0, 8)
}

export function anomaliesFor(order: SalesOrder, nowMs: number): Anomaly[] {
  const found: Anomaly[] = []
  const push = (type: string, at: string | null) => {
    found.push({
      id: `${order.id}:${type}`,
      orderId: order.id,
      type,
      buyer: buyerSummary(order),
      amountCents: order.totalCents,
      at,
    })
  }

  if (
    order.state === 'PAYMENT_PENDING' &&
    order.expiresAt &&
    Date.parse(order.expiresAt) < nowMs
  ) {
    push('Checkout vencido sigue en PAYMENT_PENDING', order.expiresAt)
  }

  const approved = approvedPayment(order)
  const approvedCount = order.payments.filter((row) => row.normalizedState === 'APPROVED').length
  if (approved && order.state !== 'PAID') {
    push('Pago APPROVED y la orden no está PAID', approved.providerUpdatedAt ?? approved.createdAt)
  }
  if (order.state === 'PAID' && approvedCount > 1 && !approved) {
    push('Proveedor ganador no determinado', order.updatedAt)
  }

  if (isSale(order) && !order.tickets.some((ticket) => ticket.issuedAt)) {
    push('Orden PAID sin boleto', approvedAt(order))
  }

  for (const ticket of order.tickets) {
    if (ticket.issuedAt && ticket.emailState !== 'SENT') {
      push('Boleto generado sin correo SENT', ticket.issuedAt)
    }
  }

  for (const payment of order.payments) {
    if (payment.amountCents != null && payment.amountCents !== order.totalCents) {
      push('Monto de la orden distinto al pago', payment.providerUpdatedAt ?? payment.createdAt)
      break
    }
  }

  const verificationFailed = order.verifications.some(
    (row) =>
      row.merchantOk === false ||
      row.referenceOk === false ||
      row.amountOk === false ||
      row.currencyOk === false,
  )
  const verificationActivity = order.activity.some(
    (row) => row.action === 'WEBHOOK_VERIFICATION_REJECTED',
  )
  if (verificationFailed || verificationActivity) {
    const at =
      order.verifications.find((row) => row.verifiedAt)?.verifiedAt ??
      order.activity.find((row) => row.action === 'WEBHOOK_VERIFICATION_REJECTED')?.at ??
      null
    push('Verificación de pago rechazada', at)
  }

  if (order.state === 'REQUIRES_REVIEW') {
    push('Orden en REQUIRES_REVIEW', order.updatedAt ?? order.createdAt)
  }

  if (isSale(order) && !approvedAt(order)) {
    push('Venta PAID sin fecha de aprobación', order.createdAt)
  }

  return found
}

export type SeriesPoint = {
  day: string
  sales: number
  revenueCents: number
  cumulativeSales: number
  cumulativeRevenueCents: number
}

export type ProductRow = {
  group: CommercialGroup
  groupLabel: string
  productCode: string
  productName: string
  block: string
  sales: number
  revenueCents: number
  participants: number
  salesShare: number
  revenueShare: number
}

export type PartnerRow = {
  key: string
  code: string | null
  name: string
  sales: number
  revenueCents: number
  netRevenueCents: number
  pendingGrossCents: number
  unreconciledCount: number
  participants: number
  averageTicketCents: number | null
}

export type ProviderRow = {
  provider: string
  approved: number
  approvedCents: number
  pending: number
  rejected: number
  cancelled: number
  refunded: number
  chargedBack: number
  unknown: number
}

export type StageRow = {
  stage: string
  sales: number
  revenueCents: number
}

export type LastSale = {
  id: string
  at: string
  trackingRef: string
  productName: string
  totalCents: number
}

export type DashboardView = {
  rangeError: string | null
  paidCount: number
  revenueCents: number
  processingCostCents: number
  netRevenueCents: number
  pendingGrossCents: number
  unreconciledCount: number
  createdCount: number
  preferencePending: number
  paymentPending: number
  rejectedCount: number
  averageTicketCents: number | null
  participants: number
  lastSale: LastSale | null
  series: SeriesPoint[]
  products: ProductRow[]
  stages: StageRow[]
  partners: PartnerRow[]
  providers: ProviderRow[]
  anomalies: Anomaly[]
  table: SalesOrder[]
}

const GROUP_ORDER: CommercialGroup[] = ['COMPITE', 'HALF', 'ASISTE', 'OTROS']

export function buildDashboard(
  orders: SalesOrder[],
  filters: SalesFilters,
  now: Date,
): DashboardView {
  const range = rangeForFilters(filters, now)
  const empty: DashboardView = {
    rangeError: 'error' in range ? range.error : null,
    paidCount: 0,
    revenueCents: 0,
    processingCostCents: 0,
    netRevenueCents: 0,
    pendingGrossCents: 0,
    unreconciledCount: 0,
    createdCount: 0,
    preferencePending: 0,
    paymentPending: 0,
    rejectedCount: 0,
    averageTicketCents: null,
    participants: 0,
    lastSale: null,
    series: [],
    products: [],
    stages: [],
    partners: [],
    providers: [],
    anomalies: [],
    table: [],
  }
  if ('error' in range) return empty

  const attributed = orders.filter((order) => matchesAttributes(order, filters))
  const created = attributed.filter((order) => inRange(order.createdAt, range))
  const paid = attributed.filter(
    (order) => isSale(order) && inRange(approvedAt(order), range),
  )
  const tableIds = new Set<string>([
    ...created.map((order) => order.id),
    ...paid.map((order) => order.id),
  ])
  const table = attributed
    .filter((order) => tableIds.has(order.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  const revenueCents = paid.reduce((sum, order) => sum + order.totalCents, 0)
  const participants = paid.reduce((sum, order) => sum + participantCount(order), 0)

  let lastSale: LastSale | null = null
  for (const order of paid) {
    const at = approvedAt(order)
    if (!at) continue
    if (!lastSale || Date.parse(at) > Date.parse(lastSale.at)) {
      lastSale = {
        id: order.id,
        at,
        trackingRef: order.trackingRef,
        productName: productLabel(order),
        totalCents: order.totalCents,
      }
    }
  }

  const byDay = new Map<string, { sales: number; revenueCents: number }>()
  for (const order of paid) {
    const at = approvedAt(order)
    if (!at) continue
    const day = meridaDayKey(at)
    const bucket = byDay.get(day) ?? { sales: 0, revenueCents: 0 }
    bucket.sales += 1
    bucket.revenueCents += order.totalCents
    byDay.set(day, bucket)
  }
  const days = [...byDay.keys()].sort()
  let cumulativeSales = 0
  let cumulativeRevenueCents = 0
  const series: SeriesPoint[] = days.map((day) => {
    const bucket = byDay.get(day)!
    cumulativeSales += bucket.sales
    cumulativeRevenueCents += bucket.revenueCents
    return {
      day,
      sales: bucket.sales,
      revenueCents: bucket.revenueCents,
      cumulativeSales,
      cumulativeRevenueCents,
    }
  })

  const productMap = new Map<string, ProductRow>()
  for (const order of paid) {
    const orderParticipants = participantCount(order)
    const lineCount = Math.max(order.lines.length, 1)
    for (const line of order.lines) {
      const group = commercialGroup(line)
      const key = line.productCode
      const row = productMap.get(key) ?? {
        group,
        groupLabel: GROUP_LABEL[group],
        productCode: line.productCode,
        productName: line.productName,
        block: line.block,
        sales: 0,
        revenueCents: 0,
        participants: 0,
        salesShare: 0,
        revenueShare: 0,
      }
      row.sales += 1
      row.revenueCents += Math.round(order.totalCents / lineCount)
      row.participants += line.quantity * line.teamSize
      productMap.set(key, row)
    }
    if (order.lines.length === 0) {
      const key = '(sin-producto)'
      const row = productMap.get(key) ?? {
        group: 'OTROS' as const,
        groupLabel: GROUP_LABEL.OTROS,
        productCode: '—',
        productName: 'Sin producto',
        block: '—',
        sales: 0,
        revenueCents: 0,
        participants: 0,
        salesShare: 0,
        revenueShare: 0,
      }
      row.sales += 1
      row.revenueCents += order.totalCents
      row.participants += orderParticipants
      productMap.set(key, row)
    }
  }
  const products = [...productMap.values()]
    .map((row) => ({
      ...row,
      salesShare: paid.length === 0 ? 0 : row.sales / paid.length,
      revenueShare: revenueCents === 0 ? 0 : row.revenueCents / revenueCents,
    }))
    .sort((a, b) => {
      const groupDelta = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
      if (groupDelta !== 0) return groupDelta
      return b.revenueCents - a.revenueCents
    })

  const stageMap = new Map<string, StageRow>()
  for (const order of paid) {
    const stage = order.commercialStage?.trim() || 'Sin etapa'
    const row = stageMap.get(stage) ?? { stage, sales: 0, revenueCents: 0 }
    row.sales += 1
    row.revenueCents += order.totalCents
    stageMap.set(stage, row)
  }
  const stages = [...stageMap.values()].sort((a, b) => b.revenueCents - a.revenueCents)

  const partnerMap = new Map<string, PartnerRow>()
  for (const order of paid) {
    const key = order.affiliateCode ?? 'DIRECT'
    const row = partnerMap.get(key) ?? {
      key,
      code: order.affiliateCode,
      name: order.affiliateCode
        ? order.affiliateName?.trim() || order.affiliateCode
        : 'VENTA DIRECTA',
      sales: 0,
      revenueCents: 0,
      netRevenueCents: 0,
      pendingGrossCents: 0,
      unreconciledCount: 0,
      participants: 0,
      averageTicketCents: null,
    }
    row.sales += 1
    row.revenueCents += order.totalCents
    const net = netRevenueCents(order)
    if (net == null) {
      row.pendingGrossCents += order.totalCents
      row.unreconciledCount += 1
    } else {
      row.netRevenueCents += net
    }
    row.participants += participantCount(order)
    partnerMap.set(key, row)
  }
  const partners = [...partnerMap.values()]
    .map((row) => ({
      ...row,
      averageTicketCents: row.sales === 0 ? null : Math.round(row.revenueCents / row.sales),
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)

  const providerMap = new Map<string, ProviderRow>()
  for (const order of table) {
    for (const payment of order.payments) {
      const row = providerMap.get(payment.provider) ?? {
        provider: payment.provider,
        approved: 0,
        approvedCents: 0,
        pending: 0,
        rejected: 0,
        cancelled: 0,
        refunded: 0,
        chargedBack: 0,
        unknown: 0,
      }
      if (payment.normalizedState === 'APPROVED') {
        row.approved += 1
        row.approvedCents += payment.amountCents ?? 0
      } else if (payment.normalizedState === 'PENDING') row.pending += 1
      else if (payment.normalizedState === 'REJECTED') row.rejected += 1
      else if (payment.normalizedState === 'CANCELLED') row.cancelled += 1
      else if (payment.normalizedState === 'REFUNDED') row.refunded += 1
      else if (payment.normalizedState === 'CHARGED_BACK') row.chargedBack += 1
      else row.unknown += 1
      providerMap.set(payment.provider, row)
    }
  }
  const providers = [...providerMap.values()].sort((a, b) =>
    a.provider.localeCompare(b.provider),
  )

  const reconciledPaid = paid.filter((order) => reconciliationStatus(order) === 'reconciled')
  const pendingPaid = paid.filter((order) => reconciliationStatus(order) === 'pending')
  const processingCosts = reconciledPaid.reduce(
    (sum, order) => sum + (processingCostCents(order) ?? 0),
    0,
  )
  const netRevenueCentsTotal = reconciledPaid.reduce(
    (sum, order) => sum + (netRevenueCents(order) ?? 0),
    0,
  )
  const pendingGrossCents = pendingPaid.reduce((sum, order) => sum + order.totalCents, 0)

  const anomalies = table
    .flatMap((order) => anomaliesFor(order, now.getTime()))
    .sort((a, b) => Date.parse(a.at ?? a.orderId) - Date.parse(b.at ?? b.orderId))

  return {
    rangeError: null,
    paidCount: paid.length,
    revenueCents,
    processingCostCents: processingCosts,
    netRevenueCents: netRevenueCentsTotal,
    pendingGrossCents,
    unreconciledCount: pendingPaid.length,
    createdCount: created.length,
    preferencePending: created.filter((order) => order.state === 'PREFERENCE_PENDING').length,
    paymentPending: created.filter((order) => order.state === 'PAYMENT_PENDING').length,
    rejectedCount: created.filter((order) => order.state === 'REJECTED').length,
    averageTicketCents:
      paid.length === 0 ? null : Math.round(revenueCents / paid.length),
    participants,
    lastSale,
    series,
    products,
    stages,
    partners,
    providers,
    anomalies,
    table,
  }
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(cents / 100)
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Merida',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(ms)
}

export function formatAge(iso: string | null, nowMs: number): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const minutes = Math.max(0, Math.round((nowMs - ms) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.round(hours / 24)} d`
}

export function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    PREFERENCE_PENDING: 'Preferencia pendiente',
    PAYMENT_PENDING: 'Pago pendiente',
    PAID: 'Pagada',
    REJECTED: 'Rechazada',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
    REQUIRES_REVIEW: 'Requiere revisión',
    REFUNDED: 'Reembolsada',
    CHARGED_BACK: 'Contracargo',
    CREATED: 'Creada',
  }
  return labels[state] ?? state
}

function csvReconciliationStatus(order: SalesOrder): string {
  const status = reconciliationStatus(order)
  if (status === 'pending') return 'PENDING'
  if (status === 'reconciled') return 'RECONCILED'
  return ''
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function ordersToCsv(orders: SalesOrder[]): string {
  const header = [
    'order_id',
    'tracking_ref',
    'fecha',
    'payment_date',
    'customer_name',
    'email',
    'phone',
    'product_code',
    'product_name',
    'quantity',
    'participants',
    'amount_mxn',
    'gross_amount_mxn',
    'provider_fee_mxn',
    'provider_fee_tax_mxn',
    'other_costs_mxn',
    'net_revenue_mxn',
    'reconciliation_status',
    'state',
    'payment_provider',
    'provider_payment_id',
    'affiliate_code',
  ]
  const lines = orders.map((order) => {
    const payment = approvedPayment(order) ?? (order.payments.length === 1 ? order.payments[0] : null)
    const amount = (order.totalCents / 100).toFixed(2)
    const adjustment = order.adjustment
    const net = netRevenueCents(order)
    const money = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2))
    return [
      order.id,
      order.trackingRef,
      order.createdAt,
      approvedAt(order) ?? '',
      order.buyerName ?? '',
      order.buyerEmail ?? '',
      order.buyerPhone ?? '',
      productCodes(order),
      productLabel(order),
      String(quantityCount(order)),
      String(participantCount(order)),
      amount,
      amount,
      money(adjustment ? adjustment.providerFeeCents : null),
      money(adjustment ? adjustment.providerFeeTaxCents : null),
      money(adjustment ? adjustment.otherCostsCents : null),
      money(adjustment ? net : null),
      csvReconciliationStatus(order),
      order.state,
      payment?.provider ?? '',
      payment?.providerPaymentId ?? '',
      order.affiliateCode ?? '',
    ].map(csvCell).join(',')
  })
  return `\uFEFF${header.join(',')}\n${lines.join('\n')}\n`
}
