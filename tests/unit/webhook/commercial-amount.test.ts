import { describe, expect, it } from 'vitest'
import {
  matchPaymentToCommercialSnapshot,
  orderCanonicalCurrency,
  orderCanonicalTotalCents,
} from '../../../insforge/functions/_shared/webhook/commercial-amount'

const ORDER_ID = '22222222-2222-2222-2222-222222222222'

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    external_reference: ORDER_ID,
    total_cents: 150000,
    currency: 'MXN',
    commercial_snapshot: {
      total_price_cents: 150000,
      currency: 'MXN',
      commercial_stage: 'LAUNCH',
      unit_price_cents: 150000,
    },
    ...overrides,
  }
}

describe('FIX-06 webhook vs commercial snapshot amount authority', () => {
  it('exact payment matches snapshot', () => {
    const r = matchPaymentToCommercialSnapshot({
      amountCents: 150000,
      currency: 'MXN',
      externalReference: ORDER_ID,
      order: order(),
    })
    expect(r.mismatchReason).toBeNull()
    expect(r.amountOk).toBe(true)
    expect(r.currencyOk).toBe(true)
  })

  it('lower amount does not confirm', () => {
    const r = matchPaymentToCommercialSnapshot({
      amountCents: 149999,
      currency: 'MXN',
      externalReference: ORDER_ID,
      order: order(),
    })
    expect(r.mismatchReason).toBe('AMOUNT_MISMATCH')
    expect(r.amountOk).toBe(false)
  })

  it('higher amount does not auto-confirm', () => {
    const r = matchPaymentToCommercialSnapshot({
      amountCents: 150001,
      currency: 'MXN',
      externalReference: ORDER_ID,
      order: order(),
    })
    expect(r.mismatchReason).toBe('AMOUNT_MISMATCH')
  })

  it('different currency does not confirm', () => {
    const r = matchPaymentToCommercialSnapshot({
      amountCents: 150000,
      currency: 'USD',
      externalReference: ORDER_ID,
      order: order(),
    })
    expect(r.mismatchReason).toBe('CURRENCY_MISMATCH')
  })

  it('different external_reference does not confirm', () => {
    const r = matchPaymentToCommercialSnapshot({
      amountCents: 150000,
      currency: 'MXN',
      externalReference: 'other-order',
      order: order(),
    })
    expect(r.mismatchReason).toBe('REFERENCE_MISMATCH')
  })

  it('compares against original snapshot after stage would have changed', () => {
    const snapOrder = order({
      commercial_snapshot: {
        total_price_cents: 150000,
        currency: 'MXN',
        commercial_stage: 'LAUNCH',
      },
      total_cents: 150000,
    })
    // Denormalized total accidentally drifted — snapshot still wins.
    const drifted = order({
      ...snapOrder,
      total_cents: 180000,
    })
    expect(orderCanonicalTotalCents(drifted)).toBe(150000)
    const r = matchPaymentToCommercialSnapshot({
      amountCents: 150000,
      currency: 'MXN',
      externalReference: ORDER_ID,
      order: drifted,
    })
    expect(r.amountOk).toBe(true)
    expect(orderCanonicalCurrency(drifted)).toBe('MXN')
  })

  it('falls back to order.total_cents when snapshot lacks total', () => {
    const o = order({ commercial_snapshot: { currency: 'MXN' }, total_cents: 165000 })
    expect(orderCanonicalTotalCents(o)).toBe(165000)
  })
})
