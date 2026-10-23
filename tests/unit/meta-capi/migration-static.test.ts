// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const sql = read('insforge/migrations/0048_meta-capi-outbox.sql')
const codeOnly = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')

describe('0048 meta capi outbox migration', () => {
  it('allows one row per order, event and delivery mode', () => {
    expect(sql).toMatch(/UNIQUE \(order_id, event_name, delivery_mode\)/)
    expect(sql).toMatch(/delivery_mode text NOT NULL CHECK \(delivery_mode IN \('test', 'live'\)\)/)
  })

  it('is server-only: RLS on and no direct access for anon or authenticated', () => {
    expect(sql).toMatch(/ALTER TABLE public\.meta_capi_outbox ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.meta_capi_outbox FROM anon, authenticated/)
    for (const fn of ['meta_capi_enqueue_tx', 'meta_capi_claim_batch_tx']) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(jsonb\\) FROM authenticated`))
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(jsonb\\) TO project_admin`))
    }
  })

  it('claims with SKIP LOCKED so overlapping runs never take the same row', () => {
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/)
  })

  it('only queues paid, approved, non-zero orders after the since cut-off', () => {
    expect(sql).toMatch(/o\.state = 'PAID'/)
    expect(sql).toMatch(/pay\.normalized_state = 'APPROVED'/)
    expect(sql).toMatch(/o\.total_cents > 0/)
    expect(sql).toMatch(/a\.approved_at >= v_since/)
  })

  it('never creates, replaces or alters payment logic', () => {
    expect(codeOnly).not.toMatch(/webhook_apply_payment_tx/)
    const protectedTables = '(orders|payments|tickets|order_items|buyer_contacts|webhook_events)'
    const writeTargets = new RegExp(
      `\\b(ALTER TABLE|UPDATE|DELETE FROM|INSERT INTO|DROP TABLE|TRUNCATE)\\s+(ONLY\\s+)?public\\.${protectedTables}\\b`,
      'i',
    )
    expect(codeOnly).not.toMatch(writeTargets)
    expect(codeOnly).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.(webhook|checkout|mp_|openpay)/i)
  })

  it('ships a rollback that drops only its own objects', () => {
    const rollback = read('docs/meta-capi/0048-rollback.sql')
    expect(rollback).toMatch(/DROP TABLE IF EXISTS public\.meta_capi_outbox/)
    expect(rollback).not.toMatch(/orders|payments|tickets/)
  })
})
