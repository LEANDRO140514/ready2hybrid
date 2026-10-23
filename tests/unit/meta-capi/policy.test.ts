// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { classifyResponse, MAX_ATTEMPTS, nextAttemptAt } from '../../../insforge/functions/_shared/meta-capi/policy'

describe('classifyResponse', () => {
  it('treats 2xx as sent', () => {
    expect(classifyResponse(200)).toBe('SENT')
  })

  it('retries rate limits, server errors and network failures', () => {
    expect(classifyResponse(429)).toBe('RETRY')
    expect(classifyResponse(500)).toBe('RETRY')
    expect(classifyResponse(503)).toBe('RETRY')
    expect(classifyResponse(0)).toBe('RETRY')
  })

  it('fails permanently on other client errors, so a bad event is never hammered', () => {
    expect(classifyResponse(400)).toBe('FAILED')
    expect(classifyResponse(401)).toBe('FAILED')
    expect(classifyResponse(403)).toBe('FAILED')
  })
})

describe('nextAttemptAt', () => {
  const now = new Date('2026-10-25T12:00:00.000Z')

  it('backs off exponentially from five minutes', () => {
    expect(nextAttemptAt(1, now).toISOString()).toBe('2026-10-25T12:05:00.000Z')
    expect(nextAttemptAt(2, now).toISOString()).toBe('2026-10-25T12:10:00.000Z')
    expect(nextAttemptAt(3, now).toISOString()).toBe('2026-10-25T12:20:00.000Z')
  })

  it('caps the wait at two hours', () => {
    expect(nextAttemptAt(10, now).toISOString()).toBe('2026-10-25T14:00:00.000Z')
  })

  it('gives up after a bounded number of attempts', () => {
    expect(MAX_ATTEMPTS).toBe(6)
  })
})
