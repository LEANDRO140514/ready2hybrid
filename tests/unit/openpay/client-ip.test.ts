import { describe, expect, it } from 'vitest'
import { trustedClientIp, trustedForwardedFor } from '../../../insforge/functions/_shared/openpay/client-ip'

const CHAIN = '198.51.100.10, 10.0.0.4, 192.0.2.20'

describe('trusted client ip', () => {
  it('keeps a lone cf-connecting-ip or x-real-ip when the platform chain is absent', () => {
    expect(trustedClientIp(new Headers({ 'cf-connecting-ip': '198.51.100.10' }))).toBe('198.51.100.10')
    expect(trustedClientIp(new Headers({ 'x-real-ip': '192.0.2.8' }))).toBe('192.0.2.8')
  })

  it('uses the platform-observed address, not a caller prefix', () => {
    expect(trustedForwardedFor(CHAIN)).toBe('198.51.100.10')
    expect(trustedForwardedFor(`203.0.113.99, ${CHAIN}`)).toBe('198.51.100.10')
    expect(trustedForwardedFor(`203.0.113.99, 203.0.113.50, ${CHAIN}`)).toBe('198.51.100.10')
    expect(trustedClientIp(new Headers({
      'cf-connecting-ip': '203.0.113.99',
      'x-forwarded-for': `203.0.113.99, ${CHAIN}`,
    }))).toBe('198.51.100.10')
  })

  it('rejects a short, malformed, or loopback chain', () => {
    expect(trustedForwardedFor('203.0.113.99')).toBeNull()
    expect(trustedForwardedFor('not-an-ip, 10.0.0.1, 192.0.2.1')).toBeNull()
    expect(trustedForwardedFor('127.0.0.1, 10.0.0.1, 192.0.2.1')).toBeNull()
    expect(trustedForwardedFor('198.51.100.10, 192.0.2.1, 10.0.0.1')).toBeNull()
    expect(trustedClientIp(new Headers({ 'cf-connecting-ip': '127.0.0.1' }))).toBeNull()
    expect(trustedClientIp(new Headers({ 'x-real-ip': '999.1.1.1' }))).toBeNull()
  })

  it('accepts an IPv6 client in the platform slot', () => {
    expect(trustedForwardedFor('2001:db8::10, 10.0.0.4, 192.0.2.20')).toBe('2001:db8::10')
    expect(trustedForwardedFor('::1, 10.0.0.4, 192.0.2.20')).toBeNull()
  })

  it('does not read a body field', () => {
    expect(trustedClientIp(new Headers())).toBeNull()
  })
})
