import { describe, expect, it } from 'vitest'
import { sandboxReturnOutcome } from '../../../insforge/functions/_shared/openpay/return-status'

describe('openpay 3DS return outcome', () => {
  it('shows the paid order as approved', () => {
    expect(sandboxReturnOutcome({
      orderState: 'PAID',
      attemptStatus: 'APPROVED',
      providerErrorCode: null,
    })).toBe('approved')
  })

  it('keeps an open checkout pending and a promotion rejection failed', () => {
    expect(sandboxReturnOutcome({
      orderState: 'PREFERENCE_PENDING',
      attemptStatus: 'charge_pending',
      providerErrorCode: null,
    })).toBe('pending')
    expect(sandboxReturnOutcome({
      orderState: 'PREFERENCE_PENDING',
      attemptStatus: 'failed',
      providerErrorCode: '3203',
    })).toBe('failed')
  })
})
