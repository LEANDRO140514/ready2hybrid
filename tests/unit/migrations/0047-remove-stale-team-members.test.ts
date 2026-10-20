import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'insforge/migrations/0047_remove-stale-team-members.sql'),
  'utf8',
)

describe('0047 remove stale team_members', () => {
  it('targets the two prefixes and accepts only 0 or 2 updated rows', () => {
    expect(sql).toContain("LIKE '5a38c5bc%'")
    expect(sql).toContain("LIKE '1f30d06a%'")
    expect(sql).toContain("state = 'REMOVED'")
    expect(sql).toContain("state IS DISTINCT FROM 'REMOVED'")
    expect(sql).toContain('v_matched <> 2')
    expect(sql).toContain('v_updated <> 0 AND v_updated <> 2')
    expect(sql).toContain('RAISE EXCEPTION')
  })

  it('does not rewrite payment apply SQL', () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION/i)
    expect(sql).not.toMatch(/\bDROP\b/)
  })
})
