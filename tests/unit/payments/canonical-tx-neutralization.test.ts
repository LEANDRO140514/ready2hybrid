/**
 * MULTI-PAY-7S / 0021 — blocked from migration discovery (FASE 2).
 *
 * 0021 requires p->>'provider' and would break live mp-webhook (no provider).
 * Bytes preserved under docs/specs/holding/migrations-blocked/.
 * Assertions below affirm: (1) not discoverable; (2) holding SQL still has the
 * intended contract for a future authorized apply after webhook deploy.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migDir = resolve(process.cwd(), 'insforge/migrations')
const holding0021 = resolve(
  process.cwd(),
  'docs/specs/holding/migrations-blocked/0021_multi_provider_canonical_tx_neutralization.sql',
)
const sql0002 = readFileSync(resolve(migDir, '0002_sales_constraints_and_indexes.sql'), 'utf8')
const sql0009 = readFileSync(
  resolve(migDir, '0009_fix_webhook_payment_verification_order.sql'),
  'utf8',
)
const sql0021 = readFileSync(holding0021, 'utf8')

function withoutComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

describe('MULTI-PAY-7S canonical tx neutralization migration (blocked)', () => {
  const code = withoutComments(sql0021)
  const predecessor = withoutComments(sql0009)

  it('0021 is blocked from migration discovery; holding preserves bytes', () => {
    const names = readdirSync(migDir)
    expect(names).not.toContain('0021_multi_provider_canonical_tx_neutralization.sql')
    expect(existsSync(resolve(migDir, '0021_multi_provider_canonical_tx_neutralization.sql'))).toBe(
      false,
    )
    expect(existsSync(holding0021)).toBe(true)
    expect(names).toContain('0009_fix_webhook_payment_verification_order.sql')
    expect(names).toContain('0020_v04-commercial-authority-successor.sql')
    // Live Main predecessor still defaults provider (0021 must not apply yet).
    expect(sql0009).toContain("v_provider text := 'MERCADOPAGO'")
  })

  it('holding 0021 replaces webhook_apply_payment_tx(p jsonb) only — no second provider TX, table, column, or index', () => {
    expect(code).toContain('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)')
    expect(code.match(/CREATE OR REPLACE FUNCTION/g)?.length).toBe(1)
    expect(code).not.toMatch(/clip_apply_payment_tx|openpay_apply_payment_tx/i)
    expect(code).not.toMatch(/CREATE\s+TABLE/i)
    expect(code).not.toMatch(/ALTER\s+TABLE/i)
    expect(code).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX/i)
    expect(code).not.toMatch(/ADD\s+COLUMN/i)
  })

  it('holding 0021 requires explicit contract provider and fails closed on missing/unknown/PAYPAL', () => {
    expect(code).toContain("p->>'provider'")
    expect(code).toContain("'MISSING_PROVIDER'")
    expect(code).toContain("'UNSUPPORTED_PROVIDER'")
    expect(code).not.toMatch(/v_provider\s+text\s+:=\s+'MERCADOPAGO'/)
    expect(code).not.toMatch(/PAYPAL/)
    expect(code).toContain("v_contract_provider = ''")
  })

  it('holding 0021 maps contract ids onto durable payment/webhook provider ids', () => {
    expect(code).toMatch(/v_contract_provider = 'MERCADO_PAGO'[\s\S]*v_provider := 'MERCADOPAGO'/)
    expect(code).toMatch(/v_contract_provider = 'CLIP'[\s\S]*v_provider := 'CLIP'/)
    expect(code).toMatch(/v_contract_provider = 'OPENPAY'[\s\S]*v_provider := 'OPENPAY'/)
  })

  it('holding 0021 uses mapped v_provider for webhook and payment idempotency lookups and writes', () => {
    expect(code).toContain('WHERE provider = v_provider')
    expect(code).toContain('AND provider_notification_id = v_notification_id')
    expect(code).toContain('AND provider_payment_id = v_provider_payment_id')
    expect(code).toMatch(/INSERT INTO public\.webhook_events \([\s\S]*provider,[\s\S]*v_provider/)
    expect(code).toMatch(/INSERT INTO public\.payments \([\s\S]*provider,[\s\S]*v_provider/)
  })

  it('holding 0021 keeps provider-distinct evidence refs and Mercado Pago mp-webhook actor', () => {
    expect(code).toContain("v_evidence_ref := 'mp_payment:'")
    expect(code).toContain("v_evidence_ref := 'clip_payment:'")
    expect(code).toContain("v_evidence_ref := 'openpay_payment:'")
    expect(code).toContain("v_audit_actor := 'mp-webhook'")
    expect(code).toContain("v_audit_actor := 'canonical-payment-tx'")
  })

  it('holding 0021 preserves APPROVED paid/hold/registration/ticket path and does not mark UNKNOWN/REFUNDED/CHARGED_BACK paid', () => {
    expect(code).toContain("IF v_payment_target = 'APPROVED' THEN")
    expect(code).toContain("v_order_target := 'PAID'")
    expect(code).toContain("v_hold_target := 'CONVERTED'")
    expect(code).toContain("v_reg_target := 'PAYMENT_CONFIRMED'")
    expect(code).toContain('PERFORM public.ticket_issue_after_payment(v_order.id)')
    const approvedBlock = code.slice(
      code.indexOf("IF v_payment_target = 'APPROVED' THEN"),
      code.indexOf("ELSIF v_payment_target = 'PENDING' THEN"),
    )
    expect(approvedBlock).toContain("v_order_target := 'PAID'")
    const refundBlock = code.slice(
      code.indexOf("ELSIF v_payment_target IN ('REFUNDED', 'CHARGED_BACK') THEN"),
      code.indexOf('IF v_order_target IS DISTINCT FROM v_order.state THEN'),
    )
    expect(refundBlock).not.toContain("v_order_target := 'PAID'")
    expect(refundBlock).not.toContain('ticket_issue_after_payment')
    expect(code).toMatch(/WHEN 'UNKNOWN' THEN 0/)
    expect(predecessor).toContain('PERFORM public.ticket_issue_after_payment(v_order.id)')
  })

  it('holding 0021 preserves 0009 least-privilege grants', () => {
    expect(code).toContain(
      'REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM PUBLIC',
    )
    expect(code).toContain(
      'REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM anon',
    )
    expect(code).toContain(
      'REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM authenticated',
    )
    expect(code).toContain(
      'GRANT EXECUTE ON FUNCTION public.webhook_apply_payment_tx(jsonb) TO project_admin',
    )
    expect(code).toContain('SECURITY DEFINER')
    expect(code).toContain('SET search_path = pg_catalog, public, pg_temp')
  })

  it('reuses existing provider-scoped unique indexes from 0002', () => {
    expect(sql0002).toContain('CREATE UNIQUE INDEX uq_payments_provider_payment_id')
    expect(sql0002).toContain('ON payments (provider, provider_payment_id)')
    expect(sql0002).toContain('CREATE UNIQUE INDEX uq_webhook_events_provider_notification_id')
    expect(sql0002).toContain('ON webhook_events (provider, provider_notification_id)')
    expect(code).not.toMatch(/CREATE\s+(UNIQUE\s+)?INDEX/i)
  })
})
