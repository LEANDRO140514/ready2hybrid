import { describe, expect, it } from 'vitest'
import {
  createHttpMercadoPagoClient,
  preferenceTerm,
} from '../../../insforge/functions/_shared/checkout/mp-client'
import {
  CARD_ONLY_EXCLUDED_PAYMENT_TYPES,
  publicEventCardsOnly,
  toCheckoutPaymentPolicy,
} from '../../../insforge/functions/_shared/checkout/payment-policy'
import type { PriceSnapshot } from '../../../insforge/functions/_shared/checkout/pricing'
import { dateFromMeridaWall } from '../../../insforge/functions/_shared/checkout/staged-pricing'

const basePrice: PriceSnapshot = {
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
}

async function capturePolicy(productCode: string, now: Date, msiEligible = false) {
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
    productCode,
    productName: productCode,
    price: { ...basePrice, msi_eligible: msiEligible, unit_price_cents: 25000 },
    paymentPolicy: toCheckoutPaymentPolicy(msiEligible, publicEventCardsOnly(productCode, now)),
    backUrls: {
      success: 'https://example.com/s',
      failure: 'https://example.com/f',
      pending: 'https://example.com/p',
    },
    notificationUrl: 'https://example.com/n',
  })
  expect(captured).toBeTruthy()
  return JSON.parse(captured!) as { payment_methods: { excluded_payment_types: Array<{ id: string }> } }
}

async function captureBody(msiEligible: boolean) {
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
    price: { ...basePrice, msi_eligible: msiEligible },
    paymentPolicy: toCheckoutPaymentPolicy(msiEligible),
    backUrls: {
      success: 'https://example.com/s',
      failure: 'https://example.com/f',
      pending: 'https://example.com/p',
    },
    notificationUrl: 'https://example.com/n',
    expiresAt: '2026-08-06T12:00:00.000Z',
    now: new Date('2026-08-06T11:45:00.000Z'),
  })
  expect(captured).toBeTruthy()
  return JSON.parse(captured!) as Record<string, unknown>
}

describe('mp-client payment_methods serialization', () => {
  it('eligible policy → installments 3 + ticket once, no default_installments', async () => {
    const body = await captureBody(true)
    expect(body.payment_methods).toEqual({
      installments: 3,
      excluded_payment_types: [{ id: 'ticket' }],
    })
    expect(body).not.toHaveProperty('default_installments')
    expect(JSON.stringify(body)).not.toContain('default_installments')
    expect(body.external_reference).toBe('22222222-2222-2222-2222-222222222222')
    expect(body.notification_url).toBe('https://example.com/n')
    expect(body.back_urls).toEqual({
      success: 'https://example.com/s',
      failure: 'https://example.com/f',
      pending: 'https://example.com/p',
    })
    expect(body.expires).toBe(true)
    expect(body.expiration_date_from).toBe('2026-08-06T11:45:00.000Z')
    expect(body.expiration_date_to).toBe('2026-08-06T12:00:00.000Z')
    expect(body).not.toHaveProperty('date_of_expiration')
    expect((body.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      currency_id: 'MXN',
      unit_price: 1500,
      quantity: 1,
    })
    expect(body).not.toHaveProperty('msi_eligible')
    const types = (body.payment_methods as { excluded_payment_types: Array<{ id: string }> })
      .excluded_payment_types
    expect(types.filter((t) => t.id === 'ticket')).toHaveLength(1)
  })

  it('public passes are card-only from 13 nov 00:00 Merida; everything else still excludes only ticket', async () => {
    const ticketOnly = [{ id: 'ticket' }]
    const cardOnly = [...CARD_ONLY_EXCLUDED_PAYMENT_TYPES]
    expect(cardOnly.map((type) => type.id)).not.toContain('credit_card')
    expect(cardOnly.map((type) => type.id)).not.toContain('debit_card')
    expect(cardOnly.map((type) => type.id)).not.toContain('prepaid_card')

    const before = await capturePolicy('PUB-VIE', dateFromMeridaWall(2026, 11, 12, 12, 0, 0))
    expect(before.payment_methods.excluded_payment_types).toEqual(ticketOnly)

    const atClose = await capturePolicy('PUB-VIE', dateFromMeridaWall(2026, 11, 13, 0, 0, 0))
    expect(atClose.payment_methods.excluded_payment_types).toEqual(cardOnly)

    const competition = await capturePolicy('IND-H', dateFromMeridaWall(2026, 11, 13, 10, 0, 0), true)
    expect(competition.payment_methods.excluded_payment_types).toEqual(ticketOnly)

    const sunday = await capturePolicy('PUB-DOM', dateFromMeridaWall(2026, 11, 15, 12, 0, 0))
    expect(sunday.payment_methods.excluded_payment_types).toEqual(cardOnly)
  })

  it('excluded policy → installments 1 + ticket', async () => {
    const body = await captureBody(false)
    expect(body.payment_methods).toEqual({
      installments: 1,
      excluded_payment_types: [{ id: 'ticket' }],
    })
  })

  it('refuses missing paymentPolicy', async () => {
    const client = createHttpMercadoPagoClient(async () => new Response('{}', { status: 500 }))
    await expect(
      client.createCheckoutProPreference({
        accessToken: 'TEST_TOKEN_NOT_REAL',
        siteId: 'MLM',
        orderId: '22222222-2222-2222-2222-222222222222',
        productCode: 'IND-H',
        productName: 'Individual',
        price: basePrice,
        paymentPolicy: undefined as never,
        backUrls: {
          success: 'https://example.com/s',
          failure: 'https://example.com/f',
          pending: 'https://example.com/p',
        },
        notificationUrl: 'https://example.com/n',
      }),
    ).rejects.toMatchObject({ code: 'CONFIGURATION_ERROR' })
  })

  it('aligns the preference end with the Merida hold instant and refuses a closed one', () => {
    const holdEnd = dateFromMeridaWall(2026, 10, 7, 15, 5, 54)
    const opened = dateFromMeridaWall(2026, 10, 7, 14, 50, 54)
    expect(preferenceTerm(holdEnd.toISOString(), opened)).toEqual({
      expires: true,
      expiration_date_from: '2026-10-07T20:50:54.000Z',
      expiration_date_to: '2026-10-07T21:05:54.000Z',
    })
    expect(preferenceTerm(holdEnd.toISOString(), holdEnd)).toBeNull()
    expect(preferenceTerm(holdEnd.toISOString(), new Date(holdEnd.getTime() + 1))).toBeNull()
  })

  it('does not create a preference once the hold instant has arrived', async () => {
    const client = createHttpMercadoPagoClient(async () => {
      throw new Error('should not call Mercado Pago')
    })
    await expect(
      client.createCheckoutProPreference({
        accessToken: 'TEST_TOKEN_NOT_REAL',
        siteId: 'MLM',
        orderId: '22222222-2222-2222-2222-222222222222',
        productCode: 'IND-H',
        productName: 'Individual',
        price: basePrice,
        paymentPolicy: toCheckoutPaymentPolicy(true),
        backUrls: {
          success: 'https://example.com/s',
          failure: 'https://example.com/f',
          pending: 'https://example.com/p',
        },
        notificationUrl: 'https://example.com/n',
        expiresAt: '2026-08-06T12:00:00.000Z',
        now: new Date('2026-08-06T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'RESERVATION_EXPIRED' })
  })

  it('maps MP HTTP failure to CHECKOUT_CREATION_FAILED', async () => {
    const client = createHttpMercadoPagoClient(async () => new Response('nope', { status: 500 }))
    await expect(
      client.createCheckoutProPreference({
        accessToken: 'TEST_TOKEN_NOT_REAL',
        siteId: 'MLM',
        orderId: '22222222-2222-2222-2222-222222222222',
        productCode: 'IND-H',
        productName: 'Individual',
        price: basePrice,
        paymentPolicy: toCheckoutPaymentPolicy(true),
        backUrls: {
          success: 'https://example.com/s',
          failure: 'https://example.com/f',
          pending: 'https://example.com/p',
        },
        notificationUrl: 'https://example.com/n',
      }),
    ).rejects.toMatchObject({ code: 'CHECKOUT_CREATION_FAILED' })
  })
})
