import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migDir = resolve(process.cwd(), 'insforge/migrations')
const priorSql = readFileSync(resolve(migDir, '0008_ticket_issuance_credentials.sql'), 'utf8')
const fixSql = readFileSync(
  resolve(migDir, '0009_fix_webhook_payment_verification_order.sql'),
  'utf8',
)

function codeOnly(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

function extractFunction(sql: string): string {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)')
  expect(start).toBeGreaterThanOrEqual(0)
  const end = sql.indexOf('COMMENT ON FUNCTION public.webhook_apply_payment_tx(jsonb)')
  expect(end).toBeGreaterThan(start)
  return sql.slice(start, end)
}

function stripComments(sql: string): string {
  return codeOnly(sql)
}

describe('IMPL-12-R3 payment before verification order', () => {
  it('adds forward-only 0009 without creating 0004 or altering prior migrations', () => {
    const names = readdirSync(migDir)
    expect(names).toContain('0009_fix_webhook_payment_verification_order.sql')
    expect(names.some((n) => n.startsWith('0004'))).toBe(false)
    for (const name of [
      '0001_minimal_sales_schema.sql',
      '0002_sales_constraints_and_indexes.sql',
      '0006_webhook_payment_transaction.sql',
      '0007_team_roster_invitations.sql',
      '0008_ticket_issuance_credentials.sql',
    ]) {
      expect(existsSync(resolve(migDir, name))).toBe(true)
    }
  })

  it('reproduces the prior defect ordering in 0008 (verification insert before payment)', () => {
    const fn = stripComments(extractFunction(priorSql))
    const verifIdx = fn.indexOf('INSERT INTO public.payment_verification_records')
    const payIdx = fn.indexOf('INSERT INTO public.payments')
    expect(verifIdx).toBeGreaterThanOrEqual(0)
    expect(payIdx).toBeGreaterThanOrEqual(0)
    expect(verifIdx).toBeLessThan(payIdx)

    const verifCols = fn.slice(verifIdx, payIdx)
    expect(verifCols).not.toMatch(/INSERT INTO public\.payment_verification_records\s*\(\s*payment_id/i)
  })

  it('fixes ordering in 0009: payment upsert precedes verification insert with payment_id', () => {
    const fn = stripComments(extractFunction(fixSql))
    const payIdx = fn.indexOf('INSERT INTO public.payments')
    const verifIdx = fn.indexOf('INSERT INTO public.payment_verification_records')
    expect(payIdx).toBeGreaterThanOrEqual(0)
    expect(verifIdx).toBeGreaterThan(payIdx)

    const insertHead = fn.slice(verifIdx, verifIdx + 280)
    expect(insertHead).toMatch(/INSERT INTO public\.payment_verification_records\s*\(\s*payment_id/i)
    expect(fn).toContain('v_payment.id')
    expect(fn).not.toMatch(
      /UPDATE public\.payment_verification_records\s+SET payment_id = v_payment\.id/i,
    )
  })

  it('does not alter schema and only replaces the RPC', () => {
    const code = codeOnly(fixSql)
    expect(code).toContain('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)')
    expect(code).not.toMatch(/CREATE\s+TABLE/i)
    expect(code).not.toMatch(/ALTER\s+TABLE/i)
    expect(code).not.toMatch(/CREATE\s+POLICY/i)
    expect(code).not.toMatch(/CREATE\s+TRIGGER/i)
    expect(code).not.toMatch(/CREATE\s+EXTENSION/i)
  })

  it('preserves SECURITY DEFINER, search_path, and least privilege', () => {
    expect(fixSql).toContain('SECURITY DEFINER')
    expect(fixSql).toContain('SET search_path = pg_catalog, public, pg_temp')
    expect(fixSql).toContain(
      'REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM PUBLIC',
    )
    expect(fixSql).toContain(
      'REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM anon',
    )
    expect(fixSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.webhook_apply_payment_tx(jsonb) TO project_admin',
    )
    expect(codeOnly(fixSql)).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+PUBLIC/i)
    expect(codeOnly(fixSql)).not.toMatch(/GRANT\s+EXECUTE[^;]*TO\s+anon/i)
  })

  it('preserves idempotent duplicate short-circuit and post-paid ticket issuance', () => {
    const fn = stripComments(extractFunction(fixSql))
    expect(fn).toContain("'outcome', 'DUPLICATE'")
    expect(fn).toContain("v_outcome IN ('PAID', 'ALREADY_PAID')")
    expect(fn).toContain('PERFORM public.ticket_issue_after_payment(v_order.id)')
  })

  it('fail-closes ORDER_NOT_FOUND without inserting null payment_id verification', () => {
    const fn = stripComments(extractFunction(fixSql))
    expect(fn).toContain("'ORDER_NOT_FOUND'")
    expect(fn).toContain('IF NOT v_order_found THEN')
    // First verification insert must be after payment create path; ORDER_NOT_FOUND returns earlier.
    const orderNotFoundReturn = fn.indexOf("'error_detail', 'ORDER_NOT_FOUND'")
    const verifIdx = fn.indexOf('INSERT INTO public.payment_verification_records')
    expect(orderNotFoundReturn).toBeGreaterThanOrEqual(0)
    expect(orderNotFoundReturn).toBeLessThan(verifIdx)
  })
})
