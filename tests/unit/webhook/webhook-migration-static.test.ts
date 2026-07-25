import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'insforge/migrations/0006_webhook_payment_transaction.sql'),
  'utf8',
)

const codeSql = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

describe('0006 webhook migration static guards', () => {
  it('creates only webhook_apply_payment_tx', () => {
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)')
    expect(codeSql).not.toMatch(/CREATE\s+TABLE/i)
    expect(codeSql).not.toMatch(/ALTER\s+TABLE/i)
    expect(codeSql).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql).not.toMatch(/CREATE\s+TRIGGER/i)
    expect(codeSql).not.toMatch(/CREATE\s+EXTENSION/i)
  })

  it('enforces least privilege', () => {
    expect(codeSql).toContain('REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM PUBLIC')
    expect(codeSql).toContain('REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM anon')
    expect(codeSql).toContain('GRANT EXECUTE ON FUNCTION public.webhook_apply_payment_tx(jsonb) TO project_admin')
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+PUBLIC/i)
    expect(codeSql).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+anon/i)
  })

  it('covers required payment outcomes without tickets/QR', () => {
    expect(sql).toContain("'APPROVED'")
    expect(sql).toContain("'PENDING'")
    expect(sql).toContain("'REJECTED'")
    expect(sql).toContain("'CANCELLED'")
    expect(sql).toContain("'REFUNDED'")
    expect(sql).toContain("'CHARGED_BACK'")
    expect(sql).toContain("'REQUIRES_REVIEW'")
    expect(sql).toContain("'CONFLICT'")
    expect(sql).toContain("tickets_emitted', false")
    expect(sql).toContain("qr_created', false")
    expect(sql).toContain("email_sent', false")
    expect(sql).not.toContain('INSERT INTO public.tickets')
    expect(sql).not.toContain('ticket_credential_generations')
  })

  it('uses secure search_path and SECURITY DEFINER', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public, pg_temp')
  })
})
