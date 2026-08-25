import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { assertProductSellable } from '../../../insforge/functions/_shared/checkout/sales'
import { currentlyPayableCheckoutEligible, effectiveUnavailable, openEvent, productRow } from './helpers'

describe('v0.4 availability — explicit organizer SOLD_OUT scopes', () => {
  it('blocks a SKU when that SKU is explicitly SOLD_OUT', () => {
    expect(() =>
      assertProductSellable(productRow({ code: 'IND-H', sale_state: 'SOLD_OUT' })),
    ).toThrow(CheckoutError)
  })

  it('does not treat cupo remaining as SOLD_OUT', () => {
    expect(() =>
      assertProductSellable(productRow({ code: 'IND-H', cupo: 0, sale_state: null })),
    ).not.toThrow()
  })

  it('blocks checkout when the event is explicitly SOLD_OUT even if the SKU is AVAILABLE', () => {
    expect(() =>
      assertProductSellable(productRow({ code: 'IND-H', sale_state: null }), {
        event: { ...openEvent, sale_state: 'SOLD_OUT' },
      }),
    ).toThrow(CheckoutError)
  })

  it('blocks checkout when the category/offer is explicitly SOLD_OUT', () => {
    expect(() =>
      assertProductSellable(productRow({ code: 'IND-H', sale_state: null, block: 'COMPITE' }), {
        event: openEvent,
        categoryOfferSaleState: 'SOLD_OUT',
      }),
    ).toThrow(CheckoutError)
  })

  it('resolves effective unavailability as SKU OR category-offer OR event', () => {
    expect(
      effectiveUnavailable({ skuSoldOut: false, categoryOfferSoldOut: false, eventSoldOut: false }),
    ).toBe(false)
    expect(
      effectiveUnavailable({ skuSoldOut: true, categoryOfferSoldOut: false, eventSoldOut: false }),
    ).toBe(true)
    expect(
      effectiveUnavailable({ skuSoldOut: false, categoryOfferSoldOut: true, eventSoldOut: false }),
    ).toBe(true)
    expect(
      effectiveUnavailable({ skuSoldOut: false, categoryOfferSoldOut: false, eventSoldOut: true }),
    ).toBe(true)
  })

  it('does not let a child AVAILABLE override parent SOLD_OUT', () => {
    expect(
      effectiveUnavailable({
        skuSoldOut: false,
        categoryOfferSoldOut: false,
        eventSoldOut: true,
      }),
    ).toBe(true)
  })

  it('does not create CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE from sellable identity alone', () => {
    expect(
      currentlyPayableCheckoutEligible({
        salesStatus: 'CLOSED',
        sellableIdentity: true,
        historical: false,
        effectiveSoldOut: false,
      }),
    ).toBe(false)
    expect(
      currentlyPayableCheckoutEligible({
        salesStatus: 'PROXIMAMENTE',
        sellableIdentity: true,
        historical: false,
        effectiveSoldOut: false,
      }),
    ).toBe(false)
  })
})
