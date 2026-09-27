import { describe, expect, it, vi } from 'vitest'
import {
  CERT_CUSTOMER,
  CERT_DESCRIPTION,
  buildCertCharge,
  displayStatus,
  handleCertCreate,
  handleCertVerify,
  handleCertWebhook,
  renderCertPage,
  trustedClientIp,
  type CertEnv,
} from '../../../insforge/functions/_shared/openpay-cert/harness.ts'

const redirectUrl = 'https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-page'
const token = 'tok1234567890abcd'
const device = 'a'.repeat(32)

const env: CertEnv = {
  enabled: 'true',
  sandbox: 'true',
  merchantId: 'mmerchantid0123456789',
  privateKey: 'sk_sandbox_test_key',
  publicKey: 'pk_sandbox_test_key',
  webhookUser: 'cert-user',
  webhookPassword: 'cert-password',
  redirectUrl,
}

function request(url: string, init: RequestInit & { ip?: string } = {}): Request {
  const headers = new Headers(init.headers)
  if (init.ip) headers.set('cf-connecting-ip', init.ip)
  return new Request(url, { ...init, headers })
}

describe('openpay certification charge', () => {
  it('builds a tokenized 3DS charge without confirm or card data', () => {
    const built = buildCertCharge({
      token,
      deviceSessionId: device,
      amount: 100,
      installments: 1,
      orderId: 'certabc',
      redirectUrl,
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.body).toMatchObject({
      method: 'card',
      source_id: token,
      amount: 100,
      currency: 'MXN',
      description: CERT_DESCRIPTION,
      device_session_id: device,
      customer: CERT_CUSTOMER,
      use_3d_secure: true,
      redirect_url: redirectUrl,
    })
    expect(built.body).not.toHaveProperty('confirm')
    expect(built.body).not.toHaveProperty('payment_plan')
    expect(JSON.stringify(built.body)).not.toMatch(/card_number|cvv/i)
  })

  it('adds 3 MSI only at or above MXN 300', () => {
    const allowed = buildCertCharge({
      token,
      deviceSessionId: device,
      amount: 300,
      installments: 3,
      orderId: 'certmsi',
      redirectUrl,
    })
    expect(allowed.ok && allowed.body.payment_plan).toEqual({ payments: 3 })
    const blocked = buildCertCharge({
      token,
      deviceSessionId: device,
      amount: 299,
      installments: 3,
      orderId: 'certmsi',
      redirectUrl,
    })
    expect(blocked).toEqual({ ok: false, code: 'MSI_BELOW_MINIMUM' })
  })

  it.each([6, 9, 12, 18])('rejects %s installments', (installments) => {
    const built = buildCertCharge({
      token,
      deviceSessionId: device,
      amount: 1000,
      installments,
      orderId: 'certmsi',
      redirectUrl,
    })
    expect(built).toEqual({ ok: false, code: 'MSI_NOT_OFFERED' })
  })

  it('rejects amounts above MXN 150000', () => {
    const built = buildCertCharge({
      token,
      deviceSessionId: device,
      amount: 150000.01,
      installments: 1,
      orderId: 'certlimit',
      redirectUrl,
    })
    expect(built).toEqual({ ok: false, code: 'AMOUNT_ABOVE_LIMIT' })
  })

  it('refuses PAN or CVV before calling Openpay', async () => {
    const fetchImpl = vi.fn()
    const response = await handleCertCreate(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-create-charge', {
        method: 'POST',
        ip: '203.0.113.10',
        body: JSON.stringify({ card_number: '4111111111111111', cvv2: '123', amount: 100, installments: 1 }),
      }),
      env,
      fetchImpl,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'CARD_DATA_REJECTED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends the trusted client IP and never the production API host', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: 'trchargeid0000000001',
        status: 'charge_pending',
        order_id: 'certorder',
        payment_method: { type: 'redirect', url: 'https://sandbox-api.openpay.mx/v1/m/charges/trchargeid0000000001/card_capture' },
      }),
    )
    const response = await handleCertCreate(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-create-charge', {
        method: 'POST',
        ip: '203.0.113.10',
        headers: { 'x-forwarded-for': '198.51.100.20' },
        body: JSON.stringify({ token, device_session_id: device, amount: 100, installments: 1 }),
      }),
      env,
      fetchImpl,
    )
    expect(response.status).toBe(200)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://sandbox-api.openpay.mx/v1/mmerchantid0123456789/charges')
    expect(url).not.toContain('://api.openpay.mx')
    expect(new Headers(init.headers).get('x-forwarded-for')).toBe('203.0.113.10')
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(sent.confirm).toBeUndefined()
    expect(sent.use_3d_secure).toBe(true)
    const view = await response.json()
    expect(view.display).toBe('PENDING')
    expect(view.redirect_url).toContain('https://sandbox-api.openpay.mx/')
  })

  it('ignores a browser-supplied forwarding header when no platform IP exists', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.20' })
    expect(trustedClientIp(headers)).toBeNull()
  })
})

describe('openpay certification verify and webhook', () => {
  it('maps the charge returned by Openpay, not a redirect query', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ id: 'trchargeid0000000001', status: 'completed', error_message: null }),
    )
    const response = await handleCertVerify(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-verify-charge?id=trchargeid0000000001&status=success', {
        method: 'GET',
      }),
      env,
      fetchImpl,
    )
    const view = await response.json()
    expect(view.display).toBe('APPROVED')
    expect(view.buyer_message).toBe('Pago aprobado.')
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://sandbox-api.openpay.mx/v1/mmerchantid0123456789/charges/trchargeid0000000001',
    )
  })

  it('shows a declined charge from the authenticated GET', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ id: 'trchargeid0000000002', status: 'failed', error_message: 'La tarjeta fue rechazada.' }),
    )
    const response = await handleCertVerify(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-verify-charge?id=trchargeid0000000002', {
        method: 'GET',
      }),
      env,
      fetchImpl,
    )
    const view = await response.json()
    expect(view.display).toBe('DECLINED')
    expect(view.buyer_message).toBe('La tarjeta fue rechazada.')
  })

  it('accepts webhook verification without fetching a charge', async () => {
    const fetchImpl = vi.fn()
    const response = await handleCertWebhook(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-webhook', {
        method: 'POST',
        headers: { authorization: `Basic ${btoa('cert-user:cert-password')}` },
        body: JSON.stringify({ type: 'verification' }),
      }),
      env,
      fetchImpl,
    )
    expect(response.status).toBe(200)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fetches the charge on charge.succeeded and again when the event repeats', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ id: 'trchargeid0000000001', status: 'completed' }),
    )
    const init = {
      method: 'POST',
      headers: { authorization: `Basic ${btoa('cert-user:cert-password')}` },
      body: JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'trchargeid0000000001', status: 'completed' } }),
    }
    const first = await handleCertWebhook(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-webhook', init),
      env,
      fetchImpl,
    )
    const second = await handleCertWebhook(
      request('https://f4rbwhth.us-east.insforge.app/functions/openpay-cert-webhook', init),
      env,
      fetchImpl,
    )
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(await first.json()).toMatchObject({ display: 'APPROVED', status: 'completed' })
  })

  it('does not treat an event name as an approved charge', () => {
    expect(displayStatus('charge.succeeded')).toBe('UNCONFIRMED')
    expect(displayStatus('completed')).toBe('APPROVED')
    expect(displayStatus('failed')).toBe('DECLINED')
    expect(displayStatus('charge_pending')).toBe('PENDING')
  })
})

describe('certification page', () => {
  it('embeds only the public key and does not mark the return as success', async () => {
    const response = renderCertPage(env)
    const html = await response.text()
    expect(html).toContain('pk_sandbox_test_key')
    expect(html).not.toContain('sk_sandbox_test_key')
    expect(html).not.toContain('cert-password')
    expect(html).toContain('Verificando pago...')
    expect(html).toContain('setSandboxMode(true)')
    expect(html).not.toContain('name="card_number"')
    expect(html).not.toContain('confirm')
  })

  it('stays closed when the sandbox flag is off', async () => {
    const response = renderCertPage({ ...env, sandbox: 'false' })
    expect(response.status).toBe(404)
  })
})
