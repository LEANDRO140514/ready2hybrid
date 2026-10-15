import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { marketingContactsToCsv } from '../../../src/sales-dashboard/marketing'
import { planLegacySync, SOURCE_SELECT } from '../../../src/legacy-sync/plan'
import { buildSourceLedger, splitAttention } from '../../../src/sales-dashboard/source-ledger'

const catalog = new Set(['DOB-SAB-HH', 'IND-H'])

function source(partial: Record<string, unknown>) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    category_code: 'DOB-SAB-HH',
    category_name: 'Dobles',
    category_bloque: 'COMPITE',
    contact_name: 'Ana',
    contact_email: 'ANA@example.com',
    contact_phone: '999',
    amount: 2500,
    currency: 'MXN',
    status: 'paid',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
    mp_payment_id: 'pay-legacy',
    ...partial,
  }
}

describe('source ledger', () => {
  const current = {
    id: 'order-1',
    state: 'PAID',
    totalCents: 250000,
    email: 'ana@example.com',
    productCode: 'DOB-SAB-HH',
    approvedPaymentIds: ['pay-shared'],
  }
  const legacy = {
    id: 'leg-1',
    commercialStatus: 'LEGACY_PAID',
    email: 'ana@example.com',
    productCode: 'DOB-SAB-HH',
    amountCents: 250000,
    paymentId: 'pay-shared',
    missingSince: null,
  }

  it('counts one sale when both sources share the payment id', () => {
    const ledger = buildSourceLedger({
      orders: [current],
      legacy: [legacy],
      manualOrderIds: new Set(),
    })
    expect(ledger.confirmedSales).toBe(1)
    expect(ledger.confirmedCents).toBe(250000)
    expect(ledger.excludedLegacyIds).toEqual(['leg-1'])
    expect(ledger.review.map((row) => row.kind)).not.toContain('same-person-product')
  })

  it('keeps both amounts and flags review when only the person and product match', () => {
    const ledger = buildSourceLedger({
      orders: [current],
      legacy: [{ ...legacy, paymentId: 'pay-other' }],
      manualOrderIds: new Set(),
    })
    expect(ledger.confirmedSales).toBe(2)
    expect(ledger.confirmedCents).toBe(500000)
    expect(ledger.review).toEqual([
      { kind: 'same-person-product', legacyId: 'leg-1', orderId: 'order-1' },
    ])
  })

  it('counts a manually resolved order once and does not treat it as a second payment', () => {
    const ledger = buildSourceLedger({
      orders: [{
        id: 'toros',
        state: 'REQUIRES_REVIEW',
        totalCents: 250000,
        email: 'toros@example.com',
        productCode: 'DOB-SAB-HH',
        approvedPaymentIds: ['pay-toros'],
      }],
      legacy: [{ ...legacy, id: 'leg-toros', email: 'toros@example.com', paymentId: 'pay-toros' }],
      manualOrderIds: new Set(['toros']),
    })
    expect(ledger.manualSales).toBe(1)
    expect(ledger.confirmedSales).toBe(1)
    expect(ledger.confirmedCents).toBe(250000)
    expect(ledger.excludedLegacyIds).toEqual(['leg-toros'])
  })

  it('keeps a disappeared paid row in the total and flags it', () => {
    const ledger = buildSourceLedger({
      orders: [],
      legacy: [{ ...legacy, paymentId: 'pay-only-legacy', missingSince: '2026-10-15T00:00:00Z' }],
      manualOrderIds: new Set(),
    })
    expect(ledger.confirmedCents).toBe(250000)
    expect(ledger.review[0]?.kind).toBe('missing-from-source')
  })

  it('keeps a local amount when the source conflicts, and does not drop the review', () => {
    const ledger = buildSourceLedger({
      orders: [],
      legacy: [{ ...legacy, paymentId: 'pay-only-legacy', amountCents: 300000 }],
      manualOrderIds: new Set(),
      overrides: [{ legacyId: 'leg-1', field: 'amount_cents', valueCents: 250000, conflict: true }],
    })
    expect(ledger.legacyCents).toBe(250000)
    expect(ledger.review.map((row) => row.kind)).toContain('local-conflict')
  })

  it('moves expired holds out of the active queue and hides a resolved review', () => {
    const split = splitAttention(
      [
        { type: 'Checkout vencido sigue en PAYMENT_PENDING', orderId: 'a' },
        { type: 'Pago APPROVED y la orden no está PAID', orderId: 'toros' },
        { type: 'Orden PAID sin boleto', orderId: 'b' },
      ],
      new Set(['toros']),
    )
    expect(split.expiredHolds).toHaveLength(1)
    expect(split.resolvedManually.map((row) => row.orderId)).toEqual(['toros'])
    expect(split.active.map((row) => row.type)).toEqual(['Orden PAID sin boleto'])
  })
})

describe('legacy sync plan', () => {
  it('inserts a new row, updates a changed row, and flags a missing row', () => {
    const plan = planLegacySync({
      source: [source({}), source({ id: '22222222-2222-4222-8222-222222222222', status: 'cancelled', amount: 900 })],
      mirror: [
        {
          originalRecordId: '22222222-2222-4222-8222-222222222222',
          sourceHash: 'old',
          missingSince: null,
          commercialStatus: 'LEGACY_PENDING',
          importDisposition: 'IMPORTED',
          reviewReason: null,
        },
        {
          originalRecordId: '33333333-3333-4333-8333-333333333333',
          sourceHash: 'kept',
          missingSince: null,
          commercialStatus: 'LEGACY_PAID',
          importDisposition: 'IMPORTED',
          reviewReason: null,
        },
      ],
      overrides: [],
      catalogCodes: catalog,
    })
    expect(plan.inserted).toBe(1)
    expect(plan.updated).toBe(1)
    expect(plan.disappeared).toBe(1)
    const cancelled = plan.actions.find((action) => action.kind === 'update')
    expect(cancelled && cancelled.kind === 'update' && cancelled.row.commercialStatus).toBe('LEGACY_CANCELLED')
  })

  it('does not replace a local override; it records the conflict', () => {
    const first = planLegacySync({
      source: [source({ amount: 2500 })],
      mirror: [{
        originalRecordId: '11111111-1111-4111-8111-111111111111',
        sourceHash: null,
        missingSince: null,
        commercialStatus: 'LEGACY_PAID',
        importDisposition: 'IMPORTED',
        reviewReason: null,
      }],
      overrides: [{
        originalRecordId: '11111111-1111-4111-8111-111111111111',
        field: 'amount_cents',
        sourceValueAtOverride: '250000',
      }],
      catalogCodes: catalog,
    })
    expect(first.conflicts).toBe(0)

    const changed = planLegacySync({
      source: [source({ amount: 2600 })],
      mirror: [{
        originalRecordId: '11111111-1111-4111-8111-111111111111',
        sourceHash: 'different',
        missingSince: null,
        commercialStatus: 'LEGACY_PAID',
        importDisposition: 'IMPORTED',
        reviewReason: null,
      }],
      overrides: [{
        originalRecordId: '11111111-1111-4111-8111-111111111111',
        field: 'amount_cents',
        sourceValueAtOverride: '250000',
      }],
      catalogCodes: catalog,
    })
    expect(changed.conflicts).toBe(1)
    expect(changed.actions.some((action) => action.kind === 'conflict' && action.sourceValue === '260000')).toBe(true)
    expect(changed.updated).toBe(1)
  })

  it('reads only the enforma registrations table', () => {
    expect(SOURCE_SELECT).toContain('public.hybrid_registro_inscripciones')
    expect(SOURCE_SELECT.startsWith('SELECT ')).toBe(true)
    expect(SOURCE_SELECT.toLowerCase()).not.toContain('insert')
  })
})

describe('marketing export', () => {
  it('keeps legacy consent as not-recorded', () => {
    const csv = marketingContactsToCsv([{
      key: 'email:ana@example.com',
      name: 'Ana',
      email: 'ana@example.com',
      phone: null,
      status: 'PAID',
      origin: 'legacy',
      categories: ['Dobles'],
      paidCents: 250000,
      firstAt: null,
      lastAt: null,
      consent: 'not-recorded',
    }])
    expect(csv).toContain('not_recorded')
    expect(csv).not.toMatch(/(^|,)recorded(,|\n|$)/)
  })
})

describe('migration 0043', () => {
  const sql = readFileSync(
    resolve('insforge/migrations/0043_legacy-source-sync.sql'),
    'utf8',
  )

  it('does not write orders, payments, or tickets, and does not issue a ticket', () => {
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.(orders|payments|tickets|participants)\b/i)
    expect(sql).not.toMatch(/ticket_issue/i)
    expect(sql).toContain('LEGACY_CANCELLED')
    expect(sql).toContain('append-only')
    expect(sql).toContain("resolution = 'MANUAL_SALE'")
  })
})
