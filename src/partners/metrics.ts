import {
  approvedAt,
  isSale,
  participantCount,
  type SalesOrder,
} from '../sales-dashboard/model'

export type PartnerStudioMetrics = {
  paidSales: number
  participants: number
  revenueCents: number
  lastSaleAt: string | null
}

export function metricsForPartner(orders: SalesOrder[], code: string): PartnerStudioMetrics {
  const paid = orders.filter((order) => isSale(order) && order.affiliateCode === code)
  let lastSaleAt: string | null = null
  let lastMs = Number.NEGATIVE_INFINITY
  for (const order of paid) {
    const at = approvedAt(order)
    const ms = at ? Date.parse(at) : Number.NaN
    if (!Number.isNaN(ms) && ms >= lastMs) {
      lastMs = ms
      lastSaleAt = at
    }
  }
  return {
    paidSales: paid.length,
    participants: paid.reduce((sum, order) => sum + participantCount(order), 0),
    revenueCents: paid.reduce((sum, order) => sum + order.totalCents, 0),
    lastSaleAt,
  }
}

export function ordersForPartner(orders: SalesOrder[], code: string): SalesOrder[] {
  return orders
    .filter((order) => order.affiliateCode === code)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
