import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'insforge/migrations/0040_remove-stale-team-members.sql'),
  'utf8',
)

describe('0040 remove stale team_members', () => {
  it('targets the two prefixes and is idempotent', () => {
    expect(sql).toContain("LIKE '5a38c5bc%'")
    expect(sql).toContain("LIKE '1f30d06a%'")
    expect(sql).toContain("state = 'REMOVED'")
    expect(sql).toContain("state IS DISTINCT FROM 'REMOVED'")
  })

  it('does not rewrite webhook_apply_payment_tx', () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION/i)
    expect(sql).not.toMatch(/\bDROP\b/)
  })
})
