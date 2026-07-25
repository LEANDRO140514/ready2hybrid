import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'insforge/migrations/0007_team_roster_invitations.sql'),
  'utf8',
)

const codeSql = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

describe('0007 team roster migration static guards', () => {
  it('does not create tables, policies, triggers, or extensions', () => {
    expect(codeSql).not.toMatch(/CREATE\s+TABLE/i)
    expect(codeSql).not.toMatch(/ALTER\s+TABLE/i)
    expect(codeSql).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql).not.toMatch(/CREATE\s+TRIGGER/i)
    expect(codeSql).not.toMatch(/CREATE\s+EXTENSION/i)
  })

  it('creates roster RPCs and replaces TX helpers', () => {
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.team_roster_get_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.team_roster_accept_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.team_apply_payment_outcome(')
  })

  it('enforces least privilege', () => {
    for (const fn of [
      'team_roster_get_tx(jsonb)',
      'team_roster_accept_tx(jsonb)',
      'team_apply_payment_outcome(uuid, text)',
      'checkout_start_tx(jsonb)',
      'webhook_apply_payment_tx(jsonb)',
    ]) {
      expect(codeSql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC`)
      expect(codeSql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO project_admin`)
    }
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+PUBLIC/i)
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+anon/i)
  })

  it('does not emit tickets, QR, or email', () => {
    expect(sql).not.toContain('INSERT INTO public.tickets')
    expect(sql).not.toContain('ticket_credential_generations')
    expect(sql).toContain("tickets_emitted', false")
    expect(sql).toContain("qr_created', false")
    expect(sql).toContain("email_sent', false")
  })

  it('mints hashed invitation tokens for team_size > 1 only', () => {
    expect(sql).toContain('INVITATION_EXCHANGE_CODE')
    expect(sql).toContain("v_product.team_size > 1")
    expect(sql).toContain("inv_' || replace(gen_random_uuid()::text, '-', '')")
    expect(sql).toContain('encode(sha256(v_invite_raw::bytea), \'hex\')')
  })

  it('uses SECURITY DEFINER and secure search_path', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public, pg_temp')
  })
})
