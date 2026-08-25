import { describe, expect, it } from 'vitest'
import { CheckoutError } from '../../../insforge/functions/_shared/checkout/errors'
import { assertQuantityForProduct } from '../../../insforge/functions/_shared/checkout/quantity'
import {
  isSoldOut,
  resolveCommercialOffer,
  resolveEffectiveStage,
} from '../../../insforge/functions/_shared/checkout/staged-pricing'
import { launchNow, productRow } from './helpers'

describe('v0.4 quantity independence — cupo / HWM / holds are not commercial authority', () => {
  it('must not derive SOLD_OUT from cupo vs consumed units', () => {
    expect(isSoldOut(40, 40)).toBe(false)
    expect(isSoldOut(40, 100)).toBe(false)
  })

  it('must not emit SOLD_OUT from resolveCommercialOffer when cupo is exhausted', () => {
    const offer = resolveCommercialOffer({
      productCode: 'IND-H',
      totalCupo: 10,
      consumedUnits: 10,
      now: launchNow(),
    })
    expect('error' in offer && offer.error === 'SOLD_OUT').toBe(false)
  })

  it('must not treat spectator quantity above cupo as organizer SOLD_OUT', () => {
    const spectator = productRow({
      code: 'PUB-VIE',
      kind: 'spectator',
      cupo: 5,
      day: '2026-11-13',
    })
    try {
      assertQuantityForProduct(spectator, 6)
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutError)
      expect((error as CheckoutError).code).not.toBe('SOLD_OUT')
      return
    }
    expect(true).toBe(true)
  })

  it('keeps LAUNCH price when holds + sold units are large', () => {
    const offer = resolveCommercialOffer({
      productCode: 'DOB-VIE-MM',
      totalCupo: 20,
      consumedUnits: 19,
      persistedStage: 'PRESALE',
      now: launchNow(),
    })
    expect('error' in offer).toBe(false)
    if ('error' in offer) return
    expect(offer.commercial_stage).toBe('LAUNCH')
    expect(offer.unit_price_cents).toBe(250000)
  })

  it('does not let quota shares change effective stage', () => {
    expect(resolveEffectiveStage(launchNow(), 100, 99, 'LAUNCH')).toBe('LAUNCH')
  })
})
