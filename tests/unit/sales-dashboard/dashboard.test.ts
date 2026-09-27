import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { assembleSalesSnapshot } from '../../../insforge/functions/_shared/sales-read/assemble'
import {
  classifySalesReadRequest,
  roleMayReadSales,
} from '../../../insforge/functions/_shared/sales-read/gate'
import {
  anomaliesFor,
  buildDashboard,
  buildTimeline,
  commercialGroup,
  EMPTY_FILTERS,
  netRevenueCents,
  ordersToCsv,
  reconciliationStatus,
  type FinanceAdjustment,
  type SalesOrder,
} from '../../../src/sales-dashboard/model'
import { parseSalesSnapshot } from '../../../src/sales-dashboard/port'
import {
  HARNESS_NOW,
  HARNESS_SNAPSHOT,
} from '../../../src/sales-dashboard/harness-snapshot'

const now = HARNESS_NOW

describe('sales dashboard model', () => {
  it('opens on the 30 day period', () => {
    expect(EMPTY_FILTERS.preset).toBe('30d')
  })

  it('counts only PAID orders as sales and uses total_cents', () => {
    const view = buildDashboard(HARNESS_SNAPSHOT.orders, EMPTY_FILTERS, now)
    expect(view.paidCount).toBe(3)
    expect(view.revenueCents).toBe(150000 + 250000 + 80000)
    expect(view.createdCount).toBe(6)
    expect(view.preferencePending).toBe(1)
    expect(view.paymentPending).toBe(2)
    expect(view.rejectedCount).toBe(0)
    expect(view.participants).toBe(4)
    expect(view.averageTicketCents).toBe(Math.round(view.revenueCents / 3))
    expect(view.lastSale?.trackingRef).toBe('TRK-GAP')
  })

  it('keeps yesterday out of Hoy and includes it in 7 days', () => {
    const today = buildDashboard(
      HARNESS_SNAPSHOT.orders,
      { ...EMPTY_FILTERS, preset: 'today' },
      now,
    )
    const week = buildDashboard(
      HARNESS_SNAPSHOT.orders,
      { ...EMPTY_FILTERS, preset: '7d' },
      now,
    )
    expect(today.table.map((order) => order.trackingRef)).not.toContain('TRK-OLD')
    expect(week.createdCount).toBe(6)
    expect(week.paymentPending).toBe(2)
    expect(week.anomalies.some((row) => row.type.includes('PAYMENT_PENDING'))).toBe(
      true,
    )
  })

  it('treats a null affiliate as venta directa and keeps the partner separate', () => {
    const view = buildDashboard(HARNESS_SNAPSHOT.orders, EMPTY_FILTERS, now)
    const direct = view.partners.find((row) => row.key === 'DIRECT')
    const partner = view.partners.find((row) => row.code === 'ENFORMA')
    expect(direct?.name).toBe('VENTA DIRECTA')
    expect(direct?.sales).toBe(2)
    expect(partner?.sales).toBe(1)
    expect(partner?.participants).toBe(2)
    expect(partner?.revenueCents).toBe(250000)
  })

  it('does not treat a revoked ticket with SENT email as a missing email', () => {
    const paid = HARNESS_SNAPSHOT.orders.find((order) => order.trackingRef === 'TRK-IND')
    expect(paid).toBeTruthy()
    const types = anomaliesFor(paid as SalesOrder, now.getTime()).map((row) => row.type)
    expect(types.some((type) => type.includes('correo'))).toBe(false)
    expect(paid?.tickets[0]?.state).toBe('REVOKED')
    expect(paid?.tickets[0]?.emailState).toBe('SENT')
  })

  it('flags amount mismatch, missing ticket, approved-but-not-paid, and rejected verification', () => {
    const view = buildDashboard(HARNESS_SNAPSHOT.orders, EMPTY_FILTERS, now)
    const types = view.anomalies.map((row) => row.type)
    expect(types).toContain('Orden PAID sin boleto')
    expect(types).toContain('Monto de la orden distinto al pago')
    expect(types).toContain('Pago APPROVED y la orden no está PAID')
    expect(types).toContain('Verificación de pago rechazada')
  })

  it('puts workout and press under historical, not active blocks', () => {
    expect(
      commercialGroup({
        productCode: 'WOD-H',
        productName: 'Workout',
        block: 'EXPERIENCE',
        kind: 'workout',
        saleState: 'AVAILABLE',
        teamSize: 1,
        quantity: 1,
      }),
    ).toBe('OTROS')
    expect(
      commercialGroup({
        productCode: 'FOT-H',
        productName: 'Prensa',
        block: 'EXPERIENCE',
        kind: 'press',
        saleState: 'AVAILABLE',
        teamSize: 1,
        quantity: 1,
      }),
    ).toBe('OTROS')
  })

  it('exports the filtered order set, not the unfiltered snapshot', () => {
    const view = buildDashboard(
      HARNESS_SNAPSHOT.orders,
      { ...EMPTY_FILTERS, productCode: 'HALF-IND-M' },
      now,
    )
    const csv = ordersToCsv(view.table)
    expect(csv).toContain('TRK-GAP')
    expect(csv).toContain('gap@example.com')
    expect(csv).not.toContain('TRK-IND')
    expect(csv).not.toContain('ana@example.com')
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('builds a timeline only from persisted timestamps', () => {
    const order = HARNESS_SNAPSHOT.orders[0] as SalesOrder
    const timeline = buildTimeline(order)
    expect(timeline.length).toBeGreaterThan(0)
    expect(timeline.every((event) => event.at.length > 0 && !Number.isNaN(Date.parse(event.at)))).toBe(
      true,
    )
    expect(timeline.some((event) => event.title === 'Orden creada')).toBe(true)
    expect(timeline.some((event) => event.title === 'Pago aplicado')).toBe(true)
  })
})

describe('sales read contract', () => {
  it('rejects mutation views', () => {
    for (const view of ['update', 'delete', 'refund', 'insert', 'patch']) {
      expect(classifySalesReadRequest(view)).toEqual({
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
      })
    }
    expect(classifySalesReadRequest('snapshot').ok).toBe(true)
    expect(classifySalesReadRequest('whoami').ok).toBe(true)
    expect(classifySalesReadRequest('upsert-adjustment').ok).toBe(true)
  })

  it('allows only OWNER and FINANCE to read', () => {
    expect(roleMayReadSales('FINANCE')).toBe(true)
    expect(roleMayReadSales('OWNER')).toBe(true)
    expect(roleMayReadSales('OPERATIONS_MANAGER')).toBe(false)
    expect(roleMayReadSales('CHECKIN_STAFF')).toBe(false)
    expect(roleMayReadSales('SOLUTION_DESK')).toBe(false)
    expect(roleMayReadSales(null)).toBe(false)
  })

  it('assembles bigint strings and keeps ticket state separate from email state', () => {
    const raw = assembleSalesSnapshot(
      {
        orders: [
          {
            id: 'ord-1',
            buyer_contact_id: 'buy-1',
            state: 'PAID',
            currency: 'MXN',
            total_cents: '150000',
            tracking_ref: 'TRK-1',
            created_at: '2026-09-23T15:00:00.000Z',
            affiliate_code: null,
            commercial_snapshot: { commercial_stage: 'LAUNCH' },
          },
        ],
        buyers: [{ id: 'buy-1', name: 'Ana', email: 'ana@example.com', phone: '999' }],
        items: [{ order_id: 'ord-1', product_code: 'IND-H', quantity: '1' }],
        products: [
          {
            code: 'IND-H',
            name: 'Individual',
            block: 'COMPITE',
            kind: 'competitor',
            team_size: '1',
            sale_state: 'AVAILABLE',
          },
        ],
        payments: [
          {
            id: 'pay-row',
            order_id: 'ord-1',
            provider: 'MERCADOPAGO',
            provider_payment_id: 'mp-1',
            normalized_state: 'APPROVED',
            amount_cents: '150000',
            provider_updated_at: '2026-09-23T15:05:00.000Z',
            created_at: '2026-09-23T15:05:00.000Z',
          },
        ],
        registrations: [{ id: 'reg-1', order_id: 'ord-1', participant_id: 'p-1', team_id: null }],
        tickets: [
          {
            id: 't-1',
            registration_id: 'reg-1',
            state: 'REVOKED',
            issued_at: '2026-09-23T15:06:00.000Z',
            folio: 'F',
          },
        ],
        outbox: [
          {
            domain_event_ref: 'ticket:t-1',
            state: 'SENT',
            result: 'resend',
            updated_at: '2026-09-23T15:07:00.000Z',
          },
        ],
        verifications: [],
        activity: [],
        webhooks: [],
        affiliates: [],
        members: [],
        participants: [{ id: 'p-1', name: 'Ana' }],
        adjustments: [],
      },
      '2026-09-23T18:00:00.000Z',
    )
    const snapshot = parseSalesSnapshot(raw)
    const view = buildDashboard(snapshot.orders, EMPTY_FILTERS, now)
    expect(snapshot.orders[0]?.totalCents).toBe(150000)
    expect(snapshot.orders[0]?.tickets[0]?.state).toBe('REVOKED')
    expect(snapshot.orders[0]?.tickets[0]?.emailState).toBe('SENT')
    expect(view.paidCount).toBe(1)
    expect(view.revenueCents).toBe(150000)
    expect(anomaliesFor(snapshot.orders[0] as SalesOrder, now.getTime())).toEqual([])
  })
})

describe('sales read is not a write API', () => {
  it('keeps the function and the migration free of client writes', () => {
    const fn = readFileSync(
      resolve(process.cwd(), 'insforge/functions/ops-sales-read/index.ts'),
      'utf8',
    )
    expect(fn).not.toMatch(/\.insert\(/)
    expect(fn).not.toMatch(/\.update\(/)
    expect(fn).not.toMatch(/\.delete\(/)
    expect(fn).not.toMatch(/\.upsert\(/)
    expect(fn).toContain("classifySalesReadRequest")

    const sql = readFileSync(
      resolve(process.cwd(), 'insforge/migrations/0030_dashboard-readers.sql'),
      'utf8',
    )
    const code = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    expect(code).toContain("CHECK (role IN ('OWNER', 'FINANCE'))")
    expect(code).toMatch(/REVOKE ALL ON TABLE public\.dashboard_readers FROM anon, authenticated/)
    expect(code).not.toMatch(/\b(BEGIN|COMMIT)\b/)
    expect(code).not.toMatch(/GRANT .* ON TABLE public\.orders/i)

    const financeSql = readFileSync(
      resolve(process.cwd(), 'insforge/migrations/0031_payment-finance-adjustments.sql'),
      'utf8',
    )
    const financeCode = financeSql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    expect(financeCode).toContain('CREATE TABLE public.payment_finance_adjustments')
    expect(financeCode).toContain('provider_fee_cents >= 0')
    expect(financeCode).toContain("source IN ('MANUAL', 'PROVIDER')")
    expect(financeCode).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/m)
    expect(financeCode).not.toMatch(/ALTER TABLE public\.orders/i)
    expect(financeCode).not.toMatch(/ALTER TABLE public\.payments/i)
    expect(financeCode).not.toMatch(/GRANT .* ON TABLE public\.orders/i)
    expect(financeCode).toMatch(
      /REVOKE ALL ON TABLE public\.payment_finance_adjustments FROM anon, authenticated/,
    )

    const adjust = readFileSync(
      resolve(process.cwd(), 'insforge/functions/_shared/sales-read/adjust.ts'),
      'utf8',
    )
    expect(adjust).toMatch(/from\('payment_finance_adjustments'\)\s*\.insert/)
    expect(adjust).toMatch(/from\('payment_finance_adjustments'\)\s*\.update/)
    expect(adjust).not.toMatch(/from\('orders'\)\s*\.(insert|update|delete|upsert)/)
    expect(adjust).not.toMatch(/from\('payments'\)\s*\.(insert|update|delete|upsert)/)

    const handler = readFileSync(
      resolve(process.cwd(), 'insforge/functions/ops-sales-read/index.ts'),
      'utf8',
    )
    const unauthorized = handler.indexOf("error: 'UNAUTHORIZED'")
    const forbidden = handler.lastIndexOf('roleMayReadSales')
    const save = handler.lastIndexOf('saveFinanceAdjustment')
    expect(unauthorized).toBeGreaterThan(0)
    expect(unauthorized).toBeLessThan(save)
    expect(forbidden).toBeLessThan(save)
  })
})

describe('finance reconciliation math', () => {
  function captured(order: SalesOrder, fee: number, tax: number, other: number): SalesOrder {
    const payment = order.payments[0]
    if (!payment) throw new Error('fixture sin pago')
    const row: FinanceAdjustment = {
      id: 'adj-1',
      orderId: order.id,
      paymentId: payment.id,
      provider: payment.provider,
      providerFeeCents: fee,
      providerFeeTaxCents: tax,
      otherCostsCents: other,
      notes: null,
      source: 'MANUAL',
      createdBy: 'user-a',
      createdAt: '2026-09-23T18:00:00.000Z',
      updatedBy: 'user-a',
      updatedAt: '2026-09-23T18:00:00.000Z',
      createdByLabel: 'Ana Finanzas',
      updatedByLabel: 'Ana Finanzas',
    }
    return { ...order, adjustment: row }
  }

  it('keeps an uncaptured $1,500 sale pending and computes net after capture', () => {
    const order = HARNESS_SNAPSHOT.orders.find((row) => row.trackingRef === 'TRK-IND')
    if (!order) throw new Error('falta TRK-IND')
    expect(order.totalCents).toBe(150000)
    expect(reconciliationStatus(order)).toBe('pending')
    expect(netRevenueCents(order)).toBeNull()

    const capturedOrder = captured(order, 6000, 960, 0)
    expect(reconciliationStatus(capturedOrder)).toBe('reconciled')
    expect(netRevenueCents(capturedOrder)).toBe(143040)

    const edited = captured(order, 7000, 960, 0)
    edited.adjustment = edited.adjustment && {
      ...edited.adjustment,
      updatedBy: 'user-b',
      updatedAt: '2026-09-23T19:00:00.000Z',
    }
    expect(edited.adjustment?.updatedBy).toBe('user-b')
    expect(edited.adjustment?.updatedAt).not.toBe(order.updatedAt)
    expect(netRevenueCents(edited)).toBe(142040)

    const zeros = captured(order, 0, 0, 0)
    expect(reconciliationStatus(zeros)).toBe('reconciled')
    expect(netRevenueCents(zeros)).toBe(150000)
  })

  it('filters pending and reconciled paid orders only', () => {
    const orders = HARNESS_SNAPSHOT.orders.map((order) =>
      order.trackingRef === 'TRK-IND' ? captured(order, 0, 0, 0) : order,
    )
    const pending = buildDashboard(
      orders,
      { ...EMPTY_FILTERS, reconciliation: 'pending' },
      now,
    )
    const reconciled = buildDashboard(
      orders,
      { ...EMPTY_FILTERS, reconciliation: 'reconciled' },
      now,
    )
    expect(pending.table.map((order) => order.trackingRef)).toContain('TRK-DOB')
    expect(pending.table.map((order) => order.trackingRef)).not.toContain('TRK-IND')
    expect(pending.table.every((order) => order.state === 'PAID')).toBe(true)
    expect(reconciled.table.map((order) => order.trackingRef)).toEqual(['TRK-IND'])
    expect(pending.unreconciledCount).toBe(2)
    expect(pending.netRevenueCents).toBe(0)
    expect(pending.pendingGrossCents).toBe(330000)
    expect(reconciled.processingCostCents).toBe(0)
    expect(reconciled.netRevenueCents).toBe(150000)
    expect(reconciled.pendingGrossCents).toBe(0)
  })

  it('keeps period net on reconciled sales only', () => {
    const mixed = HARNESS_SNAPSHOT.orders.map((order) =>
      order.trackingRef === 'TRK-IND' ? captured(order, 6000, 960, 0) : order,
    )
    const view = buildDashboard(mixed, EMPTY_FILTERS, now)
    expect(view.revenueCents).toBe(480000)
    expect(view.processingCostCents).toBe(6960)
    expect(view.netRevenueCents).toBe(143040)
    expect(view.pendingGrossCents).toBe(330000)
    expect(view.unreconciledCount).toBe(2)
    expect(view.netRevenueCents).not.toBe(480000 - 6960)

    const direct = view.partners.find((row) => row.code == null)
    const partner = view.partners.find((row) => row.code === 'ENFORMA')
    expect(direct?.revenueCents).toBe(230000)
    expect(direct?.netRevenueCents).toBe(143040)
    expect(direct?.pendingGrossCents).toBe(80000)
    expect(direct?.unreconciledCount).toBe(1)
    expect(partner?.revenueCents).toBe(250000)
    expect(partner?.netRevenueCents).toBe(0)
    expect(partner?.pendingGrossCents).toBe(250000)

    const closed = mixed.map((order) =>
      order.adjustment ? order : order.state === 'PAID' ? captured(order, 0, 0, 0) : order,
    )
    const done = buildDashboard(closed, EMPTY_FILTERS, now)
    expect(done.pendingGrossCents).toBe(0)
    expect(done.unreconciledCount).toBe(0)
    expect(done.netRevenueCents).toBe(143040 + 250000 + 80000)
    expect(done.revenueCents).toBe(480000)
  })

  it('leaves financial CSV cells empty until a row exists, including explicit zero', () => {
    const pending = HARNESS_SNAPSHOT.orders.find((order) => order.trackingRef === 'TRK-DOB')
    const zeros = HARNESS_SNAPSHOT.orders.find((order) => order.trackingRef === 'TRK-IND')
    if (!pending || !zeros) throw new Error('faltan fixtures')
    const csv = ordersToCsv([pending, captured(zeros, 0, 0, 0)])
    const [headerLine, pendingLine, zeroLine] = csv
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/)
    const header = (headerLine ?? '').split(',')
    const pendingCells = csvCells(pendingLine ?? '')
    const zeroCells = csvCells(zeroLine ?? '')
    const at = (name: string) => header.indexOf(name)
    expect(pendingCells[at('provider_fee_mxn')]).toBe('')
    expect(pendingCells[at('provider_fee_tax_mxn')]).toBe('')
    expect(pendingCells[at('other_costs_mxn')]).toBe('')
    expect(pendingCells[at('net_revenue_mxn')]).toBe('')
    expect(pendingCells[at('reconciliation_status')]).toBe('PENDING')
    expect(zeroCells[at('provider_fee_mxn')]).toBe('0.00')
    expect(zeroCells[at('provider_fee_tax_mxn')]).toBe('0.00')
    expect(zeroCells[at('other_costs_mxn')]).toBe('0.00')
    expect(zeroCells[at('net_revenue_mxn')]).toBe('1500.00')
    expect(zeroCells[at('reconciliation_status')]).toBe('RECONCILED')
  })
})

function csvCells(line: string): string[] {
  return [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => match[1] ?? '')
}
