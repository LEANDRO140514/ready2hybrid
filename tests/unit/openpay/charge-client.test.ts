import { describe, expect, it } from 'vitest'
import {
  createOpenpayChargeHttpClient,
  openpayBaseUrl,
  type OpenpayFetch,
} from '../../../insforge/functions/_shared/openpay/charge-client'
import { centsToOpenpayAmount, openpayAmountToCents } from '../../../insforge/functions/_shared/openpay/money'
import {
  OPENPAY_PRODUCTION_BASE_URL,
  OPENPAY_SANDBOX_BASE_URL,
  type OpenpayCreateChargeRequest,
} from '../../../insforge/functions/_shared/openpay/types'
import { PaymentContractError } from '../../../insforge/functions/_shared/payments'

const PRIVATE_KEY = 'test_openpay_private_not_real'
const MERCHANT_ID = 'test_openpay_merchant_not_real'
const CLIENT_IP = '203.0.113.10'
const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function createBody(overrides: Partial<OpenpayCreateChargeRequest> = {}): OpenpayCreateChargeRequest {
  return {
    method: 'card',
    amount: centsToOpenpayAmount(12345),
    currency: 'MXN',
    description: 'Ready2Hybrid checkout',
    order_id: ORDER_ID,
    customer: {
      name: 'Test',
      last_name: 'Buyer',
      phone_number: '5512345678',
      email: 'buyer@example.test',
    },
    confirm: false,
    send_email: false,
    redirect_url: 'https://app.test/openpay/return',
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<OpenpayFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function client(fetchImpl: OpenpayFetch, environment: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX') {
  return createOpenpayChargeHttpClient({
    fetchImpl,
    getPrivateKey: () => PRIVATE_KEY,
    getMerchantId: () => MERCHANT_ID,
    getEnvironment: () => environment,
    getClientIp: () => CLIENT_IP,
  })
}

describe('MULTI-PAY-6 Openpay money conversion', () => {
  it('converts integer cents to Openpay decimal amount', () => {
    expect(centsToOpenpayAmount(100)).toBe(1)
    expect(centsToOpenpayAmount(101)).toBe(1.01)
    expect(centsToOpenpayAmount(12345)).toBe(123.45)
  })

  it('rejects non-integer, non-positive, and unsafe cents before HTTP', () => {
    expect(() => centsToOpenpayAmount(12.5)).toThrow(PaymentContractError)
    expect(() => centsToOpenpayAmount(0)).toThrow(PaymentContractError)
    expect(() => centsToOpenpayAmount(Number.NaN)).toThrow(PaymentContractError)
  })

  it('converts Openpay GET decimal amount to integer cents', () => {
    expect(openpayAmountToCents(1)).toBe(100)
    expect(openpayAmountToCents(1.01)).toBe(101)
    expect(openpayAmountToCents(123.45)).toBe(12345)
  })

  it('fails closed on GET amounts with more than two decimals', () => {
    expect(() => openpayAmountToCents(1.001)).toThrow(PaymentContractError)
    expect(() => openpayAmountToCents(Number.NaN)).toThrow(PaymentContractError)
    expect(() => openpayAmountToCents('123.45')).toThrow(PaymentContractError)
  })
})

describe('MULTI-PAY-6 Openpay HTTP client', () => {
  it('maps SANDBOX and PRODUCTION to official Mexico hosts and does not default to production', () => {
    expect(openpayBaseUrl('SANDBOX')).toBe(OPENPAY_SANDBOX_BASE_URL)
    expect(openpayBaseUrl('PRODUCTION')).toBe(OPENPAY_PRODUCTION_BASE_URL)
    expect(OPENPAY_SANDBOX_BASE_URL).toBe('https://sandbox-api.openpay.mx')
    expect(OPENPAY_PRODUCTION_BASE_URL).toBe('https://api.openpay.mx')
    expect(() => openpayBaseUrl('LIVE' as never)).toThrow(PaymentContractError)
  })

  it('POSTs /v1/{merchantId}/charges with Basic private-key auth, X-Forwarded-For, and hosted redirect body', async () => {
    const calls: Array<{ url: string; init: Parameters<OpenpayFetch>[1] }> = []
    const created = await client(async (url, init) => {
      calls.push({ url, init })
      return jsonResponse(200, {
        id: 'tr6uvyqwqjtmzburr3ew',
        status: 'charge_pending',
        payment_method: {
          type: 'redirect',
          url: 'https://sandbox-api.openpay.mx/v1/redirect/abc',
        },
        amount: 123.45,
        currency: 'MXN',
        order_id: ORDER_ID,
      })
    }).createCharge(createBody())

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${OPENPAY_SANDBOX_BASE_URL}/v1/${MERCHANT_ID}/charges`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers.Authorization).toBe(
      `Basic ${Buffer.from(`${PRIVATE_KEY}:`, 'utf8').toString('base64')}`,
    )
    expect(calls[0]?.init.headers['X-Forwarded-For']).toBe(CLIENT_IP)
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    expect(body.method).toBe('card')
    expect(body.confirm).toBe(false)
    expect(body.send_email).toBe(false)
    expect(body.amount).toBe(123.45)
    expect(body.currency).toBe('MXN')
    expect(body.order_id).toBe(ORDER_ID)
    expect(body.redirect_url).toBe('https://app.test/openpay/return')
    expect(body).not.toHaveProperty('source_id')
    expect(body).not.toHaveProperty('token')
    expect(body).not.toHaveProperty('card_number')
    expect(body).not.toHaveProperty('cvv')
    expect(body).not.toHaveProperty('payment_plan')
    expect(body).not.toHaveProperty('use_3d_secure')
    expect(JSON.stringify(body)).not.toContain(PRIVATE_KEY)
    expect(body).not.toHaveProperty('merchant_id')
    expect(created.id).toBe('tr6uvyqwqjtmzburr3ew')
    expect(created.payment_method.type).toBe('redirect')
    expect(created.payment_method.url).toContain('openpay.mx')
  })

  it('uses production host only when environment is PRODUCTION', async () => {
    const urls: string[] = []
    await client(async (url) => {
      urls.push(url)
      return jsonResponse(200, {
        id: 'tr-prod',
        status: 'charge_pending',
        payment_method: { type: 'redirect', url: 'https://api.openpay.mx/v1/redirect/x' },
      })
    }, 'PRODUCTION').createCharge(createBody())
    expect(urls[0]?.startsWith(`${OPENPAY_PRODUCTION_BASE_URL}/v1/`)).toBe(true)
    expect(urls[0]).not.toContain('sandbox-api.openpay.mx')
  })

  it('fails closed when client IP is missing', async () => {
    const http = createOpenpayChargeHttpClient({
      fetchImpl: async () => jsonResponse(200, {}),
      getPrivateKey: () => PRIVATE_KEY,
      getMerchantId: () => MERCHANT_ID,
      getEnvironment: () => 'SANDBOX',
      getClientIp: () => 'unknown',
    })
    await expect(http.createCharge(createBody())).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('requires non-empty charge id, payment_method.type=redirect, and payment_method.url', async () => {
    const failing = (body: unknown) =>
      client(async () => jsonResponse(200, body)).createCharge(createBody())
    await expect(failing({ status: 'charge_pending', payment_method: { type: 'redirect', url: 'https://x' } })).rejects.toMatchObject(
      { code: 'PROVIDER_UNAVAILABLE' },
    )
    await expect(
      failing({ id: 'tr1', status: 'charge_pending', payment_method: { type: 'card', url: 'https://x' } }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    await expect(
      failing({ id: 'tr1', status: 'charge_pending', payment_method: { type: 'redirect', url: '' } }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })

  it('fails closed on 4xx, 5xx, malformed JSON, and network errors', async () => {
    await expect(client(async () => jsonResponse(400, {})).createCharge(createBody())).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    await expect(client(async () => jsonResponse(500, {})).createCharge(createBody())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    await expect(
      client(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('no json')
        },
      })).createCharge(createBody()),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
    await expect(
      client(async () => {
        throw new Error('network')
      }).createCharge(createBody()),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })

  it('GETs /v1/{merchantId}/charges/{transactionId} and preserves financial fields', async () => {
    const calls: Array<{ url: string; init: Parameters<OpenpayFetch>[1] }> = []
    const got = await client(async (url, init) => {
      calls.push({ url, init })
      return jsonResponse(200, {
        id: 'tr6uvyqwqjtmzburr3ew',
        status: 'completed',
        amount: 123.45,
        currency: 'MXN',
        order_id: ORDER_ID,
        transaction_type: 'charge',
        operation_type: 'in',
        method: 'card',
      })
    }).getCharge('tr6uvyqwqjtmzburr3ew')
    expect(calls[0]?.url).toBe(
      `${OPENPAY_SANDBOX_BASE_URL}/v1/${MERCHANT_ID}/charges/tr6uvyqwqjtmzburr3ew`,
    )
    expect(calls[0]?.init.method).toBe('GET')
    expect(calls[0]?.init.body).toBeUndefined()
    expect(calls[0]?.init.headers.Authorization).toContain('Basic ')
    expect(got.id).toBe('tr6uvyqwqjtmzburr3ew')
    expect(got.order_id).toBe(ORDER_ID)
    expect(got.amount).toBe(123.45)
    expect(openpayAmountToCents(got.amount)).toBe(12345)
    expect(got.currency).toBe('MXN')
    expect(got.status).toBe('completed')
    expect(got.transaction_type).toBe('charge')
    expect(got.operation_type).toBe('in')
    expect(got.method).toBe('card')
  })

  it('GET 404/5xx/malformed JSON fail closed', async () => {
    await expect(client(async () => jsonResponse(404, {})).getCharge('missing')).rejects.toMatchObject({
      code: 'FINANCIAL_RESOLUTION_FAILURE',
    })
    await expect(client(async () => jsonResponse(500, {})).getCharge('x')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    await expect(
      client(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad')
        },
      })).getCharge('x'),
    ).rejects.toMatchObject({ code: 'FINANCIAL_RESOLUTION_FAILURE' })
  })

  it('does not perform a live Openpay HTTP call', async () => {
    const urls: string[] = []
    await client(async (url) => {
      urls.push(url)
      return jsonResponse(200, {
        id: 'tr-1',
        status: 'charge_pending',
        payment_method: { type: 'redirect', url: 'https://sandbox-api.openpay.mx/v1/redirect/1' },
      })
    }).createCharge(createBody())
    expect(urls).toHaveLength(1)
    expect(urls[0]).toBe(`${OPENPAY_SANDBOX_BASE_URL}/v1/${MERCHANT_ID}/charges`)
  })
})
