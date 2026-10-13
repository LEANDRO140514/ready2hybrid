import { describe, expect, it } from 'vitest'
import { chargeIdDecision } from '../../../insforge/functions/_shared/openpay/attempt'
import {
  chargeIsBusinessRejection,
  classifyOpenpayCreateBody,
  sanitizeProviderDetail,
} from '../../../insforge/functions/_shared/openpay/provider-error'

describe('openpay provider rejection', () => {
  it('keeps a promotion rejection as a business result', () => {
    expect(classifyOpenpayCreateBody(402, {
      error_code: 3203,
      description: 'Invalid promotion for such card type',
      http_code: 402,
    })).toEqual({
      outcome: 'business',
      errorCode: '3203',
      description: 'Invalid promotion for such card type',
    })
    expect(chargeIsBusinessRejection('failed')).toBe(true)
  })

  it('does not turn an outage or an empty body into a card rejection', () => {
    expect(classifyOpenpayCreateBody(502, {})).toEqual({ outcome: 'technical' })
    expect(classifyOpenpayCreateBody(402, { description: 'missing code' })).toEqual({ outcome: 'technical' })
    expect(classifyOpenpayCreateBody(200, {})).toEqual({ outcome: 'technical' })
  })

  it('keeps the charge id when Openpay returns the failed charge', () => {
    expect(classifyOpenpayCreateBody(200, {
      id: 'tr2jz3w75waz4psqt21a',
      status: 'failed',
      error_code: 3203,
      error_message: 'Invalid promotion for such card type',
    })).toEqual({
      outcome: 'charge',
      chargeId: 'tr2jz3w75waz4psqt21a',
      status: 'failed',
      errorCode: '3203',
      description: 'Invalid promotion for such card type',
    })
  })

  it('drops card numbers and secrets from the stored description', () => {
    expect(sanitizeProviderDetail('declined 4111111111111111 sk_secretvalue')).toBe('declined')
  })

  it('reconciles one webhook charge and rejects a second id', () => {
    expect(chargeIdDecision(null, 'tr2jz3w75waz4psqt21a')).toBe('set')
    expect(chargeIdDecision('tr2jz3w75waz4psqt21a', 'tr2jz3w75waz4psqt21a')).toBe('same')
    expect(chargeIdDecision('tr2jz3w75waz4psqt21a', 'tranotherchargeid0001')).toBe('mismatch')
  })
})
