import { describe, expect, it } from 'vitest'
import {
  createClipCheckoutHttpClient,
  type ClipFetch,
} from '../../../insforge/functions/_shared/clip/checkout-client'
import { centsToClipAmount, clipAmountToCents } from '../../../insforge/functions/_shared/clip/money'
import { DEFAULT_CLIP_API_BASE_URL } from '../../../insforge/functions/_shared/clip/types'
import type { ClipCreateCheckoutRequest } from '../../../insforge/functions/_shared/clip/types'
import { PaymentContractError } from '../../../insforge/functions/_shared/payments'

const TOKEN = 'TEST_CLIP_TOKEN_NOT_REAL'
const WEBHOOK = 'https://api.ready2hybrid.test/functions/clip-webhook'
const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function createBody(): ClipCreateCheckoutRequest {
  return {
    amount: centsToClipAmount(12345),
    currency: 'MXN',
    purchase_description: 'Ready2Hybrid checkout',
    redirection_url: {
      success: 'https://app.test/success',
      error: 'https://app.test/failure',
      default: 'https://app.test/pending',
    },
    webhook_url: WEBHOOK,
    metadata: { external_reference: ORDER_ID },
    override_settings: { tip_enabled: false },
    expires_at: '2026-08-24T18:00:00Z',
  }
}

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<ClipFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('MULTI-PAY-5 Clip money conversion', () => {
  it('converts integer cents to Clip decimal amount', () => {
    expect(centsToClipAmount(12345)).toBe(123.45)
    expect(centsToClipAmount(140000)).toBe(1400)
  })

  it('rejects non-integer, non-positive, and unsafe cents before HTTP', () => {
    expect(() => centsToClipAmount(12.5)).toThrow(PaymentContractError)
    expect(() => centsToClipAmount(0)).toThrow(PaymentContractError)
    expect(() => centsToClipAmount(Number.NaN)).toThrow(PaymentContractError)
  })

  it('rejects Clip create amounts below 1.00 MXN and does not clamp', () => {
    expect(() => centsToClipAmount(0)).toThrow(PaymentContractError)
    expect(() => centsToClipAmount(1)).toThrow(PaymentContractError)
    expect(() => centsToClipAmount(99)).toThrow(PaymentContractError)
    expect(centsToClipAmount(100)).toBe(1)
    expect(centsToClipAmount(101)).toBe(1.01)
    expect(centsToClipAmount(12345)).toBe(123.45)
  })

  it('converts Clip GET decimal amount to integer cents', () => {
    expect(clipAmountToCents(123.45)).toBe(12345)
    expect(clipAmountToCents(1400)).toBe(140000)
  })

  it('rejects non-finite GET amounts', () => {
    expect(() => clipAmountToCents(Number.NaN)).toThrow(PaymentContractError)
    expect(() => clipAmountToCents('123.45')).toThrow(PaymentContractError)
  })
})

describe('MULTI-PAY-5 Clip HTTP client', () => {
  it('POSTs v2 checkout with server Authorization, canonical money, and no tip/MSI', async () => {
    const calls: Array<{ url: string; init: Parameters<ClipFetch>[1] }> = []
    const client = createClipCheckoutHttpClient({
      getAuthorizationToken: () => TOKEN,
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        return jsonResponse(200, {
          payment_request_id: 'req-1',
          payment_request_url: 'https://hosted.payclip.com/r/req-1',
        })
      },
    })
    const created = await client.createCheckout(createBody())
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${DEFAULT_CLIP_API_BASE_URL}/v2/checkout`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers.Authorization).toBe(TOKEN)
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    expect(body.amount).toBe(123.45)
    expect(body.currency).toBe('MXN')
    expect(body.metadata).toEqual({ external_reference: ORDER_ID })
    expect(body.webhook_url).toBe(WEBHOOK)
    expect(body.redirection_url).toEqual({
      success: 'https://app.test/success',
      error: 'https://app.test/failure',
      default: 'https://app.test/pending',
    })
    expect((body.override_settings as { tip_enabled?: boolean }).tip_enabled).toBe(false)
    expect(body.tip_enabled).toBeUndefined()
    expect(body).not.toHaveProperty('tip_enabled')
    expect(body).not.toHaveProperty('installments_msi')
    expect(body.expires_at).toBe('2026-08-24T18:00:00Z')
    expect(String(body.expires_at)).toHaveLength(20)
    expect(String(body.expires_at)).not.toContain('.000Z')
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    expect(created.payment_request_id).toBe('req-1')
    expect(created.payment_request_url).toContain('payclip.com')
  })

  it('GETs v2 checkout/{payment_request_id} and preserves amount, currency, correlation, receipt', async () => {
    const calls: Array<{ url: string; init: Parameters<ClipFetch>[1] }> = []
    const client = createClipCheckoutHttpClient({
      getAuthorizationToken: () => TOKEN,
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        return jsonResponse(200, {
          payment_request_id: 'req-77',
          status: 'CHECKOUT_COMPLETED',
          amount: 1400,
          currency: 'MXN',
          metadata: { external_reference: ORDER_ID },
          receipt_no: 'RCP-77',
        })
      },
    })
    const got = await client.getCheckout('req-77')
    expect(calls[0]?.url).toBe(`${DEFAULT_CLIP_API_BASE_URL}/v2/checkout/req-77`)
    expect(calls[0]?.init.method).toBe('GET')
    expect(calls[0]?.init.body).toBeUndefined()
    expect(got.amount).toBe(1400)
    expect(clipAmountToCents(got.amount)).toBe(140000)
    expect(got.currency).toBe('MXN')
    expect(got.metadata?.external_reference).toBe(ORDER_ID)
    expect(got.receipt_no).toBe('RCP-77')
  })

  it('fails closed on 4xx, 5xx, malformed JSON, and missing create fields', async () => {
    const failing = (status: number, body: unknown = {}) =>
      createClipCheckoutHttpClient({
        getAuthorizationToken: () => TOKEN,
        fetchImpl: async () => jsonResponse(status, body),
      })
    await expect(failing(400).createCheckout(createBody())).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    await expect(failing(500).createCheckout(createBody())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    await expect(failing(200, { payment_request_id: 'x' }).createCheckout(createBody())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    const malformed = createClipCheckoutHttpClient({
      getAuthorizationToken: () => TOKEN,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('no json')
        },
      }),
    })
    await expect(malformed.createCheckout(createBody())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    })
    await expect(failing(404).getCheckout('missing')).rejects.toMatchObject({
      code: 'FINANCIAL_RESOLUTION_FAILURE',
    })
  })

  it('does not perform a live Clip HTTP call', async () => {
    const calls: string[] = []
    const client = createClipCheckoutHttpClient({
      getAuthorizationToken: () => TOKEN,
      fetchImpl: async (url) => {
        calls.push(url)
        return jsonResponse(200, {
          payment_request_id: 'req-1',
          payment_request_url: 'https://hosted.payclip.com/r/req-1',
        })
      },
    })
    await client.createCheckout(createBody())
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${DEFAULT_CLIP_API_BASE_URL}/v2/checkout`)
  })
})
