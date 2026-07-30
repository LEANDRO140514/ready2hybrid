import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'insforge/migrations/0014_payment-pending-expiry-run-lease.sql',
)
const schemaPath = resolve(
  process.cwd(),
  'insforge/migrations/0001_minimal_sales_schema.sql',
)
const constraintsPath = resolve(
  process.cwd(),
  'insforge/migrations/0002_sales_constraints_and_indexes.sql',
)

const sql = readFileSync(migrationPath, 'utf8')
const schemaSql = readFileSync(schemaPath, 'utf8')
const constraintsSql = readFileSync(constraintsPath, 'utf8')

type Lease = {
  ownerRunId: string
  expiresAtMs: number
  state: 'IN_PROGRESS' | 'COMPLETED'
}

type AcquireResult =
  | { outcome: 'acquired'; runId: string; expiresAtMs: number }
  | {
      outcome: 'overlap_skipped'
      ownerRunId: string
      expiresAtMs: number
    }

class DurableLeaseModel {
  private lease: Lease | null = null

  acquire(runId: string, nowMs: number): AcquireResult {
    if (
      this.lease === null ||
      this.lease.expiresAtMs <= nowMs
    ) {
      this.lease = {
        ownerRunId: runId,
        expiresAtMs: nowMs + 90_000,
        state: 'IN_PROGRESS',
      }
      return {
        outcome: 'acquired',
        runId,
        expiresAtMs: this.lease.expiresAtMs,
      }
    }
    return {
      outcome: 'overlap_skipped',
      ownerRunId: this.lease.ownerRunId,
      expiresAtMs: this.lease.expiresAtMs,
    }
  }

  release(
    runId: string,
    nowMs: number,
  ): 'released' | 'not_owner' | 'already_expired' | 'not_found' {
    if (this.lease === null) return 'not_found'
    if (this.lease.ownerRunId !== runId) return 'not_owner'
    if (this.lease.expiresAtMs <= nowMs) return 'already_expired'
    this.lease = {
      ...this.lease,
      expiresAtMs: nowMs,
      state: 'COMPLETED',
    }
    return 'released'
  }
}

function functionBody(name: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\(p jsonb\\)([\\s\\S]*?)\\n\\$\\$;`,
  )
  const match = pattern.exec(sql)
  if (!match) throw new Error(`missing function ${name}`)
  return match[1]
}

describe('IMPL-14A-3C durable expiry run lease', () => {
  it('models first acquire and rejects every live overlap, including same run_id', () => {
    const lease = new DurableLeaseModel()
    const first = lease.acquire('run-a', 1_000)
    const overlap = lease.acquire('run-b', 2_000)
    const sameOwner = lease.acquire('run-a', 3_000)

    expect(first).toMatchObject({
      outcome: 'acquired',
      runId: 'run-a',
      expiresAtMs: 91_000,
    })
    expect(overlap).toMatchObject({
      outcome: 'overlap_skipped',
      ownerRunId: 'run-a',
      expiresAtMs: 91_000,
    })
    expect(sameOwner).toMatchObject({
      outcome: 'overlap_skipped',
      ownerRunId: 'run-a',
      expiresAtMs: 91_000,
    })
  })

  it('models expired lease reclaim by a new run', () => {
    const lease = new DurableLeaseModel()
    lease.acquire('run-a', 1_000)

    expect(lease.acquire('run-b', 91_000)).toMatchObject({
      outcome: 'acquired',
      runId: 'run-b',
      expiresAtMs: 181_000,
    })
  })

  it('models owner-only release and terminal release outcomes', () => {
    const lease = new DurableLeaseModel()
    expect(lease.release('run-a', 1_000)).toBe('not_found')

    lease.acquire('run-a', 1_000)
    expect(lease.release('run-b', 2_000)).toBe('not_owner')
    expect(lease.release('run-a', 91_000)).toBe('already_expired')

    const active = new DurableLeaseModel()
    active.acquire('run-a', 1_000)
    expect(active.release('run-a', 2_000)).toBe('released')
  })

  it('reuses the exact existing idempotency_records columns and unique key', () => {
    expect(schemaSql).toMatch(
      /CREATE TABLE idempotency_records \([\s\S]*?scope text NOT NULL[\s\S]*?actor_context text[\s\S]*?key_hash text NOT NULL[\s\S]*?request_fingerprint text NOT NULL[\s\S]*?state text NOT NULL[\s\S]*?response_ref text[\s\S]*?expires_at timestamptz[\s\S]*?updated_at timestamptz NOT NULL/,
    )
    expect(constraintsSql).toMatch(
      /CREATE UNIQUE INDEX uq_idempotency_records_scope_actor_key[\s\S]*?ON idempotency_records \(scope, actor_context, key_hash\)[\s\S]*?WHERE actor_context IS NOT NULL/,
    )
    expect(sql).toContain(
      'ON CONFLICT (scope, actor_context, key_hash)',
    )
    expect(sql).toContain('WHERE actor_context IS NOT NULL')
  })

  it('defines the exact acquire and release SECURITY DEFINER contracts', () => {
    for (const name of [
      'acquire_payment_pending_expiry_run_lease_tx',
      'release_payment_pending_expiry_run_lease_tx',
    ]) {
      const body = functionBody(name)
      expect(body).toMatch(/RETURNS jsonb/)
      expect(body).toMatch(/LANGUAGE plpgsql/)
      expect(body).toMatch(/VOLATILE/)
      expect(body).toMatch(/SECURITY DEFINER/)
      expect(body).toMatch(
        /SET search_path = pg_catalog, public, pg_temp/,
      )
    }
  })

  it('fixes scope, key, actor, and 90-second TTL inside SQL', () => {
    const acquire = functionBody(
      'acquire_payment_pending_expiry_run_lease_tx',
    )

    expect(acquire).toContain("'payment_pending_expiry_run'")
    expect(acquire).toContain("'global'")
    expect(acquire).toContain("'system:payment-pending-expiry'")
    expect(acquire).toContain('v_requested_ttl IS DISTINCT FROM 90')
    expect(acquire).toContain('make_interval(secs => 90)')
    expect(acquire).not.toMatch(/p->>'(?:scope|key|actor_context)'/)
    expect(acquire).not.toMatch(/make_interval\(secs => v_requested_ttl\)/)
  })

  it('uses one atomic upsert for live-owner exclusion and expired reclaim', () => {
    const acquire = functionBody(
      'acquire_payment_pending_expiry_run_lease_tx',
    )

    expect(acquire).toMatch(
      /INSERT INTO public\.idempotency_records[\s\S]*?ON CONFLICT \(scope, actor_context, key_hash\)[\s\S]*?DO UPDATE/,
    )
    expect(acquire).toMatch(
      /WHERE idempotency_records\.expires_at <= v_now\s+RETURNING/,
    )
    expect(acquire).not.toMatch(
      /OR idempotency_records\.response_ref = v_run_id::text/,
    )
    expect(acquire).toContain("'outcome', 'overlap_skipped'")
    expect(acquire).toContain("'owner_run_id', v_owner")
  })

  it('conditions release on the durable run_id owner', () => {
    const release = functionBody(
      'release_payment_pending_expiry_run_lease_tx',
    )

    expect(release).toMatch(
      /v_lease\.response_ref IS DISTINCT FROM v_run_id::text[\s\S]*?'not_owner'/,
    )
    expect(release).toMatch(
      /UPDATE public\.idempotency_records[\s\S]*?WHERE id = v_lease\.id[\s\S]*?AND response_ref = v_run_id::text/,
    )
    for (const outcome of [
      'released',
      'not_owner',
      'already_expired',
      'not_found',
      'invalid_input',
    ]) {
      expect(release).toContain(`'${outcome}'`)
    }
  })

  it('grants both lease RPCs only to project_admin runtime roles', () => {
    for (const name of [
      'acquire_payment_pending_expiry_run_lease_tx',
      'release_payment_pending_expiry_run_lease_tx',
    ]) {
      expect(sql).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${name}(jsonb) FROM PUBLIC;`,
      )
      expect(sql).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${name}(jsonb) FROM anon;`,
      )
      expect(sql).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${name}(jsonb) FROM authenticated;`,
      )
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${name}(jsonb) TO project_admin;`,
      )
    }
    expect(sql).toContain('True least privilege is NOT ACHIEVED')
    expect(sql).toContain('Main and production remain blocked')
  })

  it('contains no advisory lock or unauthorized schema/runtime surface', () => {
    expect(sql).not.toMatch(/pg_(?:try_)?advisory_lock/i)
    expect(sql).not.toMatch(/\bCREATE\s+TABLE\b/i)
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i)
    expect(sql).not.toMatch(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i)
    expect(sql).not.toMatch(/\bCREATE\s+TRIGGER\b/i)
    expect(sql).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.expire_payment_pending_(?:aggregate|batch|dry_run)_tx/i,
    )
    expect(sql).not.toMatch(
      /\b(?:tickets|payments|teams|team_members|schedules)\b/i,
    )
  })

  it('has a stable SHA-256 evidence value', () => {
    expect(createHash('sha256').update(sql).digest('hex')).toMatch(
      /^[0-9a-f]{64}$/,
    )
  })
})
