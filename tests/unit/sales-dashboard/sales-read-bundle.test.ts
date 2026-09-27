import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const bundlePath = resolve(
  process.cwd(),
  'insforge/functions/ops-sales-read/handler.deploy.js',
)
const checkoutBundle = resolve(
  process.cwd(),
  'insforge/functions/mp-create-checkout/handler.deploy.js',
)

describe('ops-sales-read deploy bundle', () => {
  it('inlines the shared readers and leaves checkout untouched', () => {
    const checkoutBefore = readFileSync(checkoutBundle)
    const result = spawnSync('node', ['scripts/bundle-ops-sales-read.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(checkoutBundle).equals(checkoutBefore)).toBe(true)

    const code = readFileSync(bundlePath, 'utf8')
    expect(code).toContain('OPS_DASHBOARD_CORS_ORIGIN')
    expect(code).toContain('dashboard_readers')
    expect(code).toContain('classifySalesReadRequest')
    expect(code).toContain('assembleSalesSnapshot')
    expect(code).toContain('gateRequestOrigin')
    expect(code).not.toMatch(/from\s+["']\.\.\/_shared\//)
    expect(code).toMatch(/from\(["']payment_finance_adjustments["']\)\s*\.insert/)
    expect(code).toMatch(/from\(["']payment_finance_adjustments["']\)\s*\.update/)
    expect(code).not.toMatch(/from\(["']orders["']\)\s*\.(insert|update|delete|upsert)/)
    expect(code).not.toMatch(/from\(["']payments["']\)\s*\.(insert|update|delete|upsert)/)
    expect(code).not.toMatch(/from\(["']products["']\)\s*\.(insert|update|delete|upsert)/)
    expect(code).not.toMatch(/\.delete\(|\.upsert\(/)
    expect(code).not.toContain('mp-create-checkout')
    expect(code).not.toContain('staged-pricing')
    expect(code).not.toContain('MERCADOPAGO_ACCESS_TOKEN')
    expect(code).toContain('npm:@insforge/sdk@1.5.0')
  }, 60_000)
})
