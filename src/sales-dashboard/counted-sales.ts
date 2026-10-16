/**
 * Sales that count after the payment-id cross.
 * Date filter uses the sale date: approved payment time for Ready2Hybrid,
 * historical confirmation for legacy. Registration and import dates are
 * carried so the screen can show them, and they do not move the period.
 * Legacy has no Community Partner. A partner filter leaves those rows out.
 */
import type { LegacyRegistration } from './commercial'
import {
  approvedAt,
  matchesAttributes,
  meridaDayKey,
  participantCount,
  productLabel,
  rangeForFilters,
  type SalesFilters,
  type SalesOrder,
} from './model'
import { buildSourceLedger, type LedgerOverride } from './source-ledger'

export type SaleSource = 'ready2hybrid' | 'legacy' | 'manual'

export type CountedSale = {
  id: string
  source: SaleSource
  saleAt: string | null
  registeredAt: string | null
  importedAt: string | null
  productCode: string
  productName: string
  amountCents: number
  participants: number
  email: string | null
  buyerName: string | null
  partnerCode: string | null
  partnerName: string | null
}

export type SalesDayPoint = {
  day: string
  sales: number
  revenueCents: number
  ready: number
  legacy: number
  manual: number
  cumulativeSales: number
  cumulativeRevenueCents: number
}

export type SalesProductPoint = {
  productCode: string
  productName: string
  sales: number
  revenueCents: number
  ready: number
  legacy: number
  manual: number
  participants: number
}

export type SalesReport = {
  error: string | null
  sales: CountedSale[]
  count: number
  cents: number
  readyCount: number
  readyCents: number
  legacyCount: number
  legacyCents: number
  manualCount: number
  manualCents: number
  series: SalesDayPoint[]
  products: SalesProductPoint[]
}

const SOURCE_LABEL: Record<SaleSource, string> = {
  ready2hybrid: 'Ready2Hybrid',
  legacy: 'Legacy',
  manual: 'Resuelta manualmente',
}

export function saleSourceLabel(source: SaleSource): string {
  return SOURCE_LABEL[source]
}

export function buildSalesReport(input: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  filters: SalesFilters
  now: Date
  source: 'all' | 'current' | 'legacy'
  manualOrderIds: ReadonlySet<string>
  overrides?: LedgerOverride[]
}): SalesReport {
  const range = rangeForFilters(input.filters, input.now)
  if ('error' in range) return emptyReport(range.error)
  const sales = countedSales(input).filter((sale) => inWindow(sale.saleAt, range.startMs, range.endMs))
  return summarize(sales)
}

function emptyReport(error: string | null): SalesReport {
  return {
    error,
    sales: [],
    count: 0,
    cents: 0,
    readyCount: 0,
    readyCents: 0,
    legacyCount: 0,
    legacyCents: 0,
    manualCount: 0,
    manualCents: 0,
    series: [],
    products: [],
  }
}

function countedSales(input: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  filters: SalesFilters
  source: 'all' | 'current' | 'legacy'
  manualOrderIds: ReadonlySet<string>
  overrides?: LedgerOverride[]
}): CountedSale[] {
  const orders = input.orders.filter((order) => order.state === 'PAID' || input.manualOrderIds.has(order.id))
  const legacy = input.legacy.filter((row) => row.eventCode === input.eventCode && row.commercialStatus === 'LEGACY_PAID')
  const ledger = buildSourceLedger({
    orders: orders.map((order) => ({
      id: order.id,
      state: order.state,
      totalCents: order.totalCents,
      email: order.buyerEmail,
      productCode: order.lines[0]?.productCode ?? null,
      approvedPaymentIds: order.payments
        .filter((payment) => payment.normalizedState === 'APPROVED')
        .map((payment) => payment.providerPaymentId),
    })),
    legacy: legacy.map((row) => ({
      id: row.id,
      commercialStatus: row.commercialStatus,
      email: row.email ?? null,
      productCode: row.categoryCode,
      amountCents: row.amountCents,
      paymentId: row.originalPaymentId ?? null,
      missingSince: row.missingSince ?? null,
    })),
    manualOrderIds: input.manualOrderIds,
    overrides: input.overrides,
  })
  const excluded = new Set(ledger.excludedLegacyIds)
  const overrideById = new Map((input.overrides ?? []).map((row) => [row.legacyId, row.valueCents]))
  const current = orders
    .filter((order) => matchesAttributes(order, input.filters))
    .filter(() => input.source !== 'legacy')
    .map((order): CountedSale => ({
    id: order.id,
    source: order.state === 'PAID' ? 'ready2hybrid' : 'manual',
    saleAt: approvedAt(order) ?? order.createdAt,
    registeredAt: order.createdAt,
    importedAt: null,
    productCode: order.lines[0]?.productCode ?? '',
    productName: productLabel(order),
    amountCents: order.totalCents,
    participants: participantCount(order),
    email: order.buyerEmail,
    buyerName: order.buyerName,
    partnerCode: order.affiliateCode,
    partnerName: order.affiliateCode ? order.affiliateName?.trim() || order.affiliateCode : 'Venta directa',
  }))
  const historical = legacy
    .filter((row) => !excluded.has(row.id))
    .map((row): CountedSale => ({
    id: row.id,
    source: 'legacy',
    saleAt: row.originalUpdatedAt,
    registeredAt: row.originalCreatedAt,
    importedAt: row.importedAt ?? null,
    productCode: row.categoryCode ?? '',
    productName: row.categoryName || row.categoryCode || 'Sin producto',
    amountCents: overrideById.get(row.id) ?? row.amountCents ?? 0,
    participants: 1,
    email: row.email ?? null,
    buyerName: row.name ?? null,
    partnerCode: null,
    partnerName: null,
  }))
  return [
    ...current,
    ...historical.filter((sale) => saleMatches(sale, input.filters, input.source)),
  ]
}

function saleMatches(sale: CountedSale, filters: SalesFilters, source: 'all' | 'current' | 'legacy'): boolean {
  if (source === 'current' && sale.source === 'legacy') return false
  if (source === 'legacy' && sale.source !== 'legacy') return false
  if (filters.productCode && sale.productCode !== filters.productCode) return false
  if (filters.affiliate) {
    if (sale.source === 'legacy') return false
    if (filters.affiliate === 'DIRECT' && sale.partnerCode) return false
    if (filters.affiliate !== 'DIRECT' && sale.partnerCode !== filters.affiliate) return false
  }
  if (sale.source === 'legacy') {
    if (filters.provider || filters.reconciliation) return false
    if (filters.orderState && filters.orderState !== 'PAID') return false
    if (filters.group && groupForCode(sale.productCode) !== filters.group) return false
  }
  const query = filters.search.trim().toLowerCase()
  if (!query) return true
  return [sale.buyerName, sale.email, sale.productCode, sale.productName, sale.id]
    .some((value) => (value ?? '').toLowerCase().includes(query))
}

function groupForCode(code: string): string {
  if (code.startsWith('HALF-')) return 'HALF'
  if (code.startsWith('PUB-')) return 'ASISTE'
  if (code.startsWith('DOB-') || code.startsWith('IND-') || code.startsWith('REL-')) return 'COMPITE'
  return 'OTROS'
}

function summarize(sales: CountedSale[]): SalesReport {
  const ready = sales.filter((sale) => sale.source === 'ready2hybrid')
  const legacy = sales.filter((sale) => sale.source === 'legacy')
  const manual = sales.filter((sale) => sale.source === 'manual')
  const sum = (rows: CountedSale[]) => rows.reduce((total, sale) => total + sale.amountCents, 0)
  const byDay = new Map<string, SalesDayPoint>()
  for (const sale of sales) {
    if (!sale.saleAt) continue
    const day = meridaDayKey(sale.saleAt)
    const point = byDay.get(day) ?? {
      day,
      sales: 0,
      revenueCents: 0,
      ready: 0,
      legacy: 0,
      manual: 0,
      cumulativeSales: 0,
      cumulativeRevenueCents: 0,
    }
    point.sales += 1
    point.revenueCents += sale.amountCents
    if (sale.source === 'ready2hybrid') point.ready += 1
    if (sale.source === 'legacy') point.legacy += 1
    if (sale.source === 'manual') point.manual += 1
    byDay.set(day, point)
  }
  let cumulativeSales = 0
  let cumulativeRevenueCents = 0
  const series = [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((point) => {
      cumulativeSales += point.sales
      cumulativeRevenueCents += point.revenueCents
      return { ...point, cumulativeSales, cumulativeRevenueCents }
    })
  const byProduct = new Map<string, SalesProductPoint>()
  for (const sale of sales) {
    const key = sale.productCode || '—'
    const row = byProduct.get(key) ?? {
      productCode: key,
      productName: sale.productName,
      sales: 0,
      revenueCents: 0,
      ready: 0,
      legacy: 0,
      manual: 0,
      participants: 0,
    }
    row.sales += 1
    row.revenueCents += sale.amountCents
    row.participants += sale.participants
    if (sale.source === 'ready2hybrid') row.ready += 1
    if (sale.source === 'legacy') row.legacy += 1
    if (sale.source === 'manual') row.manual += 1
    byProduct.set(key, row)
  }
  return {
    error: null,
    sales,
    count: sales.length,
    cents: sum(sales),
    readyCount: ready.length,
    readyCents: sum(ready),
    legacyCount: legacy.length,
    legacyCents: sum(legacy),
    manualCount: manual.length,
    manualCents: sum(manual),
    series,
    products: [...byProduct.values()].sort((a, b) => b.revenueCents - a.revenueCents),
  }
}

function inWindow(iso: string | null, startMs: number, endMs: number): boolean {
  if (!iso) return false
  const ms = Date.parse(iso)
  return !Number.isNaN(ms) && ms >= startMs && ms < endMs
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function countedSalesToCsv(sales: CountedSale[]): string {
  const header = [
    'source',
    'fecha_venta',
    'fecha_registro',
    'fecha_importacion',
    'product_code',
    'product_name',
    'amount_mxn',
    'email',
    'name',
    'community_partner',
  ]
  const lines = sales.map((sale) => [
    SOURCE_LABEL[sale.source],
    sale.saleAt ?? '',
    sale.registeredAt ?? '',
    sale.importedAt ?? '',
    sale.productCode,
    sale.productName,
    (sale.amountCents / 100).toFixed(2),
    sale.email ?? '',
    sale.buyerName ?? '',
    sale.partnerCode ?? '',
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}
