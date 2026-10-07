import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  'insforge/migrations/0038_card-rejection-keeps-open-checkout.sql',
  'utf8',
)
const prior = readFileSync(
  'insforge/migrations/0009_fix_webhook_payment_verification_order.sql',
  'utf8',
)

function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

describe('0038 card rejection keeps an open checkout', () => {
  const code = codeOnly(sql)

  it('retries only an unexpired rejection and still closes a cancellation', () => {
    expect(code).toContain("v_outcome := 'REJECTED_RETRYABLE'")
    expect(code).toContain('v_hold.expires_at > now()')
    expect(code).not.toContain("v_payment_target IN ('REJECTED', 'CANCELLED')")
    const cancelled = code.slice(code.indexOf("ELSIF v_payment_target = 'CANCELLED'"))
    expect(cancelled.slice(0, 500)).toContain("v_order_target := 'CANCELLED'")
    expect(cancelled.slice(0, 500)).toContain("v_hold_target := 'RELEASED'")
    expect(code).toContain('orders.paid_payment_id exists')
    expect(code).toContain('IF NOT v_payment_found THEN')
  })

  it('leaves the applied 0009 function unchanged', () => {
    expect(prior).toContain("v_payment_target IN ('REJECTED', 'CANCELLED')")
    expect(prior).not.toContain('REJECTED_RETRYABLE')
  })
})
