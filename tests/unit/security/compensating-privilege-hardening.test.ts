import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// OD-040-002-B2 / B2-FIX1 / B2-FIX2 / B5-FIX1 — static contract tests for
// compensating privilege hardening migrations.
//
// 0015 = compensating hardening DCL (29 REVOKEs). Historical local source
//        (pre-B5-FIX1) included runner-incompatible BEGIN;/COMMIT;.
//        B5-FIX1 removed executable TCL only; DCL identity unchanged.
//        Historical privilege defect (UPDATE revoked on products/events)
//        remains corrected by 0016, not by B5-FIX1.
// 0016 = checkout-compatible correction (OD-040-002-B2-FIX1), then
//        runner-compatible TCL removal (OD-040-002-B2-FIX2).
//
// These tests never connect to a database.

const HASH_0015_HISTORICAL =
  'A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B'
const HASH_0015_CANONICAL =
  '0F6484819A0DCA8B00C12FD1729BEFA9B45DEBAA8B3F2A61B96578CF50159E4C'
const HASH_0015_NORMALIZED_DCL =
  '5E98DBC2C0A9E4BC23082D1FA34CDDF794C1251B56934F93CCC3C644E85F949A'
const HASH_0016_CANONICAL =
  'F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A'

const migrationsDir = resolve(process.cwd(), 'insforge/migrations')
const migration15Path = resolve(migrationsDir, '0015_compensating-privilege-hardening.sql')
const migration16Path = resolve(
  migrationsDir,
  '0016_compensating-privilege-hardening-checkout-compatibility.sql',
)
const checkoutMigrationPath = resolve(migrationsDir, '0005_checkout_start_transaction.sql')

const sql15 = readFileSync(migration15Path, 'utf8')
const codeSql15 = sql15
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

const sql16 = readFileSync(migration16Path, 'utf8')
const codeSql16 = sql16
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

const checkoutSql = readFileSync(checkoutMigrationPath, 'utf8')

const DOMAIN_TABLES = [
  'events',
  'event_days',
  'products',
  'buyer_contacts',
  'participants',
  'participant_sensitive_profiles',
  'registrations',
  'teams',
  'team_members',
  'capability_credentials',
  'waiver_documents',
  'waiver_acceptances',
  'orders',
  'order_items',
  'capacity_holds',
  'payments',
  'payment_verification_records',
  'webhook_events',
  'idempotency_records',
  'tickets',
  'ticket_credential_generations',
  'access_entitlements',
  'activity_log',
  'outbox_delivery_jobs',
] as const

const PUBLIC_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']

// Historical R1 shape as written in 0015 (includes UPDATE on events/products).
const PROJECT_ADMIN_R1_HISTORICAL: Record<string, string[]> = {
  events: ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'],
  products: ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'],
  event_days: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'],
  participant_sensitive_profiles: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'],
  activity_log: ['UPDATE'],
}

const GROUP_R2_TABLES = [
  'registrations',
  'teams',
  'team_members',
  'capability_credentials',
  'waiver_documents',
  'waiver_acceptances',
  'orders',
  'order_items',
  'capacity_holds',
  'payments',
  'payment_verification_records',
  'webhook_events',
  'idempotency_records',
  'tickets',
  'ticket_credential_generations',
  'access_entitlements',
  'buyer_contacts',
  'participants',
]

function sha256Upper(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').toUpperCase()
}

/** Executable DCL lines only (comments and top-level TCL stripped). */
function extractExecutableDcl(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((t) => {
      if (!t || t.startsWith('--')) return false
      if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE\s+SAVEPOINT)\s*;?$/i.test(t)) return false
      return true
    })
}

function normalizedDclHash(sql: string): string {
  const norm = extractExecutableDcl(sql)
    .map((t) => t.replace(/;+$/, '').replace(/\s+/g, ' ').toUpperCase())
    .join('\n')
  return createHash('sha256').update(norm).digest('hex').toUpperCase()
}

/**
 * Top-level executable TCL only.
 * PL/pgSQL block `BEGIN` (no semicolon) inside function bodies is not TCL.
 * Runner-rejected forms are `BEGIN;` / `COMMIT;` / `ROLLBACK;` and SAVEPOINT.
 */
function executableTclLines(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .map((l) => l.trim())
    .filter(
      (l) =>
        /^(BEGIN|COMMIT|ROLLBACK)\s*;$/i.test(l) ||
        /^(SAVEPOINT|RELEASE\s+SAVEPOINT)\b/i.test(l),
    )
}

const CHAIN_MIGRATIONS = [
  '0011_logical-capacity-expiry-exclusion.sql',
  '0012_payment-pending-expiry-transaction.sql',
  '0013_payment-pending-expiry-array-fix.sql',
  '0014_payment-pending-expiry-run-lease.sql',
  '0015_compensating-privilege-hardening.sql',
  '0016_compensating-privilege-hardening-checkout-compatibility.sql',
] as const

const EXPECTED_EXECUTABLE_DCL_0015 = [
  ...DOMAIN_TABLES.map(
    (t) =>
      `REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${t} FROM anon, authenticated;`,
  ),
  'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;',
  'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;',
  'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;',
  'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;',
  'REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;',
]

describe('0015 compensating privilege hardening migration static guards (historical artifact)', () => {
  it('P1: 0015 remains the historical hardening file and 0014 remains intact', () => {
    const names = readdirSync(migrationsDir)
    expect(names).toContain('0015_compensating-privilege-hardening.sql')
    expect(names.filter((n) => n.startsWith('0015')).length).toBe(1)
    expect(existsSync(resolve(migrationsDir, '0014_payment-pending-expiry-run-lease.sql'))).toBe(true)
  })

  it('P2: covers exactly the 24 B1-approved tables for anon/authenticated, no more, no less', () => {
    expect(DOMAIN_TABLES.length).toBe(24)

    const anonRevokeLines = codeSql15.split('\n').filter((line) => /FROM anon, authenticated/.test(line))
    expect(anonRevokeLines.length).toBe(24)

    for (const line of anonRevokeLines) {
      const match = line.match(/ON TABLE public\.([a-z_]+) FROM anon, authenticated;/)
      expect(match).not.toBeNull()
      expect(DOMAIN_TABLES).toContain(match?.[1] as (typeof DOMAIN_TABLES)[number])
    }

    for (const table of DOMAIN_TABLES) {
      expect(codeSql15).toMatch(new RegExp(`ON TABLE public\\.${table} FROM anon, authenticated;`))
    }
  })

  it('P3: revokes all 7 privileges from anon and authenticated on every one of the 24 tables', () => {
    for (const table of DOMAIN_TABLES) {
      const statement = `REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} FROM anon, authenticated;`
      expect(codeSql15).toContain(statement)
    }
  })

  it('P4: historical 0015 revoked UPDATE on events (runtime-incompatible; corrected by 0016)', () => {
    expect(codeSql15).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;')
    expect(codeSql15).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.events FROM project_admin/)
  })

  it('P5: historical 0015 revoked UPDATE on products (runtime-incompatible; corrected by 0016)', () => {
    expect(codeSql15).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;')
    expect(codeSql15).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.products FROM project_admin/)
  })

  it('P6: event_days revokes exactly the five approved privileges from project_admin', () => {
    expect(codeSql15).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;',
    )
  })

  it('P7: participant_sensitive_profiles revokes exactly the five approved privileges from project_admin', () => {
    expect(codeSql15).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;',
    )
  })

  it('P8: activity_log revokes only UPDATE from project_admin, INSERT/SELECT untouched', () => {
    expect(codeSql15).toContain('REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;')
    expect(codeSql15).not.toMatch(/REVOKE[^;]*\bINSERT\b[^;]*ON TABLE public\.activity_log FROM project_admin/)
    expect(codeSql15).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.activity_log FROM project_admin/)
  })

  it('P9: does not revoke anything from project_admin on any Group R2 table or resource', () => {
    for (const table of GROUP_R2_TABLES) {
      expect(codeSql15).not.toMatch(new RegExp(`REVOKE[^;]*ON TABLE public\\.${table} FROM project_admin`))
    }
    expect(codeSql15).not.toMatch(/ON TABLE public\.outbox_delivery_jobs FROM project_admin/)
    expect(codeSql15).not.toMatch(/EXECUTE[^;]*ticket_issue_after_payment/i)
    expect(codeSql15).not.toMatch(/EXECUTE[^;]*ticket_issue_after_team_eligible/i)
    expect(codeSql15).not.toMatch(/EXECUTE[^;]*team_apply_payment_outcome/i)
    expect(codeSql15).not.toMatch(/\bFUNCTION\b/i)
  })

  it('P10: contains no privilege widening, role, policy, RLS, or DDL statement anywhere executable', () => {
    expect(codeSql15).not.toMatch(/CREATE\s+ROLE/i)
    expect(codeSql15).not.toMatch(/ALTER\s+ROLE/i)
    expect(codeSql15).not.toMatch(/DROP\s+ROLE/i)
    expect(codeSql15).not.toMatch(/OWNER\s+TO/i)
    expect(codeSql15).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql15).not.toMatch(/DROP\s+POLICY/i)
    expect(codeSql15).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i)
    expect(codeSql15).not.toMatch(/CREATE\s+TABLE/i)
    expect(codeSql15).not.toMatch(/ALTER\s+TABLE/i)
    expect(codeSql15).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i)
    expect(codeSql15).not.toMatch(/CREATE\s+TRIGGER/i)
    expect(codeSql15).not.toMatch(/CREATE\s+EXTENSION/i)
    expect(codeSql15).not.toMatch(/\bGRANT\b/i)
  })

  it('P10b: every GRANT statement in the file is a SQL comment line (documented rollback only)', () => {
    const grantLines = sql15.split('\n').filter((line) => /\bGRANT\b/i.test(line))
    expect(grantLines.length).toBeGreaterThan(0)
    for (const line of grantLines) {
      expect(line.trimStart().startsWith('--')).toBe(true)
    }
  })

  it('P11: every executable REVOKE has an exact, commented GRANT rollback counterpart', () => {
    for (const table of DOMAIN_TABLES) {
      expect(sql15).toContain(
        `-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} TO anon, authenticated;`,
      )
    }
    expect(sql15).toContain('-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events TO project_admin;')
    expect(sql15).toContain('-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products TO project_admin;')
    expect(sql15).toContain(
      '-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days TO project_admin;',
    )
    expect(sql15).toContain(
      '-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles TO project_admin;',
    )
    expect(sql15).toContain('-- GRANT UPDATE ON TABLE public.activity_log TO project_admin;')
  })

  it('P12: drift protection — exact shape of the historical 24-table and R1 revocation sets', () => {
    const anonStatements = codeSql15.match(
      /REVOKE ([A-Z, ]+) ON TABLE public\.([a-z_]+) FROM anon, authenticated;/g,
    )
    expect(anonStatements?.length).toBe(24)
    for (const statement of anonStatements ?? []) {
      for (const priv of PUBLIC_PRIVILEGES) {
        expect(statement).toContain(priv)
      }
    }

    const adminStatements =
      codeSql15.match(/REVOKE ([A-Z, ]+) ON TABLE public\.([a-z_]+) FROM project_admin;/g) ?? []
    expect(adminStatements.length).toBe(Object.keys(PROJECT_ADMIN_R1_HISTORICAL).length)

    for (const statement of adminStatements) {
      const match = statement.match(/REVOKE ([A-Z, ]+) ON TABLE public\.([a-z_]+) FROM project_admin;/)
      const table = match?.[2] as string
      const privileges = match?.[1].split(',').map((p) => p.trim()) ?? []
      expect(Object.keys(PROJECT_ADMIN_R1_HISTORICAL)).toContain(table)
      expect(privileges.sort()).toEqual([...PROJECT_ADMIN_R1_HISTORICAL[table]].sort())
    }

    const touchedAdminTables = adminStatements
      .map((s) => s.match(/ON TABLE public\.([a-z_]+) FROM project_admin;/)?.[1])
      .sort()
    expect(touchedAdminTables).toEqual(Object.keys(PROJECT_ADMIN_R1_HISTORICAL).sort())
  })

  it('P13: uses honest "compensating hardening" terminology, never claims true least privilege', () => {
    expect(sql15).toContain('COMPENSATING LEAST-PRIVILEGE HARDENING')
    expect(sql15).toContain('DOES NOT ACHIEVE TRUE LEAST PRIVILEGE')
    expect(sql15).not.toMatch(/true least privilege (is |has been |was )?achieved/i)
  })

  it('P14: migrations 0012-0014 remain byte-identical to the OD-040-002-B1 baseline', () => {
    expect(sha256Upper(resolve(migrationsDir, '0012_payment-pending-expiry-transaction.sql'))).toBe(
      'E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1',
    )
    expect(sha256Upper(resolve(migrationsDir, '0013_payment-pending-expiry-array-fix.sql'))).toBe(
      'BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A',
    )
    expect(sha256Upper(resolve(migrationsDir, '0014_payment-pending-expiry-run-lease.sql'))).toBe(
      '92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000',
    )
  })

  it('references OD-040-002-B1 as its authority and documents the ownership caveat', () => {
    expect(sql15).toContain('OD-040-002-B1')
    expect(sql15).toContain('OWNERSHIP CAVEAT')
    expect(sql15).toContain('has_table_privilege')
    expect(sql15).toContain('INEFFECTIVE_DUE_TO_OWNERSHIP')
  })
})

describe('0016 checkout-compatible compensating privilege hardening (OD-040-002-B2-FIX1)', () => {
  it('F1: 0015 historical hash is retained as lineage; file is runner-compatible canonical', () => {
    expect(HASH_0015_HISTORICAL).toBe(
      'A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B',
    )
    expect(sha256Upper(migration15Path)).toBe(HASH_0015_CANONICAL)
    expect(sha256Upper(migration15Path)).not.toBe(HASH_0015_HISTORICAL)
  })

  it('F2: 0016 is the next migration number; 0015 remains; no collision', () => {
    const names = readdirSync(migrationsDir)
    expect(names).toContain('0016_compensating-privilege-hardening-checkout-compatibility.sql')
    expect(names).toContain('0015_compensating-privilege-hardening.sql')
    expect(names.filter((n) => n.startsWith('0016')).length).toBe(1)
    expect(names.some((n) => n.startsWith('0017'))).toBe(false)
  })

  it('F3: covers exactly the same 24 B1 tables for anon/authenticated', () => {
    const anonRevokeLines = codeSql16.split('\n').filter((line) => /FROM anon, authenticated/.test(line))
    expect(anonRevokeLines.length).toBe(24)
    for (const table of DOMAIN_TABLES) {
      expect(codeSql16).toMatch(new RegExp(`ON TABLE public\\.${table} FROM anon, authenticated;`))
    }
  })

  it('F4: revokes all 7 privileges from anon and authenticated on every table', () => {
    for (const table of DOMAIN_TABLES) {
      expect(codeSql16).toContain(
        `REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} FROM anon, authenticated;`,
      )
    }
  })

  it('F5: events UPDATE is granted and not revoked in 0016', () => {
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.events TO project_admin;')
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bUPDATE\b[^;]*ON TABLE public\.events FROM project_admin/)
  })

  it('F6: products UPDATE is granted and not revoked in 0016', () => {
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.products TO project_admin;')
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bUPDATE\b[^;]*ON TABLE public\.products FROM project_admin/)
  })

  it('F7: events/products INSERT DELETE TRUNCATE are revoked', () => {
    expect(codeSql16).toContain('REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;')
    expect(codeSql16).toContain('REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;')
  })

  it('F8: does not revoke SELECT of project_admin on events or products', () => {
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.events FROM project_admin/)
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.products FROM project_admin/)
  })

  it('F9: event_days keeps the five-privilege R1 revocation', () => {
    expect(codeSql16).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;',
    )
  })

  it('F10: participant_sensitive_profiles keeps the five-privilege R1 revocation', () => {
    expect(codeSql16).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;',
    )
  })

  it('F11: activity_log UPDATE revoked; INSERT not revoked', () => {
    expect(codeSql16).toContain('REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;')
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bINSERT\b[^;]*ON TABLE public\.activity_log FROM project_admin/)
  })

  it('F12: R2/R3 excluded — no project_admin revoke on other 20 tables / outbox / EXECUTE', () => {
    for (const table of GROUP_R2_TABLES) {
      expect(codeSql16).not.toMatch(new RegExp(`REVOKE[^;]*ON TABLE public\\.${table} FROM project_admin`))
    }
    expect(codeSql16).not.toMatch(/ON TABLE public\.outbox_delivery_jobs FROM project_admin/)
    expect(codeSql16).not.toMatch(/\bFUNCTION\b/i)
    expect(codeSql16).not.toMatch(/EXECUTE/i)
  })

  it('F13: checkout_start_tx uses FOR UPDATE on products/events and 0016 preserves UPDATE', () => {
    expect(checkoutSql).toMatch(
      /SELECT\s+\*\s+INTO\s+v_product[\s\S]*?FROM\s+public\.products[\s\S]*?FOR\s+UPDATE;/i,
    )
    expect(checkoutSql).toMatch(
      /SELECT\s+\*\s+INTO\s+v_event[\s\S]*?FROM\s+public\.events[\s\S]*?FOR\s+UPDATE;/i,
    )
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.events TO project_admin;')
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.products TO project_admin;')
  })

  it('F14: contains no prohibited role/owner/policy/RLS/function changes', () => {
    expect(codeSql16).not.toMatch(/CREATE\s+ROLE/i)
    expect(codeSql16).not.toMatch(/ALTER\s+ROLE/i)
    expect(codeSql16).not.toMatch(/OWNER\s+TO/i)
    expect(codeSql16).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql16).not.toMatch(/DROP\s+POLICY/i)
    expect(codeSql16).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i)
    expect(codeSql16).not.toMatch(/ALTER\s+FUNCTION/i)
    expect(codeSql16).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i)
  })

  it('F15: rollback restores the full pre-B3 baseline (commented only)', () => {
    for (const table of DOMAIN_TABLES) {
      expect(sql16).toContain(
        `-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} TO anon, authenticated;`,
      )
    }
    expect(sql16).toContain('-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events TO project_admin;')
    expect(sql16).toContain('-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products TO project_admin;')
    expect(sql16).toContain(
      '-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days TO project_admin;',
    )
    expect(sql16).toContain(
      '-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles TO project_admin;',
    )
    expect(sql16).toContain('-- GRANT UPDATE ON TABLE public.activity_log TO project_admin;')

    // executable body may GRANT UPDATE only; full baseline GRANT lines are comments
    const executableGrantLines = codeSql16.split('\n').filter((l) => /\bGRANT\b/i.test(l))
    expect(executableGrantLines.every((l) => /GRANT UPDATE ON TABLE public\.(events|products)/.test(l))).toBe(
      true,
    )
  })

  it('F16: uses checkout-compatible compensating terminology; never claims true least privilege', () => {
    expect(sql16).toMatch(/checkout-compatible compensating privilege hardening/i)
    expect(sql16).toContain('DOES NOT ACHIEVE TRUE LEAST PRIVILEGE')
    expect(sql16).not.toMatch(/true least privilege (is |has been |was )?achieved/i)
  })

  it('F17: drift protection — UPDATE preserved; 24 tables; no R2; 0015 DCL identity stable', () => {
    expect(sha256Upper(migration15Path)).toBe(HASH_0015_CANONICAL)
    expect(normalizedDclHash(sql15)).toBe(HASH_0015_NORMALIZED_DCL)
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bUPDATE\b[^;]*ON TABLE public\.events FROM project_admin/)
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bUPDATE\b[^;]*ON TABLE public\.products FROM project_admin/)

    const anonStatements = codeSql16.match(
      /REVOKE ([A-Z, ]+) ON TABLE public\.([a-z_]+) FROM anon, authenticated;/g,
    )
    expect(anonStatements?.length).toBe(24)
    const tables = (anonStatements ?? [])
      .map((s) => s.match(/ON TABLE public\.([a-z_]+)/)?.[1])
      .sort()
    expect(tables).toEqual([...DOMAIN_TABLES].sort())

    for (const table of GROUP_R2_TABLES) {
      expect(codeSql16).not.toMatch(new RegExp(`REVOKE[^;]*ON TABLE public\\.${table} FROM project_admin`))
    }
  })
})

// Exact executable DCL contract preserved from pre-FIX2 0016 (hash
// 8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2).
// FIX2 may only remove BEGIN/COMMIT from the executable body.
const EXPECTED_EXECUTABLE_DCL_0016 = [
  ...DOMAIN_TABLES.map(
    (t) =>
      `REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${t} FROM anon, authenticated;`,
  ),
  'GRANT UPDATE ON TABLE public.events TO project_admin;',
  'REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;',
  'GRANT UPDATE ON TABLE public.products TO project_admin;',
  'REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;',
  'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;',
  'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;',
  'REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;',
]

describe('0016 runner-compatible correction (OD-040-002-B2-FIX2)', () => {
  it('RCF1: 0015 historical lineage retained; canonical file hash is post-B5-FIX1', () => {
    expect(HASH_0015_HISTORICAL).toBe(
      'A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B',
    )
    expect(sha256Upper(migration15Path)).toBe(HASH_0015_CANONICAL)
  })

  it('RCF2: documents that remote migration 16 was absent when FIX2 was authorized to edit 0016', () => {
    // Static evidence of the remote check performed in OD-040-002-B2-FIX2 /
    // B3-RETEST: max remote version was 15, name compensating-privilege-
    // hardening. This unit does not call the remote API from tests.
    expect(sql16).toContain('OD-040-002-B2-FIX2')
    expect(sql16).toContain('Transaction control statements are not allowed')
    expect(existsSync(migration16Path)).toBe(true)
    expect(readdirSync(migrationsDir).some((n) => n.startsWith('0017'))).toBe(false)
  })

  it('RCF3: executable body contains no TCL statements', () => {
    expect(codeSql16).not.toMatch(/\bBEGIN\b/i)
    expect(codeSql16).not.toMatch(/\bCOMMIT\b/i)
    expect(codeSql16).not.toMatch(/\bROLLBACK\b/i)
    expect(codeSql16).not.toMatch(/\bSAVEPOINT\b/i)
    expect(codeSql16).not.toMatch(/\bRELEASE\s+SAVEPOINT\b/i)
  })

  it('RCF4: executable DCL contract is identical to pre-FIX2 (TCL removal only)', () => {
    const executableStatements = codeSql16
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    expect(executableStatements).toEqual(EXPECTED_EXECUTABLE_DCL_0016)
  })

  it('RCF5: deny-all still covers exactly the 24 tables for anon/authenticated', () => {
    expect(EXPECTED_EXECUTABLE_DCL_0016.filter((s) => s.includes('FROM anon, authenticated')).length).toBe(24)
    for (const table of DOMAIN_TABLES) {
      expect(codeSql16).toContain(
        `REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} FROM anon, authenticated;`,
      )
    }
  })

  it('RCF6: events SELECT retained, UPDATE granted, INSERT/DELETE/TRUNCATE revoked', () => {
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.events TO project_admin;')
    expect(codeSql16).toContain('REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;')
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.events FROM project_admin/)
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bUPDATE\b[^;]*ON TABLE public\.events FROM project_admin/)
  })

  it('RCF7: products same contract as events', () => {
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.products TO project_admin;')
    expect(codeSql16).toContain('REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;')
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bSELECT\b[^;]*ON TABLE public\.products FROM project_admin/)
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bUPDATE\b[^;]*ON TABLE public\.products FROM project_admin/)
  })

  it('RCF8: other R1 revocations unchanged', () => {
    expect(codeSql16).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;',
    )
    expect(codeSql16).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;',
    )
    expect(codeSql16).toContain('REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;')
    expect(codeSql16).not.toMatch(/REVOKE[^;]*\bINSERT\b[^;]*ON TABLE public\.activity_log FROM project_admin/)
  })

  it('RCF9: rollback remains complete and commented-only', () => {
    for (const table of DOMAIN_TABLES) {
      expect(sql16).toContain(
        `-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} TO anon, authenticated;`,
      )
    }
    expect(sql16).toContain('-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events TO project_admin;')
    expect(sql16).toContain('-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products TO project_admin;')
    expect(sql16).toContain('-- GRANT UPDATE ON TABLE public.activity_log TO project_admin;')
    const grantLines = sql16.split('\n').filter((l) => /\bGRANT\b/i.test(l) && !/GRANT UPDATE ON TABLE public\.(events|products)/.test(l))
    for (const line of grantLines) {
      expect(line.trimStart().startsWith('--')).toBe(true)
    }
  })

  it('RCF10: no prohibited widening or R2', () => {
    expect(codeSql16).not.toMatch(/CREATE\s+ROLE/i)
    expect(codeSql16).not.toMatch(/ALTER\s+ROLE/i)
    expect(codeSql16).not.toMatch(/OWNER\s+TO/i)
    expect(codeSql16).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql16).not.toMatch(/DROP\s+POLICY/i)
    expect(codeSql16).not.toMatch(/ALTER\s+FUNCTION/i)
    for (const table of GROUP_R2_TABLES) {
      expect(codeSql16).not.toMatch(new RegExp(`REVOKE[^;]*ON TABLE public\\.${table} FROM project_admin`))
    }
  })

  it('RCF11: runner-compatibility guard — TCL must not be reintroduced', () => {
    const tclExecutable = codeSql16
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE\s+SAVEPOINT)\b/i.test(l))
    expect(tclExecutable).toEqual([])
    expect(sql16).toMatch(/does NOT include executable BEGIN\/COMMIT\/ROLLBACK/i)
  })

  it('RCF12: checkout FOR UPDATE dependency and UPDATE grants preserved', () => {
    expect(checkoutSql).toMatch(
      /SELECT\s+\*\s+INTO\s+v_product[\s\S]*?FROM\s+public\.products[\s\S]*?FOR\s+UPDATE;/i,
    )
    expect(checkoutSql).toMatch(
      /SELECT\s+\*\s+INTO\s+v_event[\s\S]*?FROM\s+public\.events[\s\S]*?FOR\s+UPDATE;/i,
    )
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.events TO project_admin;')
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.products TO project_admin;')
  })

  it('RCF13: runner-compatible checkout-compatible terminology; no true least privilege claim', () => {
    expect(sql16).toMatch(/runner-compatible checkout-compatible compensating/i)
    expect(sql16).toContain('DOES NOT ACHIEVE TRUE LEAST PRIVILEGE')
    expect(sql16).not.toMatch(/true least privilege (is |has been |was )?achieved/i)
  })

  it('RCF14: migrations 0012-0014 and 0016 remain byte-identical; 0015 is canonical post-B5-FIX1', () => {
    expect(sha256Upper(resolve(migrationsDir, '0012_payment-pending-expiry-transaction.sql'))).toBe(
      'E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1',
    )
    expect(sha256Upper(resolve(migrationsDir, '0013_payment-pending-expiry-array-fix.sql'))).toBe(
      'BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A',
    )
    expect(sha256Upper(resolve(migrationsDir, '0014_payment-pending-expiry-run-lease.sql'))).toBe(
      '92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000',
    )
    expect(sha256Upper(migration15Path)).toBe(HASH_0015_CANONICAL)
    expect(sha256Upper(migration16Path)).toBe(HASH_0016_CANONICAL)
  })
})

describe('0015 runner-compatible canonicalization and chain reproducibility (OD-040-002-B5-FIX1)', () => {
  it('MCF1: historical 0015 hash is preserved as lineage constant', () => {
    expect(HASH_0015_HISTORICAL).toBe(
      'A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B',
    )
  })

  it('MCF2: canonical 0015 file hash is the post-B5-FIX1 digest', () => {
    expect(sha256Upper(migration15Path)).toBe(HASH_0015_CANONICAL)
    expect(HASH_0015_CANONICAL).not.toBe(HASH_0015_HISTORICAL)
  })

  it('MCF3: 0015 executable body has no TCL', () => {
    expect(executableTclLines(sql15)).toEqual([])
    expect(sql15).toMatch(/No explicit transaction-control statements are included/i)
  })

  it('MCF4/MCF5: DCL count 29 and normalized DCL hash identity', () => {
    const dcl = extractExecutableDcl(sql15)
    expect(dcl.length).toBe(29)
    expect(dcl).toEqual(EXPECTED_EXECUTABLE_DCL_0015)
    expect(normalizedDclHash(sql15)).toBe(HASH_0015_NORMALIZED_DCL)
  })

  it('MCF6: sandbox migration-15 statements align semantically with corrected DCL', () => {
    // B5 read-only list: remote version 15 stored 29 REVOKE statements without
    // BEGIN/COMMIT; trailing semicolons omitted in storage. Normalized form
    // (strip trailing `;`, collapse whitespace, upper-case) matches local DCL.
    const localNorm = extractExecutableDcl(sql15).map((t) =>
      t.replace(/;+$/, '').replace(/\s+/g, ' ').toUpperCase(),
    )
    expect(localNorm.length).toBe(29)
    expect(normalizedDclHash(sql15)).toBe(HASH_0015_NORMALIZED_DCL)
    expect(localNorm[0]).toContain('REVOKE')
    expect(localNorm[0]).toContain('PUBLIC.EVENTS')
    expect(localNorm[28]).toContain('PUBLIC.ACTIVITY_LOG')
    expect(localNorm.every((s) => s.startsWith('REVOKE '))).toBe(true)
  })

  it('MCF7: anon/authenticated deny-all remains complete on 24 tables', () => {
    expect(EXPECTED_EXECUTABLE_DCL_0015.filter((s) => s.includes('FROM anon, authenticated')).length).toBe(
      24,
    )
    for (const table of DOMAIN_TABLES) {
      expect(codeSql15).toContain(
        `REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.${table} FROM anon, authenticated;`,
      )
    }
  })

  it('MCF8: historical project_admin R1 in 0015 still revokes UPDATE on events/products', () => {
    expect(codeSql15).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;')
    expect(codeSql15).toContain(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;',
    )
    for (const [table, privs] of Object.entries(PROJECT_ADMIN_R1_HISTORICAL)) {
      for (const priv of privs) {
        expect(codeSql15).toMatch(
          new RegExp(`REVOKE[^;]*\\b${priv}\\b[^;]*ON TABLE public\\.${table} FROM project_admin`),
        )
      }
    }
  })

  it('MCF9: 0016 still restores UPDATE for checkout compatibility', () => {
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.events TO project_admin;')
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.products TO project_admin;')
    expect(sha256Upper(migration16Path)).toBe(HASH_0016_CANONICAL)
  })

  it('MCF10: R2/R3 not widened in 0015', () => {
    for (const table of GROUP_R2_TABLES) {
      expect(codeSql15).not.toMatch(new RegExp(`REVOKE[^;]*ON TABLE public\\.${table} FROM project_admin`))
    }
    expect(codeSql15).not.toMatch(/ON TABLE public\.outbox_delivery_jobs FROM project_admin/)
    expect(codeSql15).not.toMatch(/\bFUNCTION\b/i)
    expect(codeSql15).not.toMatch(/EXECUTE/i)
  })

  it('MCF11/MCF12: chain 0011–0016 continuous and free of executable TCL', () => {
    const names = readdirSync(migrationsDir)
    for (const file of CHAIN_MIGRATIONS) {
      expect(names).toContain(file)
      const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
      expect(executableTclLines(sql)).toEqual([])
    }
    expect(names.filter((n) => /^001[1-6]_/.test(n)).sort()).toEqual([...CHAIN_MIGRATIONS])
    expect(names.some((n) => n.startsWith('0017'))).toBe(false)
  })

  it('MCF13: historical hash constant is not deleted; canonical supersedes file bytes only', () => {
    expect(HASH_0015_HISTORICAL).toHaveLength(64)
    expect(HASH_0015_CANONICAL).toHaveLength(64)
    expect(HASH_0015_HISTORICAL).not.toBe(HASH_0015_CANONICAL)
  })

  it('MCF14: honest terminology — runner-compatible / compensating; no true-LP or Main claims', () => {
    expect(sql15).toMatch(/runner-compatible|transaction-control statements are included/i)
    expect(sql15).toContain('DOES NOT ACHIEVE TRUE LEAST PRIVILEGE')
    expect(sql15).not.toMatch(/true least privilege (is |has been |was )?achieved/i)
    expect(sql15).not.toMatch(/physically validated on Main/i)
  })

  it('MCF15: protected migrations 0011–0014 and 0016 keep prior hashes', () => {
    expect(sha256Upper(resolve(migrationsDir, '0011_logical-capacity-expiry-exclusion.sql'))).toBe(
      '7C145C0C749CAA7BB27761F03FCC09F727F476C6266148C59B7A51E621F98A22',
    )
    expect(sha256Upper(resolve(migrationsDir, '0012_payment-pending-expiry-transaction.sql'))).toBe(
      'E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1',
    )
    expect(sha256Upper(resolve(migrationsDir, '0013_payment-pending-expiry-array-fix.sql'))).toBe(
      'BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A',
    )
    expect(sha256Upper(resolve(migrationsDir, '0014_payment-pending-expiry-run-lease.sql'))).toBe(
      '92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000',
    )
    expect(sha256Upper(migration16Path)).toBe(HASH_0016_CANONICAL)
  })

  it('MCF16: drift protection — TCL, DCL order/body, UPDATE restore, chain TCL', () => {
    expect(executableTclLines(sql15)).toEqual([])
    expect(extractExecutableDcl(sql15)).toEqual(EXPECTED_EXECUTABLE_DCL_0015)
    expect(normalizedDclHash(sql15)).toBe(HASH_0015_NORMALIZED_DCL)
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.events TO project_admin;')
    expect(codeSql16).toContain('GRANT UPDATE ON TABLE public.products TO project_admin;')
    for (const file of CHAIN_MIGRATIONS) {
      expect(executableTclLines(readFileSync(resolve(migrationsDir, file), 'utf8'))).toEqual([])
    }
  })
})
