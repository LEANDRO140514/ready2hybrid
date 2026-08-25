/**
 * Pricing-A FIX-1 local harness — retargeted after 0018 BLOCKED.
 *
 * 0018 (HWM / quota / cupo SOLD_OUT) lives in holding and must not be applied.
 * Live commercial authority is 0020 (organizer sale_state + calendar pricing).
 *
 * Former FIX-1 Postgres suite against 0018 was removed: it affirmed the retired
 * HWM/quota model. Coverage of calendar-only pricing and non-cupo SOLD_OUT is in:
 * - tests/unit/v04-relaunch/pricing-calendar.contract.test.ts
 * - tests/unit/v04-relaunch/quantity-independence.contract.test.ts
 * - tests/unit/checkout/checkout-start.test.ts (calendar ignores HWM)
 * - tests/unit/expiry/logical-capacity-exclusion.test.ts (0020 TX contract)
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

  it('0020 is the live checkout_start_tx: organizer sale_state SOLD_OUT, not cupo', () => {
    const sql = fs.readFileSync(migrationPath(MIGRATION_0020), 'utf8')
    const codeSql = stripSqlComments(sql)

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)')
    expect(codeSql).toMatch(/sale_state IS NOT DISTINCT FROM 'SOLD_OUT'/)
    expect(codeSql).toContain("error_code', 'SOLD_OUT'")
    expect(codeSql).not.toMatch(/INTO v_active_holds/)
    expect(codeSql).not.toMatch(
      /IF v_active_holds\s*\+\s*v_units\s*>\s*v_product\.cupo/i,
    )
    expect(codeSql).toMatch(/cupo\/holds are not commercial SOLD_OUT/i)
    expect(codeSql).not.toMatch(/BYPASSRLS/i)
    expect(sql).not.toMatch(/^\s*BEGIN;|^\s*COMMIT;/m)
  })
})
