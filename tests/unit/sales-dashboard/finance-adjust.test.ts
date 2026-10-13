import { describe, expect, it } from 'vitest'

import {
  actorLabel,
  labelsForActors,
  usersFromAuthList,
} from '../../../insforge/functions/_shared/sales-read/actors'
import {
  adminFinanceStore,
  nextFinanceAdjustment,
  parseFinanceAdjustmentInput,
  saveFinanceAdjustment,
  type FinanceAdjustmentStore,
} from '../../../insforge/functions/_shared/sales-read/adjust'
import { roleMayReadSales } from '../../../insforge/functions/_shared/sales-read/gate'

const ORDER = '11111111-1111-1111-1111-111111111111'
const PAYMENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'

function memoryStore(): FinanceAdjustmentStore & {
  rows: Map<string, Record<string, unknown>>
  writes: string[]
} {
  const rows = new Map<string, Record<string, unknown>>()
  const writes: string[] = []
  return {
    rows,
    writes,
    async findPayment(paymentId) {
      if (paymentId !== PAYMENT) return null
      return { id: PAYMENT, orderId: ORDER, provider: 'MERCADOPAGO' }
    },
    async findOrderState(orderId) {
      return orderId === ORDER ? 'PAID' : null
    },
    async findAdjustment(orderId) {
      const row = rows.get(orderId)
      if (!row) return null
      return {
        id: String(row.id),
        createdBy: String(row.createdBy),
        createdAt: String(row.createdAt),
      }
    },
    async insertAdjustment(row) {
      writes.push('insert payment_finance_adjustments')
      rows.set(row.orderId, { ...row })
    },
    async updateAdjustment(id, patch) {
      writes.push('update payment_finance_adjustments')
      const current = [...rows.values()].find((row) => row.id === id)
      if (!current) throw new Error('missing')
      rows.set(String(current.orderId), { ...current, ...patch, id })
    },
  }
}

describe('finance adjustment write', () => {
  it('rejects amounts that are not integer cents', () => {
    expect(
      parseFinanceAdjustmentInput({
        orderId: ORDER,
        paymentId: PAYMENT,
        providerFeeCents: 60.5,
        providerFeeTaxCents: 0,
        otherCostsCents: 0,
        notes: null,
      }).ok,
    ).toBe(false)
    expect(
      parseFinanceAdjustmentInput({
        orderId: ORDER,
        paymentId: PAYMENT,
        providerFeeCents: -1,
        providerFeeTaxCents: 0,
        otherCostsCents: 0,
        notes: null,
      }).ok,
    ).toBe(false)
  })

  it('keeps the creator and changes the editor on a second save', async () => {
    const store = memoryStore()
    const input = {
      orderId: ORDER,
      paymentId: PAYMENT,
      providerFeeCents: 6000,
      providerFeeTaxCents: 960,
      otherCostsCents: 0,
      notes: 'fixture, no es tarifa de Mercado Pago',
    }
    const first = await saveFinanceAdjustment(store, 'user-owner', input, '2026-09-23T18:00:00.000Z')
    expect(first.ok).toBe(true)
    const created = store.rows.get(ORDER)
    expect(created?.createdBy).toBe('user-owner')
    expect(created?.source).toBe('MANUAL')
    expect(created?.provider).toBe('MERCADOPAGO')

    const second = await saveFinanceAdjustment(
      store,
      'user-finance',
      { ...input, providerFeeCents: 7000 },
      '2026-09-23T19:00:00.000Z',
    )
    expect(second.ok).toBe(true)
    const edited = store.rows.get(ORDER)
    expect(edited?.createdBy).toBe('user-owner')
    expect(edited?.createdAt).toBe('2026-09-23T18:00:00.000Z')
    expect(edited?.updatedBy).toBe('user-finance')
    expect(edited?.updatedAt).toBe('2026-09-23T19:00:00.000Z')
    expect(edited?.providerFeeCents).toBe(7000)
    expect(store.writes).toEqual([
      'insert payment_finance_adjustments',
      'update payment_finance_adjustments',
    ])
  })

  it('treats explicit zeros as a captured row', () => {
    const row = nextFinanceAdjustment({
      existing: null,
      userId: 'user-finance',
      nowIso: '2026-09-23T18:00:00.000Z',
      payment: { id: PAYMENT, orderId: ORDER, provider: 'MERCADOPAGO' },
      amounts: {
        orderId: ORDER,
        paymentId: PAYMENT,
        providerFeeCents: 0,
        providerFeeTaxCents: 0,
        otherCostsCents: 0,
        notes: null,
      },
    })
    expect(row.providerFeeCents + row.providerFeeTaxCents + row.otherCostsCents).toBe(0)
    expect(row.createdBy).toBe('user-finance')
  })

  it('does not write orders or payments through the admin adapter', async () => {
    const calls: string[] = []
    let stored: Record<string, unknown> | null = null
    const admin = {
      database: {
        from(table: string) {
          return {
            select() {
              return {
                eq() {
                  return {
                    async limit() {
                      calls.push(`select ${table}`)
                      if (table === 'payments') {
                        return {
                          data: [{ id: PAYMENT, order_id: ORDER, provider: 'MERCADOPAGO' }],
                          error: null,
                        }
                      }
                      if (table === 'orders') return { data: [{ state: 'PAID' }], error: null }
                      if (table === 'payment_finance_adjustments') {
                        return { data: stored ? [stored] : [], error: null }
                      }
                      return { data: [], error: null }
                    },
                  }
                },
              }
            },
            async insert(rows: Record<string, unknown>[]) {
              calls.push(`insert ${table}`)
              stored = rows[0] ?? null
              return { data: rows, error: null }
            },
            update(patch: Record<string, unknown>) {
              return {
                async eq() {
                  calls.push(`update ${table}`)
                  stored = { ...stored, ...patch }
                  return { data: [stored], error: null }
                },
              }
            },
          }
        },
      },
    }
    const saved = await saveFinanceAdjustment(
      adminFinanceStore(admin),
      'user-owner',
      {
        orderId: ORDER,
        paymentId: PAYMENT,
        providerFeeCents: 0,
        providerFeeTaxCents: 0,
        otherCostsCents: 0,
        notes: null,
      },
      '2026-09-23T18:00:00.000Z',
    )
    expect(saved.ok).toBe(true)
    expect(calls).toContain('insert payment_finance_adjustments')
    expect(calls.some((call) => call.startsWith('insert orders'))).toBe(false)
    expect(calls.some((call) => call.startsWith('update orders'))).toBe(false)
    expect(calls.some((call) => call.startsWith('insert payments'))).toBe(false)
    expect(calls.some((call) => call.startsWith('update payments'))).toBe(false)
  })

  it('resolves an auth email without keeping the raw id as the label', () => {
    const users = usersFromAuthList({
      users: [
        { id: 'user-finance', email: 'finanzas@example.com', name: 'Finanzas' },
        { id: 'other', email: 'otro@example.com' },
      ],
    })
    expect(actorLabel(users[0] ?? {})).toBe('Finanzas · finanzas@example.com')
    expect(labelsForActors(users, new Set(['user-finance']))).toEqual([
      { id: 'user-finance', label: 'Finanzas · finanzas@example.com' },
    ])
  })

  it('denies every role except OWNER and FINANCE', () => {
    expect(roleMayReadSales('OWNER')).toBe(true)
    expect(roleMayReadSales('FINANCE')).toBe(true)
    expect(roleMayReadSales('OPERATIONS_MANAGER')).toBe(false)
    expect(roleMayReadSales('CHECKIN_STAFF')).toBe(false)
    expect(roleMayReadSales('SOLUTION_DESK')).toBe(false)
    expect(roleMayReadSales(null)).toBe(false)
  })
})
