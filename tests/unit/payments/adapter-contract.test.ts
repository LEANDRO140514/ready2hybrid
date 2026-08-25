/**
 * Provider id / enablement contract used by checkout validate (ids.ts + errors.ts).
 * Multi-provider adapter suite lives on wip/multi-gateway.
 */
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_PAYMENT_PROVIDER_IDS,
  parseActivePaymentProviderId,
  resolveSelectableProvider,
} from '../../../insforge/functions/_shared/payments/ids'
import { PaymentContractError } from '../../../insforge/functions/_shared/payments/errors'

describe('payment provider identifiers (main go-live)', () => {
  it('supports only the approved initial set', () => {
    expect([...ACTIVE_PAYMENT_PROVIDER_IDS]).toEqual(['MERCADO_PAGO', 'CLIP', 'OPENPAY'])
    expect(parseActivePaymentProviderId('MERCADO_PAGO')).toBe('MERCADO_PAGO')
    expect(parseActivePaymentProviderId('CLIP')).toBe('CLIP')
    expect(parseActivePaymentProviderId('OPENPAY')).toBe('OPENPAY')
  })

  it('rejects PayPal and unknown identifiers fail-closed', () => {
    for (const raw of ['PAYPAL', 'paypal', 'STRIPE', 'mercadopago', '', 'CLIP ']) {
      expect(() => parseActivePaymentProviderId(raw)).toThrow(PaymentContractError)
      try {
        parseActivePaymentProviderId(raw)
      } catch (error) {
        expect(error).toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
      }
    }
  })

  it('rejects disabled members of the active set', () => {
    expect(() =>
      resolveSelectableProvider('CLIP', { MERCADO_PAGO: true, CLIP: false, OPENPAY: false }),
    ).toThrow(PaymentContractError)
    expect(resolveSelectableProvider('MERCADO_PAGO', { MERCADO_PAGO: true })).toBe('MERCADO_PAGO')
  })
})
