import { describe, expect, it } from 'vitest'
import {
  buildSandboxConfirmationPreferenceBody,
  classifyControlObservation,
  expectedPaymentMethodsShape,
  SANDBOX_CONFIRMATION_AMOUNT_MXN,
  sanitizePreferenceResponse,
} from '../../spikes/msi-checkout-pro-sandbox-confirmation'

describe('MSI sandbox confirmation preference builders (structural)', () => {
  const expires = '2026-08-06T02:00:00.000Z'

  it('uses identical amount/currency across CONTROL / ELIGIBLE / EXCLUDED', () => {
    for (const caseId of ['CONTROL', 'ELIGIBLE', 'EXCLUDED'] as const) {
      const body = buildSandboxConfirmationPreferenceBody(caseId, {
        externalReference: `r2h-msi-sbx-${caseId.toLowerCase()}-test`,
        expiresAtIso: expires,
      })
      const item = (body.items as Array<Record<string, unknown>>)[0]
      expect(item.unit_price).toBe(SANDBOX_CONFIRMATION_AMOUNT_MXN)
      expect(item.currency_id).toBe('MXN')
      expect(item.quantity).toBe(1)
      expect(body.expires).toBe(true)
      expect(body.expiration_date_to).toBe(expires)
      expect(String(body.external_reference)).toMatch(/^r2h-msi-sbx-/)
    }
  })

  it('CONTROL omits payment_methods; ELIGIBLE caps at 3 + ticket; EXCLUDED caps at 1 + ticket', () => {
    expect(expectedPaymentMethodsShape('CONTROL')).toEqual({
      payment_methods_omitted: true,
      installments: null,
      ticket_excluded: false,
    })
    expect(buildSandboxConfirmationPreferenceBody('CONTROL', {
      externalReference: 'r2h-msi-sbx-control-test',
      expiresAtIso: expires,
    }).payment_methods).toBeUndefined()

    const eligible = buildSandboxConfirmationPreferenceBody('ELIGIBLE', {
      externalReference: 'r2h-msi-sbx-eligible-test',
      expiresAtIso: expires,
    })
    expect(eligible.payment_methods).toEqual({
      installments: 3,
      excluded_payment_types: [{ id: 'ticket' }],
    })
    expect(expectedPaymentMethodsShape('ELIGIBLE')).toMatchObject({
      installments: 3,
      ticket_excluded: true,
    })

    const excluded = buildSandboxConfirmationPreferenceBody('EXCLUDED', {
      externalReference: 'r2h-msi-sbx-excluded-test',
      expiresAtIso: expires,
    })
    expect(excluded.payment_methods).toEqual({
      installments: 1,
      excluded_payment_types: [{ id: 'ticket' }],
    })
  })

  it('sanitizePreferenceResponse never echoes secrets and keeps installments shape', () => {
    const sanitized = sanitizePreferenceResponse({
      id: '3560835739-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      init_point: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=x',
      sandbox_init_point: 'https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=x',
      external_reference: 'r2h-msi-sbx-eligible-test',
      payment_methods: {
        installments: 3,
        excluded_payment_types: [{ id: 'ticket' }],
      },
      items: [{ id: 'x', title: 't', quantity: 1, currency_id: 'MXN', unit_price: 2500 }],
    })
    expect(sanitized.id_suffix).toBe('eeeeeeeeeeee')
    expect(JSON.stringify(sanitized)).not.toMatch(/APP_USR-|TEST-|Bearer/)
    expect(sanitized.payment_methods).toMatchObject({ installments: 3 })
  })

  it('classifyControlObservation distinguishes baseline MSI vs without MSI', () => {
    expect(
      classifyControlObservation({
        msiOrInstallmentsVisible: true,
        maxInstallments: 24,
        sinInteresesText: true,
        ticketVisible: true,
      }).resultado,
    ).toBe('CONTROL_BASELINE_CONFIRMED')
    expect(
      classifyControlObservation({
        msiOrInstallmentsVisible: false,
        maxInstallments: 1,
        sinInteresesText: false,
        ticketVisible: true,
      }).resultado,
    ).toBe('CONTROL_WITHOUT_MSI')
  })
})
