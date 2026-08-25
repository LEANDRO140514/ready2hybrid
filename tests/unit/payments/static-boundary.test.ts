import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NORMALIZED_PAYMENT_STATUSES } from '../../../insforge/functions/_shared/payments'
import { type NormalizedPaymentState } from '../../../insforge/functions/_shared/webhook/normalize'

const PAYMENTS_DIR = resolve(process.cwd(), 'insforge/functions/_shared/payments')
const PRODUCTION_BARREL = join(PAYMENTS_DIR, 'index.ts')
const TYPES = join(PAYMENTS_DIR, 'types.ts')
const CHECKOUT_INPUT = join(PAYMENTS_DIR, 'checkout-input.ts')

function collectFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...collectFiles(full))
    else out.push(full)
  }
  return out
}

describe('MULTI-PAY-3 static contract boundaries', () => {
  it('reuses existing normalized payment literals', () => {
    const webhookLiterals: NormalizedPaymentState[] = [
      'UNKNOWN',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'REFUNDED',
      'CHARGED_BACK',
    ]
    expect([...NORMALIZED_PAYMENT_STATUSES]).toEqual(webhookLiterals)
  })

  it('does not introduce PAN/CVV capture types, PayPal members, refund APIs, or frontend secrets', () => {
    const files = collectFiles(PAYMENTS_DIR)
    const types = readFileSync(TYPES, 'utf8')
    const ids = readFileSync(join(PAYMENTS_DIR, 'ids.ts'), 'utf8')
    const adapter = readFileSync(join(PAYMENTS_DIR, 'adapter.ts'), 'utf8')
    const joined = files.map((file) => readFileSync(file, 'utf8')).join('\n')

    expect(types).not.toMatch(/^\s*(pan|cvv|cvc|card_number|security_code)\s*:/m)
    expect(ids).not.toContain('PAYPAL')
    expect(adapter).not.toMatch(/\brefund\s*\(/)
    expect(adapter).not.toMatch(/\bcapture\s*\(/)
    expect(joined).not.toMatch(/tokenizeCard|saveCard|subscription|recurringBilling/)
    expect(joined).not.toMatch(/VITE_CLIP_|VITE_OPENPAY_|VITE_MERCADOPAGO_/)
    expect(joined).not.toMatch(/transparente/i)
    expect(joined).not.toMatch(/\/v1\/\{MERCHANT_ID\}\/checkouts|checkout_link/)
    expect(files.some((file) => /paypal/i.test(file))).toBe(false)
  })

  it('keeps verifyEvent and getPayment as separate adapter operations', () => {
    const adapter = readFileSync(join(PAYMENTS_DIR, 'adapter.ts'), 'utf8')
    expect(adapter).toContain('verifyEvent(')
    expect(adapter).toContain('getPayment(')
    expect(adapter).toContain('createCheckout(')
    expect(adapter).toContain('normalizeStatus(')
    expect(adapter).not.toContain('verifyWebhook() => paid')
    expect(adapter).not.toMatch(/refund\s*\(/)
  })
})

describe('MULTI-PAY-3C mock isolation and PAYMENT_ELIGIBLE diagnostic', () => {
  it('does not export in-memory event gate or mock adapter from the production payments barrel', () => {
    const barrel = readFileSync(PRODUCTION_BARREL, 'utf8')
    expect(barrel).not.toContain('createInMemoryEventEffectGate')
    expect(barrel).not.toContain('createInMemoryPaymentAdapter')
    expect(barrel).not.toContain('./event-gate')
    expect(barrel).not.toContain('./mocks/')
  })

  it('keeps the in-memory event gate only under mocks/', () => {
    const files = collectFiles(PAYMENTS_DIR)
    const relative = files.map((file) => file.slice(PAYMENTS_DIR.length).replaceAll('\\', '/'))
    expect(relative).toContain('/mocks/event-gate.ts')
    expect(relative.some((file) => file === '/event-gate.ts')).toBe(false)
  })

  it('uses the same PAYMENT_ELIGIBLE token in code as SPEC-041-R043', () => {
    const types = readFileSync(TYPES, 'utf8')
    const checkoutInput = readFileSync(CHECKOUT_INPUT, 'utf8')
    expect(types).toContain("export type PaymentEligibleMark = 'PAYMENT_ELIGIBLE'")
    expect(checkoutInput).toContain("obj.eligibility !== 'PAYMENT_ELIGIBLE'")
    expect(checkoutInput).toContain("eligibility: 'PAYMENT_ELIGIBLE'")
  })
})
