import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildManifest,
  normalizeDataId,
  parseXSignature,
  timingSafeEqualHex,
  validateMercadoPagoWebhookSignature,
} from '../../../insforge/functions/_shared/mercadopago/signature'

const TEST_SECRET = 'test_webhook_secret_not_real'

function sign(dataId: string, requestId: string, ts: string, secret = TEST_SECRET): string {
  const manifest = buildManifest(normalizeDataId(dataId), requestId, ts)
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

describe('Mercado Pago x-signature', () => {
  it('parses valid x-signature', () => {
    const parts = parseXSignature('ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839')
    expect(parts?.ts).toBe('1704908010')
    expect(parts?.v1).toHaveLength(64)
  })

  it('rejects malformed timestamp', () => {
    expect(parseXSignature('ts=abc,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839')).toBeNull()
  })

  it('rejects malformed hash', () => {
    expect(parseXSignature('ts=1704908010,v1=not-hex')).toBeNull()
  })

  it('normalizes uppercase data.id', () => {
    expect(normalizeDataId('ORD01ABC')).toBe('ord01abc')
  })

  it('accepts valid signature fixture', async () => {
    const dataId = '999999999'
    const requestId = 'req-abc-123'
    const ts = '1704908010'
    const result = await validateMercadoPagoWebhookSignature({
      xSignature: sign(dataId, requestId, ts),
      xRequestId: requestId,
      dataId,
      secret: TEST_SECRET,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects incorrect signature', async () => {
    const result = await validateMercadoPagoWebhookSignature({
      xSignature: 'ts=1704908010,v1=0000000000000000000000000000000000000000000000000000000000000000',
      xRequestId: 'req-1',
      dataId: '1',
      secret: TEST_SECRET,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('MISMATCH')
  })

  it('rejects missing signature', async () => {
    const result = await validateMercadoPagoWebhookSignature({
      xSignature: null,
      xRequestId: 'req-1',
      dataId: '1',
      secret: TEST_SECRET,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('MISSING_SIGNATURE')
  })

  it('rejects missing x-request-id', async () => {
    const result = await validateMercadoPagoWebhookSignature({
      xSignature: sign('1', 'req', '1'),
      xRequestId: '',
      dataId: '1',
      secret: TEST_SECRET,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('MISSING_REQUEST_ID')
  })

  it('rejects missing data.id', async () => {
    const result = await validateMercadoPagoWebhookSignature({
      xSignature: sign('1', 'req', '1'),
      xRequestId: 'req',
      dataId: null,
      secret: TEST_SECRET,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('MISSING_DATA_ID')
  })

  it('uses constant-time compare helper', () => {
    expect(timingSafeEqualHex('ab', 'ab')).toBe(true)
    expect(timingSafeEqualHex('ab', 'ac')).toBe(false)
    expect(timingSafeEqualHex('ab', 'abc')).toBe(false)
  })
})
