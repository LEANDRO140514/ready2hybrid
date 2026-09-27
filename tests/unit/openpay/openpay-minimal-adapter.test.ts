import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  'insforge/migrations/0037_openpay-minimal-adapter.sql',
  'utf8',
)

describe('0037 openpay minimal adapter', () => {
  it('persists one technical attempt per order and only the two payment modes', () => {
    expect(sql).toContain('CREATE TABLE public.openpay_payment_attempts')
    expect(sql).toContain('UNIQUE (order_id)')
    expect(sql).toContain('UNIQUE (openpay_order_ref)')
    expect(sql).toContain('WHERE openpay_charge_id IS NOT NULL')
    expect(sql).toContain("mode IN ('ONE_TIME', 'THREE_MSI')")
    expect(sql).not.toMatch(/mode IN \([^)]*'SIX/)
  })

  it('keeps sale truth on the existing paid path and locks execution to project_admin', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = pg_catalog, public, pg_temp')
    expect(sql).toContain('FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE public.openpay_payment_attempts FROM anon, authenticated')
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.openpay_apply_verified_charge(jsonb) FROM anon, authenticated',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.openpay_apply_verified_charge(jsonb) TO project_admin',
    )
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('v_order.total_cents')
    expect(sql).toContain("IS DISTINCT FROM 'MXN'")
    expect(sql).toContain("IS DISTINCT FROM 'APPROVED'")
    expect(sql).toContain('PERFORM public.team_apply_payment_outcome')
    expect(sql).toContain('PERFORM public.ticket_issue_after_payment')
    expect(sql).not.toContain('send-ticket-email')
    expect(sql).not.toContain('paid_payment_id')
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx')
    expect(sql).not.toMatch(/EXECUTE\s+(format|\$)/i)
  })

  it('names the conflict and mismatch outcomes without a second sale state', () => {
    for (const code of [
      'ATTEMPT_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'ORDER_AMOUNT_MISMATCH',
      'CURRENCY_MISMATCH',
      'CHARGE_ID_MISMATCH',
      'ORDER_ALREADY_PAID_OTHER_PAYMENT',
      'PROVIDER_CONFLICT',
      'NOT_VERIFIED_APPROVED',
    ]) {
      expect(sql).toContain(code)
    }
    expect(sql).toContain("'PAID'")
    expect(sql).toContain("'ALREADY_PAID'")
    expect(sql).toContain("'OPENPAY'")
  })
})
