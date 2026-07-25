import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Policy / SQL-contract tests for IMPL-11 issuance rules.
 * These assert the authorized migration encodes the approved fail-closed matrix
 * without inventing open decisions (OD-001/007/017/019/020/021).
 */
const sql = readFileSync(
  resolve(process.cwd(), 'insforge/migrations/0008_ticket_issuance_credentials.sql'),
  'utf8',
)

describe('ticket issuance SQL policy contracts', () => {
  it('requires PAID order and PAYMENT_CONFIRMED registration', () => {
    expect(sql).toContain("v_order.state IS DISTINCT FROM 'PAID'")
    expect(sql).toContain("v_reg.state IS DISTINCT FROM 'PAYMENT_CONFIRMED'")
    expect(sql).toContain("'ORDER_NOT_PAID'")
    expect(sql).toContain("'REGISTRATION_NOT_ELIGIBLE'")
  })

  it('skips team tickets until ELIGIBLE', () => {
    expect(sql).toContain('v_product.team_size > 1')
    expect(sql).toContain("v_team.roster_state IS DISTINCT FROM 'ELIGIBLE'")
    expect(sql).toContain("'ROSTER_NOT_ELIGIBLE'")
  })

  it('requires individual competitor waiver; workout/spectator/press exempt', () => {
    expect(sql).toContain("v_product.kind = 'competitor' AND v_product.team_size = 1")
    expect(sql).toContain("'WAIVER_REQUIRED'")
  })

  it('creates ISSUED ticket + ACTIVE generation + AVAILABLE entitlement', () => {
    expect(sql).toContain("INSERT INTO public.tickets")
    expect(sql).toContain("'ISSUED'")
    expect(sql).toContain('INSERT INTO public.ticket_credential_generations')
    expect(sql).toContain("'ACTIVE'")
    expect(sql).toContain('INSERT INTO public.access_entitlements')
    expect(sql).toContain("'AVAILABLE'")
  })

  it('idempotency relies on unique registration ticket + exception path', () => {
    expect(sql).toContain('WHERE registration_id = v_reg.id')
    expect(sql).toContain('WHEN unique_violation THEN')
    expect(sql).toContain("'replay', true")
  })

  it('reissue revokes prior ACTIVE and links prior/replacement', () => {
    expect(sql).toContain("SET state = 'REVOKED'")
    expect(sql).toContain('prior_generation_id')
    expect(sql).toContain('replacement_generation_id')
    expect(sql).toContain("'REISSUED'")
  })

  it('outbox ticket.ready excludes raw token', () => {
    expect(sql).toContain("'TICKET_READY'")
    expect(sql).toContain("'credential_generation'")
    const outboxBlock = sql.slice(sql.indexOf("'TICKET_READY'"), sql.indexOf("'TICKET_READY'") + 600)
    expect(outboxBlock).not.toContain('raw_token')
  })

  it('idempotency response_ref strips raw_token on reissue', () => {
    expect(sql).toContain("(v_response - 'raw_token')::text")
  })

  it('zero Mercado Pago references in ticket helpers', () => {
    const helpersEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx')
    const helpers = sql.slice(0, helpersEnd)
    expect(helpers).not.toMatch(/mercadopago|preference|access_token/i)
  })
})
