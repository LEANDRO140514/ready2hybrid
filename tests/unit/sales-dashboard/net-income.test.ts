import { describe, expect, it } from 'vitest'

import type { LegacyReconcileRow } from '../../../src/sales-dashboard/legacy-reconciliation'
import { NET_INCOME_NOTE, netIncomeToCsv } from '../../../src/sales-dashboard/net-income'
import type { SalesOrder } from '../../../src/sales-dashboard/model'

function paid(partial: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'ord-1',
    trackingRef: 'ord-1',
    state: 'PAID',
    currency: 'MXN',
    totalCents: 100000,
    createdAt: '2026-09-20T15:00:00.000Z',
    updatedAt: null,
    expiresAt: null,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: null,
    buyerName: 'Ana',
    buyerEmail: 'ana@example.com',
    buyerPhone: null,
    lines: [],
    payments: [{
      id: 'pay-1',
      provider: 'MERCADOPAGO',
      providerPaymentId: 'mp-1',
      normalizedState: 'APPROVED',
      amountCents: 100000,
      providerUpdatedAt: '2026-09-20T16:00:00.000Z',
      createdAt: '2026-09-20T16:00:00.000Z',
    }],
    tickets: [],
    roster: [],
    activity: [],
    webhooks: [],
    verifications: [],
    adjustment: null,
    ...partial,
  }
}

const legacy: LegacyReconcileRow = {
  id: 'leg-1',
  operationKey: 'op-1',
  recordRef: 'rec-1',
  categoryName: 'Individual',
  paidAt: '2026-08-02T18:00:00.000Z',
  grossCents: 80000,
  courtesyTag: false,
  reconciliation: {
    provider: 'MERCADOPAGO',
    bankReference: 'ref',
    depositedCents: 76000,
    feeCents: 4000,
    reconciledAt: '2026-08-03T18:00:00.000Z',
    updatedAt: '2026-08-03T18:00:00.000Z',
  },
}

describe('unified net income csv', () => {
  it('leaves Ready2Hybrid money cells empty until an adjustment exists', () => {
    const csv = netIncomeToCsv([paid()], [], 'pending')
    const lines = csv.replace(/^\uFEFF/, '').split('\n')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(lines[0]).toContain(NET_INCOME_NOTE)
    const row = lines[2] ?? ''
    expect(row).toContain('"1000.00"')
    expect(row).toContain('"No"')
    expect(row).not.toContain('"0.00"')
  })

  it('documents that the legacy commission already includes VAT', () => {
    const csv = netIncomeToCsv(
      [],
      [legacy, { ...legacy, id: 'free', grossCents: 0, reconciliation: null }],
      'done',
    )
    expect(csv).toContain(NET_INCOME_NOTE)
    expect(csv).toContain('"40.00"')
    expect(csv).toContain('"760.00"')
    expect(csv).toContain('"Sí"')
    expect(csv).not.toContain('free')
    expect(csv).toContain('TOTAL BRUTO')
    expect(csv).toContain('NETO CONCILIADO')
    expect(csv).toContain('BRUTO SIN CONCILIAR')
  })
})
