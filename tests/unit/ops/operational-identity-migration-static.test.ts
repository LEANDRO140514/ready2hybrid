import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = resolve(process.cwd(), 'insforge/migrations')
const migrationName = '0017_operational-identity-assignments.sql'
const migrationPath = resolve(migrationsDir, migrationName)

const sql = readFileSync(migrationPath, 'utf8')
const codeSql = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

const salesTxnTables = [
  'participants',
  'buyer_contacts',
  'registrations',
  'orders',
  'payments',
  'tickets',
] as const

describe('0017 operational identity migration static guards', () => {
  it('exists as exactly one 0017_* with the approved filename', () => {
    const names = readdirSync(migrationsDir).filter((n) => n.startsWith('0017'))
    expect(names).toEqual([migrationName])
    expect(existsSync(migrationPath)).toBe(true)
    expect(existsSync(resolve(migrationsDir, '0016_compensating-privilege-hardening-checkout-compatibility.sql'))).toBe(
      true,
    )
  })

  it('enables btree_gist and ACTIVE overlap EXCLUDE with semi-open [) range only', () => {
    expect(codeSql).toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+btree_gist/i)
    expect(codeSql).toMatch(/EXCLUDE\s+USING\s+gist/i)
    expect(codeSql).toContain("tstzrange(valid_from, valid_until, '[)')")
    expect(codeSql).toMatch(/WHERE\s*\(\s*status\s*=\s*'ACTIVE'\s*\)/i)
    expect(codeSql).not.toMatch(/OVERLAP_ENFORCED_IN_T2_2C/)
    expect(codeSql).not.toMatch(/overlap_guard|no_active_overlap_guard|assignments_overlap/i)
    expect(codeSql).not.toMatch(
      /EXISTS\s*\(\s*SELECT[\s\S]{0,400}operational_assignments[\s\S]{0,200}&&/,
    )
  })

  it('creates exactly the three operational tables', () => {
    expect(codeSql).toMatch(/CREATE\s+TABLE\s+public\.operational_operators\s*\(/i)
    expect(codeSql).toMatch(/CREATE\s+TABLE\s+public\.operational_areas\s*\(/i)
    expect(codeSql).toMatch(/CREATE\s+TABLE\s+public\.operational_assignments\s*\(/i)
    const creates = codeSql.match(/CREATE\s+TABLE\s+public\.operational_\w+/gi) ?? []
    expect(creates).toHaveLength(3)
  })

  it('aligns event keys to real 0001/0002 types and adds event_days composite unique', () => {
    expect(codeSql).toMatch(/event_id\s+uuid\s+NOT\s+NULL/i)
    expect(codeSql).toMatch(/event_code\s+text\s+NOT\s+NULL/i)
    expect(codeSql).toMatch(/event_day_id\s+uuid\s+NOT\s+NULL/i)
    expect(codeSql).toMatch(
      /uq_event_days_id_event_code[\s\S]*UNIQUE\s*\(\s*id\s*,\s*event_code\s*\)/i,
    )
  })

  it('declares composite foreign keys for event / day / area coherence', () => {
    expect(codeSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*event_id\s*,\s*event_code\s*\)\s*REFERENCES\s+public\.events\s*\(\s*id\s*,\s*code\s*\)/i,
    )
    expect(codeSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*event_day_id\s*,\s*event_code\s*\)\s*REFERENCES\s+public\.event_days\s*\(\s*id\s*,\s*event_code\s*\)/i,
    )
    expect(codeSql).toMatch(
      /FOREIGN\s+KEY\s*\(\s*area_id\s*,\s*event_id\s*,\s*event_code\s*\)\s*REFERENCES\s+public\.operational_areas\s*\(\s*id\s*,\s*event_id\s*,\s*event_code\s*\)/i,
    )
    expect(codeSql).toMatch(/ON\s+DELETE\s+RESTRICT/i)
    expect(codeSql).not.toMatch(/ON\s+DELETE\s+CASCADE/i)
  })

  it('keeps only permitted integrity triggers (area-day and supersession)', () => {
    expect(codeSql).toMatch(/operational_assignments_area_day_guard/i)
    expect(codeSql).toMatch(/operational_assignments_supersede_guard/i)
    expect(codeSql).toMatch(/trg_operational_assignments_area_day_guard/i)
    expect(codeSql).toMatch(/trg_operational_assignments_supersede_guard/i)
    expect(codeSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.operational_assignments_area_day_guard\(\)\s+FROM\s+PUBLIC/i,
    )
    expect(codeSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.operational_assignments_supersede_guard\(\)\s+FROM\s+anon\s*,\s*authenticated/i,
    )
    expect(codeSql).not.toMatch(/SECURITY\s+DEFINER/i)
  })

  it('locks roles and persisted statuses without EXPIRED', () => {
    for (const role of [
      'OWNER',
      'OPERATIONS_MANAGER',
      'CHECKIN_STAFF',
      'SOLUTION_DESK',
    ]) {
      expect(codeSql).toContain(`'${role}'`)
    }
    expect(codeSql).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(\s*'ACTIVE'\s*,\s*'SUSPENDED'\s*,\s*'REVOKED'\s*\)\s*\)/i)
    expect(codeSql).not.toMatch(/status\s+IN\s*\([^)]*'EXPIRED'/)
  })

  it('uses bigint source_version and a single supersedes column', () => {
    expect(codeSql).toMatch(/source_version\s+bigint\s+NOT\s+NULL\s+DEFAULT\s+1/i)
    expect(codeSql).toMatch(/supersedes_assignment_id\s+uuid\s+NULL/i)
    expect(codeSql).not.toMatch(/superseded_by_assignment_id/i)
  })

  it('enforces nonempty strings, revoke fields, and role/area rules', () => {
    expect(codeSql).toMatch(/btrim\(\s*auth_user_id\s*\)\s*<>\s*''/i)
    expect(codeSql).toMatch(/btrim\(\s*display_name\s*\)\s*<>\s*''/i)
    expect(codeSql).toMatch(/btrim\(\s*created_by_actor_ref\s*\)\s*<>\s*''/i)
    expect(codeSql).toMatch(/ck_operational_assignments_revoke_fields/i)
    expect(codeSql).toMatch(/ck_operational_assignments_role_area/i)
    expect(codeSql).toMatch(/CHECKIN_STAFF[\s\S]*area_id\s+IS\s+NOT\s+NULL/i)
  })

  it('enables FORCE RLS and revokes PUBLIC/anon/authenticated without policies', () => {
    for (const table of [
      'operational_operators',
      'operational_areas',
      'operational_assignments',
    ]) {
      expect(codeSql).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'),
      )
      expect(codeSql).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'),
      )
      expect(codeSql).toMatch(
        new RegExp(
          `REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.${table}\\s+FROM\\s+PUBLIC`,
          'i',
        ),
      )
      expect(codeSql).toMatch(
        new RegExp(
          `REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.${table}\\s+FROM\\s+anon\\s*,\\s*authenticated`,
          'i',
        ),
      )
    }
    expect(codeSql).not.toMatch(/CREATE\s+POLICY/i)
    expect(sql).toMatch(/TRUE LEAST PRIVILEGE = NOT CLAIMED/)
    expect(sql).toMatch(/project_admin \/ BYPASSRLS = PLATFORM LIMITATION/)
  })

  it('contains no seeds, real auth users, business RPC, or sales txn DDL changes', () => {
    expect(codeSql).not.toMatch(/INSERT\s+INTO\s+public\.operational_/i)
    expect(codeSql).not.toMatch(/auth_user_id\s*=\s*'[^']+'/)
    expect(codeSql).not.toMatch(/usr_[A-Za-z0-9]+/)
    expect(codeSql).not.toMatch(/OPS_OWNER_BOOTSTRAP\s*\(/)
    expect(codeSql).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(ops_|operational_).*(_tx|_cmd|_bootstrap)/i,
    )
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[\s\S]{0,80}TO\s+(PUBLIC|anon|authenticated)/i)
    expect(codeSql).not.toMatch(/^\s*BEGIN\s*;/im)
    expect(codeSql).not.toMatch(/^\s*COMMIT\s*;/im)

    for (const table of salesTxnTables) {
      expect(codeSql).not.toMatch(
        new RegExp(`(ALTER|DROP|CREATE)\\s+TABLE\\s+(public\\.)?${table}\\b`, 'i'),
      )
    }
  })
})
