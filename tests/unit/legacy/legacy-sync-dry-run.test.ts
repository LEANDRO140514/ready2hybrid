import { describe, expect, it } from 'vitest'

import { buildDryRunReport, maskEmail, type DryRunContext, type DryRunMirrorRow } from '../../../src/legacy-sync/dry-run'
import { planLegacySync, type SourceRegistration } from '../../../src/legacy-sync/plan'

const CATALOG = new Set(['IND-H', 'HALF-IND-H'])

function mirrorRow(over: Partial<DryRunMirrorRow> & { recordId: string }): DryRunMirrorRow {
  return {
    id: `m-${over.recordId}`,
    commercialStatus: 'LEGACY_PENDING',
    paymentId: null,
    amountCents: 90000,
    productCode: 'IND-H',
    email: `${over.recordId}@example.com`,
    missing: false,
    ...over,
  }
}

function source(over: Partial<SourceRegistration> & { id: string }): SourceRegistration {
  return {
    category_code: 'IND-H',
    contact_email: `${over.id}@example.com`,
    contact_name: 'Test',
    amount: 900,
    status: 'pending',
    ...over,
  }
}

function plan(sourceRows: SourceRegistration[], mirror: DryRunMirrorRow[]) {
  return planLegacySync({
    source: sourceRows,
    mirror: mirror.map((row) => ({
      originalRecordId: row.recordId,
      sourceHash: 'stale',
      missingSince: row.missing ? '2026-10-01' : null,
      commercialStatus: row.commercialStatus,
      importDisposition: 'IMPORTED',
      reviewReason: null,
    })),
    overrides: [],
    catalogCodes: CATALOG,
  })
}

const EMPTY: Omit<DryRunContext, 'mirror'> = { reconciledIds: new Set(), ticketEmails: new Set(), paidOrderEmails: new Set() }

describe('legacy sync dry run report', () => {
  it('masks emails and keeps them out of the output otherwise', () => {
    expect(maskEmail('daniel@hotmail.com')).toBe('da***@hotmail.com')
    const mirror = [mirrorRow({ recordId: 'a' })]
    const report = buildDryRunReport(plan([source({ id: 'a', status: 'cancelled' })], mirror), 1, { ...EMPTY, mirror })
    expect(JSON.stringify(report)).not.toContain('a@example.com')
  })

  it('does not flag a duplicate cancelled while a sibling stays active', () => {
    const mirror = [mirrorRow({ recordId: 'a', email: 'p@example.com' }), mirrorRow({ recordId: 'b', email: 'p@example.com' })]
    const report = buildDryRunReport(
      plan([source({ id: 'a', contact_email: 'p@example.com', status: 'cancelled' }), source({ id: 'b', contact_email: 'p@example.com' })], mirror),
      2,
      { ...EMPTY, mirror },
    )
    expect(report.redRowCount).toBe(0)
    expect(report.transitions['LEGACY_PENDING -> LEGACY_CANCELLED']).toBe(1)
  })

  it('flags a person left with no active row as UNICA', () => {
    const mirror = [mirrorRow({ recordId: 'a', email: 'p@example.com' })]
    const report = buildDryRunReport(plan([source({ id: 'a', contact_email: 'p@example.com', status: 'cancelled' })], mirror), 1, { ...EMPTY, mirror })
    expect(report.flagCounts.UNICA).toBe(1)
    expect(report.redRowCount).toBe(1)
  })

  it('flags a paid row that gets cancelled, a vanished paid row and a payment-id row', () => {
    const mirror = [
      mirrorRow({ recordId: 'a', commercialStatus: 'LEGACY_PAID', paymentId: '123', email: 'p@example.com' }),
      mirrorRow({ recordId: 'b', commercialStatus: 'LEGACY_PAID', paymentId: '456', email: 'q@example.com' }),
    ]
    const report = buildDryRunReport(plan([source({ id: 'a', contact_email: 'p@example.com', status: 'cancelled', mp_payment_id: '123' })], mirror), 1, { ...EMPTY, mirror })
    const byId = Object.fromEntries(report.rows.map((row) => [row.recordId, row.flags]))
    expect(byId.a).toContain('CANCELADA_CON_PAGO')
    expect(byId.a).toContain('PAGADA_CAMBIA_ESTADO')
    expect(byId.b).toContain('CANCELADA_CON_PAGO')
  })

  it('flags reconciled rows and rows whose person has a live ticket', () => {
    const mirror = [mirrorRow({ recordId: 'a', email: 'p@example.com' }), mirrorRow({ recordId: 'b', email: 'q@example.com' })]
    const report = buildDryRunReport(
      plan([source({ id: 'a', contact_email: 'p@example.com', status: 'cancelled' }), source({ id: 'b', contact_email: 'q@example.com', status: 'cancelled' })], mirror),
      2,
      { mirror, reconciledIds: new Set(['m-a']), ticketEmails: new Set(['q@example.com']), paidOrderEmails: new Set(['q@example.com']) },
    )
    const byId = Object.fromEntries(report.rows.map((row) => [row.recordId, row.flags]))
    expect(byId.a).toContain('CONCILIADA')
    expect(byId.b).toContain('CON_BOLETO_QR')
    expect(byId.b).not.toContain('UNICA')
  })

  it('stays quiet when nothing changes', () => {
    const mirror = [mirrorRow({ recordId: 'a' })]
    const report = buildDryRunReport({ actions: [{ kind: 'unchanged', recordId: 'a' }], inserted: 0, updated: 0, unchanged: 1, disappeared: 0, reappeared: 0, conflicts: 0 }, 1, { ...EMPTY, mirror })
    expect(report.rows).toEqual([])
    expect(report.redRowCount).toBe(0)
  })
})
