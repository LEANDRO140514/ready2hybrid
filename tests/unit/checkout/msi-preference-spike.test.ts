import { describe, expect, it } from 'vitest'
import { parseCheckoutRequest } from '../../../insforge/functions/_shared/checkout/validate'
import { PRODUCT_STAGE_PRICES } from '../../../insforge/functions/_shared/checkout/staged-pricing'
import {
  ASYNC_EXCLUDED_PAYMENT_TYPES,
  buildMsiPreferencePaymentMethods,
  buildSpikePreferenceBody,
  MSI_MAX_INSTALLMENTS,
  PUBLIC_MSI_COPY,
} from '../../spikes/msi-checkout-pro-preference'

const ELIGIBLE = [
  'DOB-VIE-MM',
  'IND-H',
  'REL-4H',
  'HALF-IND-M',
  'HALF-DOB-MM',
] as const

const EXCLUDED = ['WOD-M', 'PUB-VIE', 'FOT-SAB'] as const

describe('MSI Checkout Pro preference spike (structural, no network)', () => {
  it('eligible competitive families → installments=3 + ticket excluded', () => {
    for (const code of ELIGIBLE) {
      const r = buildMsiPreferencePaymentMethods(code)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.commercial_msi_eligible).toBe(true)
      expect(PRODUCT_STAGE_PRICES[code].msi_eligible).toBe(true)
      expect(r.payment_methods.installments).toBe(MSI_MAX_INSTALLMENTS)
      expect(r.payment_methods.excluded_payment_types).toEqual([...ASYNC_EXCLUDED_PAYMENT_TYPES])
      expect(r.public_message_key).toBe('MSI_ELIGIBLE_DISCLAIMER')
      expect(PUBLIC_MSI_COPY[r.public_message_key]).toContain('3 meses sin intereses')
    }
  })

  it('Workout / público / fotógrafo → installments=1 and silent copy', () => {
    for (const code of EXCLUDED) {
      const r = buildMsiPreferencePaymentMethods(code)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.commercial_msi_eligible).toBe(false)
      expect(r.payment_methods.installments).toBe(1)
      expect(r.payment_methods.excluded_payment_types).toEqual([{ id: 'ticket' }])
      expect(r.public_message_key).toBe('MSI_EXCLUDED_SILENT')
      expect(PUBLIC_MSI_COPY.MSI_EXCLUDED_SILENT).toBeNull()
    }
  })

  it('PUB-3D / FOT-3D are sellable MSI-excluded; unknown / incomplete still fail-closed', () => {
    for (const code of ['PUB-3D', 'FOT-3D'] as const) {
      const r = buildMsiPreferencePaymentMethods(code)
      expect(r).toMatchObject({
        ok: true,
        commercial_msi_eligible: false,
        payment_methods: {
          installments: 1,
          excluded_payment_types: [{ id: 'ticket' }],
        },
      })
    }
    expect(buildMsiPreferencePaymentMethods('NOPE')).toMatchObject({
      ok: false,
      error: 'PRODUCT_DISABLED',
    })
    expect(buildMsiPreferencePaymentMethods('IND-H', null)).toMatchObject({
      ok: false,
      error: 'PRODUCT_DISABLED',
    })
  })

  it('eligible vs excluded preference payloads differ only in installments policy', () => {
    const eligible = buildMsiPreferencePaymentMethods('IND-H')
    const excluded = buildMsiPreferencePaymentMethods('WOD-H')
    expect(eligible.ok && excluded.ok).toBe(true)
    if (!eligible.ok || !excluded.ok) return

    const bodyEligible = buildSpikePreferenceBody({
      orderId: 'order-elig',
      productCode: 'IND-H',
      productName: 'Individual',
      unitPriceMxn: 1500,
      quantity: 1,
      paymentMethods: eligible.payment_methods,
    })
    const bodyExcluded = buildSpikePreferenceBody({
      orderId: 'order-excl',
      productCode: 'WOD-H',
      productName: 'Workout',
      unitPriceMxn: 350,
      quantity: 1,
      paymentMethods: excluded.payment_methods,
    })

    expect(bodyEligible.payment_methods).toMatchObject({ installments: 3 })
    expect(bodyExcluded.payment_methods).toMatchObject({ installments: 1 })
    expect((bodyEligible.payment_methods as { excluded_payment_types: unknown }).excluded_payment_types).toEqual(
      (bodyExcluded.payment_methods as { excluded_payment_types: unknown }).excluded_payment_types,
    )
  })

  it('client cannot supply installments / msi / payment_methods / money fields', () => {
    expect(() =>
      parseCheckoutRequest({
        product_code: 'IND-H',
        idempotency_key: 'idem-key-12345678',
        installments: 12,
      } as never),
    ).toThrow()
    // strict schema rejects unknown keys
    expect(() =>
      parseCheckoutRequest({
        product_code: 'IND-H',
        idempotency_key: 'idem-key-12345678',
        payment_methods: { installments: 3 },
      } as never),
    ).toThrow()
    expect(() =>
      parseCheckoutRequest({
        product_code: 'IND-H',
        idempotency_key: 'idem-key-12345678',
        msi_eligible: true,
      }),
    ).toThrow()
    expect(() =>
      parseCheckoutRequest({
        product_code: 'IND-H',
        idempotency_key: 'idem-key-12345678',
        unit_price: 1,
      }),
    ).toThrow()
  })

  it('productive mp-client serializes payment_methods from paymentPolicy', async () => {
    const { createHttpMercadoPagoClient } = await import(
      '../../../insforge/functions/_shared/checkout/mp-client'
    )
    const { toCheckoutPaymentPolicy } = await import(
      '../../../insforge/functions/_shared/checkout/payment-policy'
    )
    let captured: string | null = null
    const client = createHttpMercadoPagoClient(async (_url, init) => {
      captured = String(init?.body ?? '')
      return new Response(JSON.stringify({ id: 'pref_x', init_point: 'https://example.test/p' }), {
        status: 201,
      })
    })
    await client.createCheckoutProPreference({
      accessToken: 'TEST_TOKEN_NOT_REAL',
      siteId: 'MLM',
      orderId: '22222222-2222-2222-2222-222222222222',
      productCode: 'IND-H',
      productName: 'Individual',
      price: {
        currency: 'MXN',
        unit_price_cents: 150000,
        quantity: 1,
        item_total_cents: 150000,
        subtotal_cents: 150000,
        total_cents: 150000,
        journey: 'J1',
        economic_unit: 'TEAM',
        capacity_unit: 'TEAM',
        has_chip: true,
        has_insurance: true,
        chip_extra_cents: 0,
        insurance_extra_cents: 0,
        msi_eligible: true,
      },
      paymentPolicy: toCheckoutPaymentPolicy(true),
      backUrls: {
        success: 'https://example.com/s',
        failure: 'https://example.com/f',
        pending: 'https://example.com/p',
      },
      notificationUrl: 'https://example.com/n',
    })
    expect(captured).toBeTruthy()
    const body = JSON.parse(captured!) as Record<string, unknown>
    expect(body.payment_methods).toEqual({
      installments: 3,
      excluded_payment_types: [{ id: 'ticket' }],
    })
    expect(body.external_reference).toBe('22222222-2222-2222-2222-222222222222')
  })
})
