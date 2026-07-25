import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'insforge/migrations/0008_ticket_issuance_credentials.sql'),
  'utf8',
)

const codeSql = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

describe('0008 ticket issuance migration static guards', () => {
  it('is the next migration number and does not create 0004', () => {
    const names = readdirSync(resolve(process.cwd(), 'insforge/migrations'))
    expect(names).toContain('0008_ticket_issuance_credentials.sql')
    expect(names.some((n) => n.startsWith('0004'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'insforge/migrations/0007_team_roster_invitations.sql'))).toBe(
      true,
    )
  })

  it('does not create tables, policies, triggers, or extensions', () => {
    expect(codeSql).not.toMatch(/CREATE\s+TABLE/i)
    expect(codeSql).not.toMatch(/ALTER\s+TABLE/i)
    expect(codeSql).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql).not.toMatch(/CREATE\s+TRIGGER/i)
    expect(codeSql).not.toMatch(/CREATE\s+EXTENSION/i)
  })

  it('creates issuance / reissue / verify RPCs and replaces TX helpers', () => {
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.ticket_issue_one_registration(p_registration_id uuid)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.ticket_issue_after_payment(p_order_id uuid)')
    expect(codeSql).toContain(
      'CREATE OR REPLACE FUNCTION public.ticket_issue_after_team_eligible(p_team_id uuid)',
    )
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.ticket_credential_reissue_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.ticket_credential_verify_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)')
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.team_roster_accept_tx(p jsonb)')
  })

  it('enforces least privilege on ticket RPCs', () => {
    for (const fn of [
      'ticket_issue_one_registration(uuid)',
      'ticket_issue_after_payment(uuid)',
      'ticket_issue_after_team_eligible(uuid)',
      'ticket_credential_reissue_tx(jsonb)',
      'ticket_credential_verify_tx(jsonb)',
      'ticket_get_projection_tx(jsonb)',
      'webhook_apply_payment_tx(jsonb)',
      'team_roster_accept_tx(jsonb)',
    ]) {
      expect(codeSql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC`)
      expect(codeSql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO project_admin`)
    }
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+PUBLIC/i)
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+anon/i)
  })

  it('uses SECURITY DEFINER and secure search_path', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public, pg_temp')
  })

  it('persists token hash and never stores raw QR token columns', () => {
    expect(sql).toContain('ticket_hash_token')
    expect(sql).toContain("encode(sha256(p_raw::bytea), 'hex')")
    expect(sql).toContain('token_hash')
    expect(sql).toContain("'raw_token_persisted', false")
    const insertCred = codeSql.match(
      /INSERT INTO public\.ticket_credential_generations\s*\(([^)]+)\)/i,
    )
    expect(insertCred?.[1]).toBeTruthy()
    expect(insertCred?.[1]).not.toMatch(/raw_token/i)
    expect(codeSql).not.toMatch(/token_plain|qr_token_plain|raw_qr/i)
  })

  it('uses opaque technical folio namespace without inventing commercial format', () => {
    expect(sql).toContain("'ticket'")
    expect(sql).toContain("ticket_new_opaque_token('tkt_')")
    expect(sql).toContain("ticket_new_opaque_token('qr_')")
  })

  it('fail-closes multi-day products (OD-020)', () => {
    expect(sql).toContain('MULTIDAY_ENTITLEMENT_BLOCKED')
    expect(sql).toContain("'PUB-3D'")
    expect(sql).toContain("'FOT-3D'")
  })

  it('integrates TX-2 and team ELIGIBLE issuance', () => {
    expect(sql).toContain('PERFORM public.ticket_issue_after_payment(v_order.id)')
    expect(sql).toContain('PERFORM public.ticket_issue_after_team_eligible(v_team.id)')
    expect(sql).toContain("v_outcome IN ('PAID', 'ALREADY_PAID')")
    expect(sql).toContain("v_roster_state = 'ELIGIBLE'")
  })

  it('does not implement email delivery, check-in, or used_at mutation', () => {
    expect(sql).toContain("'email_sent', false")
    expect(sql).toContain("'deferred:email'")
    expect(codeSql).not.toMatch(/used_at\s*=/i)
    expect(codeSql).not.toMatch(/Resend|sendgrid|nodemailer/i)
    expect(codeSql).not.toMatch(/first_scan_wins|consume_access/i)
    expect(codeSql).not.toMatch(/UPDATE\s+access_entitlements[\s\S]{0,200}used_at/i)
  })

  it('does not auto-revoke on refund/chargeback (OD-007 deferred)', () => {
    // Corrective payment states remain alerts-only in webhook body; no ticket revoke helper.
    expect(sql).not.toContain('ticket_revoke_on_refund')
    expect(sql).not.toContain('AUTO_REVOKE_REFUND')
  })

  it('leaves prior migrations intact on disk', () => {
    for (const name of [
      '0001_minimal_sales_schema.sql',
      '0002_sales_constraints_and_indexes.sql',
      '0003_rls_and_access_limits.sql',
      '0005_checkout_start_transaction.sql',
      '0006_webhook_payment_transaction.sql',
      '0007_team_roster_invitations.sql',
    ]) {
      expect(existsSync(resolve(process.cwd(), 'insforge/migrations', name))).toBe(true)
    }
  })
})
