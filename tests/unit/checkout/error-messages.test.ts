import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CheckoutError,
  INVALID_PHONE_MESSAGE,
  logHiddenCheckoutDetail,
} from '../../../insforge/functions/_shared/checkout/errors'
import {
  COMPETITOR_SALES_CLOSED_MESSAGE,
  PUBLIC_PASS_SALES_CLOSED_MESSAGE,
  salesClosedMessage,
} from '../../../insforge/functions/_shared/checkout/staged-pricing'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkout error messages sent to the client', () => {
  it('hides the detail of CONFIGURATION_ERROR and sends the generic message', () => {
    const error = new CheckoutError('CONFIGURATION_ERROR', 'MERCADOPAGO_ACCESS_TOKEN missing')
    expect(error.toPublicBody().error.message).toBe('Checkout is not configured.')
    expect(error.message).toBe('MERCADOPAGO_ACCESS_TOKEN missing')
  })

  it('hides the detail of an INVALID_REQUEST that is not about the phone', () => {
    const error = new CheckoutError('INVALID_REQUEST', 'Client must not supply total_cents')
    expect(error.toPublicBody().error.message).toBe('Invalid checkout request.')
    expect(error.message).toBe('Client must not supply total_cents')
  })

  it('keeps the phone detail for INVALID_REQUEST', () => {
    const error = new CheckoutError('INVALID_REQUEST', INVALID_PHONE_MESSAGE)
    expect(error.toPublicBody().error.message).toBe(INVALID_PHONE_MESSAGE)
  })

  it('keeps the detail for SALES_CLOSED and falls back to the generic text without one', () => {
    expect(new CheckoutError('SALES_CLOSED', 'Cerrado.').toPublicBody().error.message).toBe('Cerrado.')
    expect(new CheckoutError('SALES_CLOSED').toPublicBody().error.message).toBe('Sales are closed.')
  })

  it('sends hidden details to the log and nothing for errors without hidden detail', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    logHiddenCheckoutDetail(new CheckoutError('CONFIGURATION_ERROR', 'TEAM_INVITATION_TTL_SECONDS invalid'))
    expect(log).toHaveBeenCalledWith('checkout CONFIGURATION_ERROR: TEAM_INVITATION_TTL_SECONDS invalid')
    log.mockClear()
    logHiddenCheckoutDetail(new CheckoutError('SALES_CLOSED', COMPETITOR_SALES_CLOSED_MESSAGE))
    logHiddenCheckoutDetail(new CheckoutError('INVALID_REQUEST', INVALID_PHONE_MESSAGE))
    logHiddenCheckoutDetail(new CheckoutError('PRODUCT_NOT_FOUND'))
    expect(log).not.toHaveBeenCalled()
  })
})

describe('closed-sales message by product', () => {
  it('uses the access message for spectator passes and keeps the competitor text', () => {
    expect(PUBLIC_PASS_SALES_CLOSED_MESSAGE).toBe('La venta en línea de este acceso ya cerró.')
    expect(salesClosedMessage('PUB-VIE')).toBe(PUBLIC_PASS_SALES_CLOSED_MESSAGE)
    expect(salesClosedMessage('PUB-SAB')).toBe(PUBLIC_PASS_SALES_CLOSED_MESSAGE)
    expect(salesClosedMessage('HALF-IND-M')).toBe(COMPETITOR_SALES_CLOSED_MESSAGE)
    expect(COMPETITOR_SALES_CLOSED_MESSAGE).toBe(
      'La venta en línea de competidores cerró el 13 de noviembre a las 11:00. Escríbenos al WhatsApp 990 230 2378.',
    )
  })
})
