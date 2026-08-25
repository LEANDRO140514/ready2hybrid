/**
 * RELAUNCH-IMPL-2 commercial data — load-failure diagnosis + v0.4 retarget.
 *
 * DIAGNOSIS (suite previously reported "0 tests / load failure"):
 * Top-level `sqlText(migrationPath('0019_relaunch-v0-3-commercial-data.sql'))`
 * threw ENOENT because 0019 was moved to
 * `docs/specs/holding/migrations-superseded-wip-2026-08-23/` and is no longer
 * under `insforge/migrations/`. That is a path/load error, not a SPEC-030
 * assertion mismatch.
 *
 * 0019 affirmed v0.3 `MULTIDAY_FAIL_CLOSED` for PUB-3D/FOT-3D. Re-pointing the
 * old Postgres suite at holding 0019 would re-affirm the retired contract.
 * That suite is removed. Live commercial catalog + multiday sellability are
 * covered by:
 * - tests/unit/v04-relaunch/sessions-and-multiday.contract.test.ts
 * - tests/unit/checkout/multiday-checkout-eligibility.test.ts
 * - tests/unit/checkout/payment-policy.test.ts
 * - static 0020 guards below
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { migrationPath, stripSqlComments } from './harness'

const HOLDING_0019 = path.resolve(
  process.cwd(),
  'docs/specs/holding/migrations-superseded-wip-2026-08-23/0019_relaunch-v0-3-commercial-data.sql',
)
const MIGRATION_0019 = '0019_relaunch-v0-3-commercial-data.sql'
const MIGRATION_0020 = '0020_v04-commercial-authority-successor.sql'

describe('0019 load path + holding preservation (static)', () => {
  it('0019 is absent from insforge/migrations (load failure root cause)', () => {
    expect(fs.existsSync(migrationPath(MIGRATION_0019))).toBe(false)
    expect(fs.existsSync(HOLDING_0019)).toBe(true)
  })

  it('holding 0019 does not DELETE catalog identities (archived bytes)', () => {
    const sql = fs.readFileSync(HOLDING_0019, 'utf8')
    expect(sql).not.toMatch(
      /\bDELETE\s+FROM\s+(public\.)?(events|event_days|products|orders|payments|registrations|tickets)\b/i,
    )
    expect(sql).not.toMatch(/\bTRUNCATE\b/i)
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i)
  })
})

describe('0020 commercial successor — multiday sellable (static)', () => {
  const sql = fs.readFileSync(migrationPath(MIGRATION_0020), 'utf8')
  const codeSql = stripSqlComments(sql)

  it('catalog seeds PUB-3D / FOT-3D as AVAILABLE (not fail-closed)', () => {
    expect(sql).toContain("'PUB-3D'")
    expect(sql).toContain("'FOT-3D'")
    expect(sql).toMatch(/'PUB-3D'[^;]*'AVAILABLE'|PUB-3D.*AVAILABLE/s)
    expect(codeSql).not.toMatch(/MULTIDAY_FAIL_CLOSED/)
  })

  it('checkout_start_tx / ticket path treat PUB-3D/FOT-3D as sellable 3-day codes', () => {
    expect(codeSql).toContain("v_product.code IN ('PUB-3D', 'FOT-3D')")
    expect(codeSql).toContain("v_product.code NOT IN ('PUB-3D', 'FOT-3D')")
    expect(codeSql).not.toMatch(/MULTIDAY_FAIL_CLOSED/)
  })
})
