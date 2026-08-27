/**
 * Pricing-A FIX-1 local harness — retargeted after 0018 BLOCKED.
 *
 * 0018 (HWM / quota / cupo SOLD_OUT) lives in holding and must not be applied.
 * Live commercial authority is 0020 (organizer sale_state + calendar pricing);
 * 0025 is the live checkout_start_tx successor (team roster capture).
 *
 * Former FIX-1 Postgres suite against 0018 was removed: it affirmed the retired
 * HWM/quota model. Coverage of calendar-only pricing and non-cupo SOLD_OUT is in:
 * - tests/unit/v04-relaunch/pricing-calendar.contract.test.ts
 * - tests/unit/v04-relaunch/quantity-independence.contract.test.ts
 * - tests/unit/checkout/checkout-start.test.ts (calendar ignores HWM)
 * - tests/unit/expiry/logical-capacity-exclusion.test.ts (0025 TX contract)
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { migrationPath, stripSqlComments } from './harness'

const HOLDING_0018 = path.resolve(
  process.cwd(),
  'docs/specs/holding/migrations-superseded-wip-2026-08-23/0018_staged-commercial-pricing.sql',
)
const MIGRATION_0020 = '0020_v04-commercial-authority-successor.sql'
const MIGRATION_0023 = '0023_buyer-contact-checkout-write.sql'

describe('Pricing-A FIX-1 → v0.4 commercial successor static guards', () => {
  it('0018 is blocked from migration discovery; holding preserves FIX-1 markers', () => {
    expect(fs.existsSync(migrationPath('0018_staged-commercial-pricing.sql'))).toBe(false)
    expect(fs.existsSync(migrationPath('0017_operational-identity-assignments.sql'))).toBe(true)
    expect(fs.existsSync(HOLDING_0018)).toBe(true)

    const holding = fs.readFileSync(HOLDING_0018, 'utf8')
    expect(holding).toContain('commercial_stage_high_water')
    expect(holding).toContain('commercial_stage_advances')
    expect(holding).toContain('COMMERCIAL_SNAPSHOT_IMMUTABLE')
    expect(holding).toContain('order_canonical_total_cents')
    expect(holding).toContain('hold_expires_at')
  })

  it('0020 introduced organizer sale_state SOLD_OUT; 0023 is live checkout_start_tx', () => {
    const sql20 = fs.readFileSync(migrationPath(MIGRATION_0020), 'utf8')
    const code20 = stripSqlComments(sql20)
    expect(sql20).toContain('CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)')
    expect(code20).toMatch(/sale_state IS NOT DISTINCT FROM 'SOLD_OUT'/)
    expect(code20).not.toMatch(/INTO v_active_holds/)

    const sql23 = fs.readFileSync(migrationPath(MIGRATION_0023), 'utf8')
    const code23 = stripSqlComments(sql23)
    expect(sql23).toContain('CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)')
    expect(code23).toMatch(/sale_state IS NOT DISTINCT FROM 'SOLD_OUT'/)
    expect(code23).toContain("error_code', 'SOLD_OUT'")
    expect(code23).not.toMatch(/INTO v_active_holds/)
    expect(code23).not.toMatch(
      /IF v_active_holds\s*\+\s*v_units\s*>\s*v_product\.cupo/i,
    )
    expect(code23).toMatch(/cupo\/holds are not commercial SOLD_OUT/i)
    expect(code23).toContain('CONTACT_REQUIRED')
    expect(code23).toContain('contact_consent_at')
    expect(code23).not.toMatch(/BYPASSRLS/i)
    expect(sql23).not.toMatch(/^\s*BEGIN;|^\s*COMMIT;/m)
  })
})
