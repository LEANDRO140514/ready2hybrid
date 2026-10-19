/**
 * Read-only report of what one legacy sync would do, with the red marks the
 * organizer reviews before letting a sync write. It never returns raw PII:
 * emails are masked and only ids, statuses, products and amounts come out.
 */
import type { CommercialStatus, SyncAction, SyncPlan } from './plan.ts'

export type DryRunMirrorRow = {
  id: string
  recordId: string
  commercialStatus: CommercialStatus | null
  paymentId: string | null
  amountCents: number | null
  productCode: string | null
  email: string | null
  missing: boolean
}

export type DryRunContext = {
  mirror: readonly DryRunMirrorRow[]
  /** legacy_registrations.id values that already have a reconciliation. */
  reconciledIds: ReadonlySet<string>
  /** Lower-cased emails with an active ticket in the live system. */
  ticketEmails: ReadonlySet<string>
  /** Lower-cased emails with a PAID order in the live system. */
  paidOrderEmails: ReadonlySet<string>
}

export const RED_FLAGS = [
  'CONFLICTO_OVERRIDE',
  'CANCELADA_CON_PAGO',
  'CONCILIADA',
  'UNICA',
  'CON_BOLETO_QR',
  'PAGADA_CAMBIA_ESTADO',
] as const
export type RedFlag = (typeof RED_FLAGS)[number]
export type AmberFlag = 'MONTO_CAMBIA_PAGADA'

type Side = { status: CommercialStatus | null; product: string | null; amountCents: number | null; hasPaymentId: boolean } | null

export type DryRunRow = {
  recordId: string
  kind: SyncAction['kind']
  flags: (RedFlag | AmberFlag)[]
  before: Side
  after: Side
  email: string | null
}

export type DryRunReport = {
  dryRun: true
  sourceCount: number
  counts: Record<SyncAction['kind'], number>
  transitions: Record<string, number>
  flagCounts: Record<string, number>
  redRowCount: number
  rows: DryRunRow[]
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  if (at < 0) return `${email.slice(0, 2)}***`
  return `${email.slice(0, 2)}***${email.slice(at)}`
}

function isActive(status: CommercialStatus | null, missing: boolean): boolean {
  return !missing && status !== 'LEGACY_CANCELLED'
}

type After = { status: CommercialStatus | null; product: string | null; amountCents: number | null; paymentId: string | null; email: string | null; missing: boolean }

export function buildDryRunReport(plan: SyncPlan, sourceCount: number, ctx: DryRunContext): DryRunReport {
  const beforeById = new Map(ctx.mirror.map((row) => [row.recordId, row]))
  const afterById = new Map<string, After>()
  for (const row of ctx.mirror) {
    afterById.set(row.recordId, {
      status: row.commercialStatus,
      product: row.productCode,
      amountCents: row.amountCents,
      paymentId: row.paymentId,
      email: row.email,
      missing: row.missing,
    })
  }
  for (const action of plan.actions) {
    if (action.kind === 'insert' || action.kind === 'update' || action.kind === 'reappear') {
      afterById.set(action.recordId, {
        status: action.row.commercialStatus,
        product: action.row.normalizedProductCode,
        amountCents: action.row.amountCents,
        paymentId: action.row.originalPaymentId,
        email: action.row.originalEmail,
        missing: false,
      })
    } else if (action.kind === 'disappear') {
      const current = afterById.get(action.recordId)
      if (current) afterById.set(action.recordId, { ...current, missing: true })
    }
  }

  const activeByEmail = new Map<string, number>()
  for (const state of afterById.values()) {
    if (!state.email || !isActive(state.status, state.missing)) continue
    activeByEmail.set(state.email, (activeByEmail.get(state.email) ?? 0) + 1)
  }

  const counts: Record<SyncAction['kind'], number> = { insert: 0, update: 0, reappear: 0, disappear: 0, unchanged: 0, conflict: 0 }
  const transitions: Record<string, number> = {}
  const flagCounts: Record<string, number> = {}
  const rows: DryRunRow[] = []
  let redRowCount = 0

  for (const action of plan.actions) {
    counts[action.kind] += 1
    if (action.kind === 'unchanged') continue
    const before = beforeById.get(action.recordId) ?? null
    const after = action.kind === 'conflict' ? null : (afterById.get(action.recordId) ?? null)
    const flags: (RedFlag | AmberFlag)[] = []

    if (action.kind === 'conflict') flags.push('CONFLICTO_OVERRIDE')
    else {
      const beforeActive = before ? isActive(before.commercialStatus, before.missing) : false
      const removed = after ? !isActive(after.status, after.missing) : false
      const newlyRemoved = removed && (before ? beforeActive : action.kind === 'insert')
      const hadPayment = before?.commercialStatus === 'LEGACY_PAID' || Boolean(before?.paymentId) || Boolean(after?.paymentId)
      const email = before?.email ?? after?.email ?? null
      if (newlyRemoved && hadPayment) flags.push('CANCELADA_CON_PAGO')
      if (before && ctx.reconciledIds.has(before.id) && (newlyRemoved || before.commercialStatus !== after?.status)) flags.push('CONCILIADA')
      if (newlyRemoved && email && (activeByEmail.get(email) ?? 0) === 0 && !ctx.paidOrderEmails.has(email)) flags.push('UNICA')
      if (newlyRemoved && email && ctx.ticketEmails.has(email)) flags.push('CON_BOLETO_QR')
      if (before?.commercialStatus === 'LEGACY_PAID' && after && after.status !== 'LEGACY_PAID') flags.push('PAGADA_CAMBIA_ESTADO')
      if (before?.commercialStatus === 'LEGACY_PAID' && after && after.status === 'LEGACY_PAID' && before.amountCents !== after.amountCents) {
        flags.push('MONTO_CAMBIA_PAGADA')
      }
      if (before && after) {
        const key = `${before.commercialStatus ?? 'NONE'}${before.missing ? '(missing)' : ''} -> ${after.status ?? 'NONE'}${after.missing ? '(missing)' : ''}`
        transitions[key] = (transitions[key] ?? 0) + 1
      }
    }

    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1
    const red = flags.some((flag) => (RED_FLAGS as readonly string[]).includes(flag))
    if (red) redRowCount += 1
    if (red || flags.length > 0 || action.kind !== 'update') {
      rows.push({
        recordId: action.recordId,
        kind: action.kind,
        flags,
        before: before ? { status: before.commercialStatus, product: before.productCode, amountCents: before.amountCents, hasPaymentId: Boolean(before.paymentId) } : null,
        after: after ? { status: after.status, product: after.product, amountCents: after.amountCents, hasPaymentId: Boolean(after.paymentId) } : null,
        email: maskEmail(before?.email ?? after?.email ?? null),
      })
    }
  }

  return { dryRun: true, sourceCount, counts, transitions, flagCounts, redRowCount, rows }
}
