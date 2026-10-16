import { describe, expect, it } from 'vitest'

import { buildSalesReport, countedSalesToCsv } from '../../../src/sales-dashboard/counted-sales'
import { buildContacts } from '../../../src/sales-dashboard/commercial'
import { HARNESS_LEGACY, HARNESS_SNAPSHOT } from '../../../src/sales-dashboard/harness-snapshot'
import { EMPTY_FILTERS, type SalesOrder } from '../../../src/sales-dashboard/model'

const now = new Date('2026-09-23T18:00:00.000Z')
const filters = {
  ...EMPTY_FILTERS,
  preset: 'custom' as const,
  customFrom: '2026-07-01',
  customTo: '2026-09-23',
}

describe('counted sales', () => {
  it('keeps both sources and drops a legacy row that repeats a payment id', () => {
    const legacy = [
      ...HARNESS_LEGACY,
      {
        ...HARNESS_LEGACY[1]!,
        id: 'legacy-same-payment',
        originalPaymentId: 'pay-ind',
        email: 'otra@example.com',
        amountCents: 150000,
      },
    ]
    const report = buildSalesReport({
      orders: HARNESS_SNAPSHOT.orders,
      legacy,
      eventCode: 'HEX-2026',
      filters,
      now,
      source: 'all',
      manualOrderIds: new Set(),
    })
    expect(report.sales.some((sale) => sale.id === 'legacy-same-payment')).toBe(false)
    expect(report.readyCount).toBeGreaterThan(0)
    expect(report.legacyCount).toBeGreaterThan(0)
    expect(report.count).toBe(report.readyCount + report.legacyCount + report.manualCount)
    const csv = countedSalesToCsv(report.sales)
    expect(csv.split('\n')[0]).toContain('fecha_venta')
    expect(csv).not.toContain('legacy-same-payment')
  })

  it('leaves legacy out of a Community Partner filter', () => {
    const report = buildSalesReport({
      orders: HARNESS_SNAPSHOT.orders,
      legacy: HARNESS_LEGACY,
      eventCode: 'HEX-2026',
      filters: { ...filters, affiliate: 'ENFORMA' },
      now,
      source: 'all',
      manualOrderIds: new Set(),
    })
    expect(report.legacyCount).toBe(0)
    expect(report.sales.every((sale) => sale.partnerCode === 'ENFORMA')).toBe(true)
  })

  it('filters both sources by product and sale date, not by import date', () => {
    const byProduct = buildSalesReport({
      orders: HARNESS_SNAPSHOT.orders,
      legacy: HARNESS_LEGACY,
      eventCode: 'HEX-2026',
      filters: { ...filters, productCode: 'DOB-SAB-HH' },
      now,
      source: 'all',
      manualOrderIds: new Set(),
    })
    expect(byProduct.sales.every((sale) => sale.productCode === 'DOB-SAB-HH')).toBe(true)
    expect(byProduct.legacyCount).toBe(1)
    const outsideSale = buildSalesReport({
      orders: HARNESS_SNAPSHOT.orders,
      legacy: HARNESS_LEGACY,
      eventCode: 'HEX-2026',
      filters: { ...filters, customFrom: '2026-09-26', customTo: '2026-09-26' },
      now,
      source: 'all',
      manualOrderIds: new Set(),
    })
    expect(outsideSale.count).toBe(0)
  })
})

describe('buyer identity', () => {
  it('keeps a person as a buyer when the legacy payment is already on the current order', () => {
    const order = HARNESS_SNAPSHOT.orders.find((row) => row.buyerEmail === 'ana@example.com') as SalesOrder
    const contacts = buildContacts(
      [order],
      [{
        id: 'legacy-ana-paid',
        eventCode: 'HEX-2026',
        originalStatus: 'paid',
        commercialStatus: 'LEGACY_PAID',
        originalCreatedAt: '2026-07-01T12:00:00.000Z',
        originalUpdatedAt: '2026-07-02T12:00:00.000Z',
        buyerContactId: null,
        name: 'Ana López',
        email: 'ana@example.com',
        phone: null,
        categoryCode: 'IND-H',
        categoryName: 'Individual Hombre',
        amountCents: 150000,
        currency: 'MXN',
        originalPaymentId: 'pay-ind',
      }],
      'HEX-2026',
    )
    const ana = contacts.find((contact) => contact.email === 'ana@example.com')
    expect(ana?.buyer).toBe(true)
    expect(ana?.opportunity).toBe(false)
    expect(ana?.paidCents).toBe(order.totalCents)
  })
})
