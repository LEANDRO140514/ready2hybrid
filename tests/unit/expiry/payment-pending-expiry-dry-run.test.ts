import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * IMPL-14A-3B — dry-run inspection (SPEC-040 R013, AC009, AC017).
 *
 * Split out of payment-pending-expiry.test.ts so the purity contract stays
 * readable: the dry-run has its own classification vocabulary, its own
 * zero-write obligation and the D-1 deferral of PREFERENCE_PENDING holds.
 *
 * The classifier is re-stated here on purpose, mirroring the deliberate
 * duplication inside the SQL: aggregate and dry-run stay separate functions.
 * Effective dry-run body is asserted from 0013 (FIX-2); 0012 remains the
 * historical source that first introduced the three RPCs.
 */
type Classification = 'eligible' | 'noop' | 'inconsistent'

type Row = {
  order_id: string
  order_state: 'PAYMENT_PENDING' | 'PREFERENCE_PENDING' | 'PAID' | 'EXPIRED'
  order_expires_at: string | null
  holds_total: number
  holds_active: number
  holds_converted: number
  hold_expires_at: string | null
  regs_total: number
  regs_provisional: number
  holder_active: number
  holder_expires_at: string | null
  pay_approved: number
  pay_terminal: number
  access_artifacts: number
}

type DeferredHold = {
  hold_id: string
  order_id: string
  order_state: string
  hold_expires_at: string
}

type DryRunReport = {
  mode: 'dry_run'
  applied: false
  counts: {
    eligible: number
    noop: number
    inconsistent: number
    deferred_preference_pending_holds: number
  }
  candidates: { order_id: string; would_be: Classification; findings: string[] }[]
  deferred: (DeferredHold & { classification: string; action: string })[]
  writes: {
    inserts: number
    updates: number
    deletes: number
    merges: number
    rowLocks: number
    activityLog: number
    outbox: number
    tickets: number
    timestampRepairs: number
  }
}

function isExpiredAt(expires_at: string | null, instant: Date): boolean {
  if (expires_at == null) return false
  return Date.parse(expires_at) <= instant.getTime()
}

function classify(row: Row, now: Date): { would_be: Classification; findings: string[] } {
  const findings: string[] = []

  if (row.order_expires_at == null) {
    return { would_be: 'noop', findings: ['NOT_ELIGIBLE_EXPIRY_UNKNOWN'] }
  }

  if (row.pay_approved > 0) findings.push('APPROVED_PAYMENT_ORDER_NOT_PAID')
  if (row.pay_terminal > 0) findings.push('PAYMENT_TERMINAL_MISMATCH')

  if (row.holds_total === 0) findings.push('HOLD_MISSING')
  else if (row.holds_active === 0) findings.push('HOLD_NO_ACTIVE')
  else if (row.holds_active > 1) findings.push('HOLD_MULTIPLE_ACTIVE')

  if (row.holds_active === 1 && row.hold_expires_at == null) findings.push('HOLD_EXPIRY_UNKNOWN')
  else if (row.holds_active === 1 && !isExpiredAt(row.hold_expires_at, now)) {
    findings.push('HOLD_NOT_TIME_EXPIRED')
  }

  if (row.holds_converted > 0 || row.access_artifacts > 0) findings.push('PARTIAL_CONVERSION')

  if (row.regs_total === 0) findings.push('REGISTRATIONS_MISSING')
  else if (row.regs_provisional !== row.regs_total) findings.push('REGISTRATION_NON_PROVISIONAL')

  if (row.holder_active === 0) findings.push('ORDER_HOLDER_MISSING')
  else if (row.holder_active > 1) findings.push('ORDER_HOLDER_MULTIPLE')

  if (
    row.holds_active === 1 &&
    row.holder_active === 1 &&
    (row.hold_expires_at !== row.order_expires_at ||
      row.holder_expires_at !== row.order_expires_at)
  ) {
    findings.push('EXPIRES_AT_DIVERGENCE')
  }

  return { would_be: findings.length > 0 ? 'inconsistent' : 'eligible', findings }
}

/** Mirrors expire_payment_pending_dry_run_tx: reports only, writes nothing. */
function dryRun(
  rows: Row[],
  deferrable: DeferredHold[],
  now: Date,
  requested = 25,
): DryRunReport {
  const limit = Math.min(Math.max(requested, 1), 50)
  const candidates = rows
    .filter((r) => r.order_state === 'PAYMENT_PENDING')
    .filter((r) => r.order_expires_at == null || isExpiredAt(r.order_expires_at, now))
    .sort((a, b) => {
      if (a.order_expires_at == null) return 1
      if (b.order_expires_at == null) return -1
      const byExpiry = Date.parse(a.order_expires_at) - Date.parse(b.order_expires_at)
      return byExpiry !== 0 ? byExpiry : a.order_id.localeCompare(b.order_id)
    })
    .slice(0, limit)
    .map((row) => ({ order_id: row.order_id, ...classify(row, now) }))

  const deferred = deferrable
    .filter((h) => h.order_state === 'PREFERENCE_PENDING')
    .filter((h) => isExpiredAt(h.hold_expires_at, now))
    .slice(0, limit)
    .map((h) => ({
      ...h,
      classification: 'PREFERENCE_PENDING_HOLD_PERSISTENCE',
      action: 'deferred_to_separate_unit',
    }))

  return {
    mode: 'dry_run',
    applied: false,
    counts: {
      eligible: candidates.filter((c) => c.would_be === 'eligible').length,
      noop: candidates.filter((c) => c.would_be === 'noop').length,
      inconsistent: candidates.filter((c) => c.would_be === 'inconsistent').length,
      deferred_preference_pending_holds: deferred.length,
    },
    candidates,
    deferred,
    writes: {
      inserts: 0,
      updates: 0,
      deletes: 0,
      merges: 0,
      rowLocks: 0,
      activityLog: 0,
      outbox: 0,
      tickets: 0,
      timestampRepairs: 0,
    },
  }
}

const EXPIRES = '2026-07-28T12:00:00.000Z'
const NOW = new Date('2026-07-28T12:05:00.000Z')

function row(overrides: Partial<Row> = {}): Row {
  return {
    order_id: 'order-1',
    order_state: 'PAYMENT_PENDING',
    order_expires_at: EXPIRES,
    holds_total: 1,
    holds_active: 1,
    holds_converted: 0,
    hold_expires_at: EXPIRES,
    regs_total: 1,
    regs_provisional: 1,
    holder_active: 1,
    holder_expires_at: EXPIRES,
    pay_approved: 0,
    pay_terminal: 0,
    access_artifacts: 0,
    ...overrides,
  }
}

describe('IMPL-14A-3B dry-run classification (SPEC-040 R013, AC009)', () => {
  it('reports a healthy expired aggregate as eligible without applying anything', () => {
    const report = dryRun([row()], [], NOW)
    expect(report.applied).toBe(false)
    expect(report.mode).toBe('dry_run')
    expect(report.counts).toEqual({
      eligible: 1,
      noop: 0,
      inconsistent: 0,
      deferred_preference_pending_holds: 0,
    })
    expect(report.candidates[0]).toEqual({ order_id: 'order-1', would_be: 'eligible', findings: [] })
  })

  it('reports unknown expiry as noop, never as eligible', () => {
    const report = dryRun([row({ order_expires_at: null })], [], NOW)
    expect(report.candidates[0].would_be).toBe('noop')
    expect(report.candidates[0].findings).toEqual(['NOT_ELIGIBLE_EXPIRY_UNKNOWN'])
    expect(report.counts.eligible).toBe(0)
  })

  it('reports structural divergence as inconsistent with the finding list', () => {
    const report = dryRun(
      [row({ holds_active: 2, holder_active: 0, pay_approved: 1 })],
      [],
      NOW,
    )
    expect(report.candidates[0].would_be).toBe('inconsistent')
    expect(report.candidates[0].findings).toEqual([
      'APPROVED_PAYMENT_ORDER_NOT_PAID',
      'HOLD_MULTIPLE_ACTIVE',
      'ORDER_HOLDER_MISSING',
    ])
  })

  it('ignores orders that are not PAYMENT_PENDING and orders not yet expired', () => {
    const report = dryRun(
      [
        row({ order_id: 'paid', order_state: 'PAID' }),
        row({ order_id: 'pref', order_state: 'PREFERENCE_PENDING' }),
        row({ order_id: 'future', order_expires_at: '2026-07-29T00:00:00.000Z' }),
        row({ order_id: 'due' }),
      ],
      [],
      NOW,
    )
    expect(report.candidates.map((c) => c.order_id)).toEqual(['due'])
  })

  it('matches the aggregate on the closed frontier', () => {
    const atFrontier = dryRun([row()], [], new Date(EXPIRES))
    const beforeFrontier = dryRun([row()], [], new Date(Date.parse(EXPIRES) - 1))
    expect(atFrontier.candidates[0].would_be).toBe('eligible')
    expect(beforeFrontier.candidates).toHaveLength(0)
  })

  it('reports and defers PREFERENCE_PENDING holds instead of repairing them (D-1)', () => {
    const report = dryRun(
      [],
      [
        {
          hold_id: 'hold-pref',
          order_id: 'order-pref',
          order_state: 'PREFERENCE_PENDING',
          hold_expires_at: EXPIRES,
        },
        {
          hold_id: 'hold-live',
          order_id: 'order-live',
          order_state: 'PREFERENCE_PENDING',
          hold_expires_at: '2026-07-29T00:00:00.000Z',
        },
      ],
      NOW,
    )
    expect(report.counts.deferred_preference_pending_holds).toBe(1)
    expect(report.deferred[0]).toEqual({
      hold_id: 'hold-pref',
      order_id: 'order-pref',
      order_state: 'PREFERENCE_PENDING',
      hold_expires_at: EXPIRES,
      classification: 'PREFERENCE_PENDING_HOLD_PERSISTENCE',
      action: 'deferred_to_separate_unit',
    })
    // The deferred hold is reported, not counted as an expiry candidate.
    expect(report.counts.eligible).toBe(0)
    expect(report.candidates).toHaveLength(0)
  })

  it('performs zero writes of any kind, whatever it finds', () => {
    const report = dryRun(
      [row(), row({ order_id: 'bad', holds_total: 0, holds_active: 0 })],
      [
        {
          hold_id: 'hold-pref',
          order_id: 'order-pref',
          order_state: 'PREFERENCE_PENDING',
          hold_expires_at: EXPIRES,
        },
      ],
      NOW,
    )
    expect(report.writes).toEqual({
      inserts: 0,
      updates: 0,
      deletes: 0,
      merges: 0,
      rowLocks: 0,
      activityLog: 0,
      outbox: 0,
      tickets: 0,
      timestampRepairs: 0,
    })
    expect(report.applied).toBe(false)
  })

  it('never mutates the rows it inspects', () => {
    const rows = [row(), row({ order_id: 'bad', holder_active: 0 })]
    const snapshot = structuredClone(rows)
    void dryRun(rows, [], NOW)
    expect(rows).toEqual(snapshot)
  })

  it('honors the same default and hard cap as the batch', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      row({ order_id: `order-${String(i).padStart(3, '0')}` }),
    )
    expect(dryRun(many, [], NOW).candidates).toHaveLength(25)
    expect(dryRun(many, [], NOW, 50).candidates).toHaveLength(50)
    expect(dryRun(many, [], NOW, 500).candidates).toHaveLength(50)
  })
})

const MIG_DIR = resolve(process.cwd(), 'insforge/migrations')
const MIGRATION_0012 = resolve(MIG_DIR, '0012_payment-pending-expiry-transaction.sql')
const MIGRATION_0013 = resolve(MIG_DIR, '0013_payment-pending-expiry-array-fix.sql')

function stripSqlComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

function functionSql(source: string, name: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}(p jsonb)`
  const start = source.indexOf(marker)
  if (start < 0) return ''
  const end = source.indexOf('\n$$;', start)
  return end < 0 ? source.slice(start) : source.slice(start, end)
}

// Normalized so the contract holds under core.autocrlf worktrees too.
const sql0012 = readFileSync(MIGRATION_0012, 'utf8').replace(/\r\n/g, '\n')
const sql0013 = readFileSync(MIGRATION_0013, 'utf8').replace(/\r\n/g, '\n')
const historicalDryRunSql = functionSql(
  stripSqlComments(sql0012),
  'expire_payment_pending_dry_run_tx',
)
const dryRunSql = functionSql(stripSqlComments(sql0013), 'expire_payment_pending_dry_run_tx')

describe('0012 dry-run SQL purity contract (historical)', () => {
  it('introduced a STABLE dry-run with statement_timestamp (FIX-1)', () => {
    expect(historicalDryRunSql).not.toBe('')
    expect(historicalDryRunSql).toMatch(/RETURNS jsonb\nLANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER/)
    expect(historicalDryRunSql.match(/v_now := statement_timestamp\(\);/g)).toHaveLength(1)
    expect(historicalDryRunSql).not.toMatch(/clock_timestamp\(\)/)
  })
})

describe('0013 dry-run SQL purity contract (effective)', () => {
  it('is declared STABLE, which is what makes the purity enforceable', () => {
    expect(dryRunSql).not.toBe('')
    expect(dryRunSql).toMatch(/RETURNS jsonb\nLANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER/)
    // PostgreSQL refuses data modification and row locking in a non-volatile
    // function, so these are engine-enforced and not review-enforced.
    expect(dryRunSql).not.toMatch(/\bINSERT\b/i)
    expect(dryRunSql).not.toMatch(/\bUPDATE\b/i)
    expect(dryRunSql).not.toMatch(/\bDELETE\b/i)
    expect(dryRunSql).not.toMatch(/\bMERGE\b/i)
    expect(dryRunSql).not.toMatch(/FOR\s+UPDATE/i)
    expect(dryRunSql).not.toMatch(/FOR\s+SHARE/i)
    expect(dryRunSql).not.toMatch(/\bTRUNCATE\b/i)
  })

  it('touches neither the audit trail, the outbox nor any access artifact', () => {
    expect(dryRunSql).not.toContain('activity_log')
    expect(dryRunSql).not.toContain('outbox_delivery_jobs')
    expect(dryRunSql).not.toContain('idempotency_records')
    // tickets appear only as a read-only structural probe.
    expect(dryRunSql).toContain('FROM public.tickets t')
    expect(dryRunSql).not.toMatch(/INSERT\s+INTO\s+public\.tickets/i)
  })

  it('cannot be mistaken for an applied reconciliation', () => {
    expect(dryRunSql).toContain("'mode', 'dry_run'")
    expect(dryRunSql).toContain("'applied', false")
    expect(dryRunSql).toContain("'would_be', v_classification")
    expect(dryRunSql).not.toContain("'outcome', 'expired'")
    expect(dryRunSql).not.toContain("'ORDER_EXPIRY_APPLIED'")
  })

  it('reports the four required classifications', () => {
    expect(dryRunSql).toContain("v_classification := 'eligible'")
    expect(dryRunSql).toContain("v_classification := 'noop'")
    expect(dryRunSql).toContain("v_classification := 'inconsistent'")
    expect(dryRunSql).toContain("'classification', 'PREFERENCE_PENDING_HOLD_PERSISTENCE'")
    expect(dryRunSql).toContain("'action', 'deferred_to_separate_unit'")
  })

  it('defers PREFERENCE_PENDING holds without mutating or repairing them (D-1)', () => {
    const deferralBlock = dryRunSql.slice(dryRunSql.indexOf('FOR d IN'))
    expect(deferralBlock).toContain("o.state = 'PREFERENCE_PENDING'")
    expect(deferralBlock).toContain("h.state = 'ACTIVE'")
    expect(deferralBlock).toContain('h.expires_at <= v_now')
    expect(deferralBlock).not.toMatch(/\bUPDATE\b/i)
    expect(deferralBlock).not.toMatch(/FOR\s+UPDATE/i)
  })

  it('uses one statement-stable evaluation instant', () => {
    // STABLE + statement_timestamp(): fixed for the whole SQL statement, so
    // same args → same result within one statement. clock_timestamp() would
    // advance mid-statement and break that half of the STABLE contract.
    expect(dryRunSql).toMatch(/RETURNS jsonb\nLANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER/)
    expect(dryRunSql.match(/v_now := statement_timestamp\(\);/g)).toHaveLength(1)
    expect(dryRunSql.match(/statement_timestamp\(\)/g)).toHaveLength(1)
    expect(dryRunSql).not.toMatch(/clock_timestamp\(\)/)
    expect(dryRunSql).not.toMatch(/transaction_timestamp\(\)/)
    expect(dryRunSql).not.toMatch(/\bnow\(\)/)
    // Every temporal classification gate in this body uses the same v_now.
    expect(dryRunSql).toContain('o.expires_at IS NULL OR o.expires_at <= v_now')
    expect(dryRunSql).toContain('r.hold_expires_at > v_now')
    expect(dryRunSql).toContain('h.expires_at <= v_now')
    expect(dryRunSql).toContain("'evaluated_at', v_now")
    expect(dryRunSql).toContain("LEAST(GREATEST(COALESCE((p->>'limit')::integer, 25), 1), 50)")
    expect(dryRunSql).toContain('LIMIT v_limit')
  })

  it('appends findings with array_append (B-ARRAY fix)', () => {
    expect(dryRunSql).toContain("array_append(v_findings, 'HOLD_MISSING')")
    expect(dryRunSql).not.toMatch(
      /\bv_findings\s*:=\s*v_findings\s*\|\|/,
    )
  })
})
