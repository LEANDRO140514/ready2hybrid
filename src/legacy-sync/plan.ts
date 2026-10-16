/**
 * Plans one sync from enforma.hybrid_registro_inscripciones into the local
 * legacy mirror. The caller applies the plan in one transaction.
 * Local field overrides are never replaced. A source change under an override
 * is a conflict, and the row is kept.
 */
export const LEGACY_SOURCE_SYSTEM = 'LEGACY_HYBRID_REGISTRO'
export const SOURCE_TABLE = 'public.hybrid_registro_inscripciones'
export const SOURCE_SELECT = `SELECT id::text AS id, category_code, category_name, category_bloque, team_name, participants, contact_name, contact_email, contact_phone, amount, currency, status, created_at, updated_at, mp_payment_id, notes FROM ${SOURCE_TABLE}`
export const SOURCE_PAGE_SIZE = 200

export function sourceCountQuery(): string {
  return `SELECT count(*)::int AS total FROM ${SOURCE_TABLE}`
}

export function sourcePageQuery(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0) throw new Error('SOURCE_PAGE_INVALID')
  return `${SOURCE_SELECT} ORDER BY id LIMIT ${SOURCE_PAGE_SIZE} OFFSET ${offset}`
}

/**
 * Joins pages only when their rows add up to the counted total and every id
 * is present once. A short page, an empty page, or a repeated id is incomplete
 * and must not be planned: the caller marks nothing absent.
 */
export function collectSourcePages(total: number, pages: readonly SourceRegistration[][]): SourceRegistration[] {
  if (!Number.isInteger(total) || total < 0) throw new Error('SOURCE_COUNT_INVALID')
  if (total === 0) {
    if (pages.some((page) => page.length > 0)) throw new Error('SOURCE_INCOMPLETE')
    return []
  }
  const rows: SourceRegistration[] = []
  for (const page of pages) {
    if (page.length === 0) throw new Error('SOURCE_PAGE_EMPTY')
    const remaining = total - rows.length
    if (page.length > SOURCE_PAGE_SIZE || page.length > remaining) throw new Error('SOURCE_INCOMPLETE')
    if (page.length < SOURCE_PAGE_SIZE && page.length !== remaining) throw new Error('SOURCE_INCOMPLETE')
    rows.push(...page)
  }
  if (rows.length !== total) throw new Error('SOURCE_INCOMPLETE')
  const ids = new Set<string>()
  for (const row of rows) {
    const id = row.id?.trim()
    if (!id || ids.has(id)) throw new Error('SOURCE_INCOMPLETE')
    ids.add(id)
  }
  return rows
}

export type CommercialStatus = 'LEGACY_PAID' | 'LEGACY_PENDING' | 'LEGACY_CANCELLED'

export type SourceRegistration = {
  id: string
  category_code?: string | null
  category_name?: string | null
  category_bloque?: string | null
  team_name?: string | null
  participants?: unknown
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  amount?: number | string | null
  currency?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
  mp_payment_id?: string | null
  notes?: string | null
}

export type MirrorRegistration = {
  originalRecordId: string
  sourceHash: string | null
  missingSince: string | null
  commercialStatus: CommercialStatus | null
  importDisposition: string
  reviewReason: string | null
}

export type FieldOverride = {
  originalRecordId: string
  field: 'amount_cents' | 'commercial_status' | 'normalized_product_code' | 'original_payment_id'
  sourceValueAtOverride: string
}

export type PlannedRow = {
  originalStatus: string
  commercialStatus: CommercialStatus | null
  importDisposition: 'IMPORTED' | 'REVIEW_REQUIRED'
  reviewReason: string | null
  originalCreatedAt: string | null
  originalUpdatedAt: string | null
  originalName: string | null
  originalEmail: string | null
  originalPhone: string | null
  categoryCode: string | null
  categoryName: string | null
  categoryBlock: string | null
  teamName: string | null
  participants: string | null
  normalizedProductCode: string | null
  amountCents: number | null
  currency: string | null
  originalPaymentId: string | null
  notes: string | null
  snapshot: SourceRegistration
}

export type SyncAction =
  | { kind: 'insert'; recordId: string; row: PlannedRow; nextHash: string }
  | { kind: 'update'; recordId: string; row: PlannedRow; nextHash: string }
  | { kind: 'reappear'; recordId: string; row: PlannedRow; nextHash: string }
  | { kind: 'disappear'; recordId: string }
  | { kind: 'unchanged'; recordId: string }
  | { kind: 'conflict'; recordId: string; field: string; sourceValue: string }

export type SyncPlan = {
  actions: SyncAction[]
  inserted: number
  updated: number
  unchanged: number
  disappeared: number
  reappeared: number
  conflicts: number
}

const CANCELLED = new Set(['cancelled', 'canceled', 'refunded', 'rejected', 'anulado', 'cancelado'])

export function mapSourceStatus(status: string | null | undefined): CommercialStatus | null {
  const value = status?.trim().toLowerCase() ?? ''
  if (value === 'paid') return 'LEGACY_PAID'
  if (value === 'pending') return 'LEGACY_PENDING'
  if (CANCELLED.has(value)) return 'LEGACY_CANCELLED'
  return null
}

export function amountToCents(amount: number | string | null | undefined): number | null {
  if (amount == null || amount === '') return null
  const value = typeof amount === 'number' ? amount : Number(String(amount).trim())
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

function text(value: unknown): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

function participantsText(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function hashRow(row: PlannedRow): string {
  return JSON.stringify([
    row.originalStatus,
    row.commercialStatus,
    row.originalUpdatedAt,
    row.originalEmail,
    row.categoryCode,
    row.normalizedProductCode,
    row.amountCents,
    row.originalPaymentId,
    row.notes,
    row.originalName,
    row.originalPhone,
    row.teamName,
    row.participants,
  ])
}

export function planSourceRow(
  source: SourceRegistration,
  catalogCodes: ReadonlySet<string>,
): { row: PlannedRow; reasons: string[] } | null {
  const recordId = text(source.id)
  if (!recordId) return null
  const reasons: string[] = []
  const commercialStatus = mapSourceStatus(source.status)
  if (!commercialStatus) reasons.push('UNKNOWN_STATUS')
  const categoryCode = text(source.category_code)
  const mapped = Boolean(categoryCode && catalogCodes.has(categoryCode))
  if (!mapped) reasons.push('UNMAPPED_CATEGORY')
  const amountCents = amountToCents(source.amount)
  if (source.amount != null && source.amount !== '' && amountCents == null) reasons.push('AMOUNT_UNPARSEABLE')
  const row: PlannedRow = {
    originalStatus: text(source.status) ?? '',
    commercialStatus,
    importDisposition: reasons.length ? 'REVIEW_REQUIRED' : 'IMPORTED',
    reviewReason: reasons.length ? reasons.join(',') : null,
    originalCreatedAt: text(source.created_at),
    originalUpdatedAt: text(source.updated_at),
    originalName: text(source.contact_name),
    originalEmail: text(source.contact_email)?.toLowerCase() ?? null,
    originalPhone: text(source.contact_phone),
    categoryCode,
    categoryName: text(source.category_name),
    categoryBlock: text(source.category_bloque),
    teamName: text(source.team_name),
    participants: participantsText(source.participants),
    normalizedProductCode: mapped ? categoryCode : null,
    amountCents,
    currency: text(source.currency),
    originalPaymentId: text(source.mp_payment_id),
    notes: text(source.notes),
    snapshot: source,
  }
  return { row, reasons }
}

function sourceValue(row: PlannedRow, field: FieldOverride['field']): string {
  if (field === 'amount_cents') return row.amountCents == null ? '' : String(row.amountCents)
  if (field === 'commercial_status') return row.commercialStatus ?? ''
  if (field === 'normalized_product_code') return row.normalizedProductCode ?? ''
  return row.originalPaymentId ?? ''
}

export function planLegacySync(input: {
  source: SourceRegistration[]
  mirror: MirrorRegistration[]
  overrides: FieldOverride[]
  catalogCodes: ReadonlySet<string>
}): SyncPlan {
  const mirrorById = new Map(input.mirror.map((row) => [row.originalRecordId, row]))
  const sourceById = new Map<string, SourceRegistration>()
  for (const source of input.source) {
    const recordId = text(source.id)
    if (recordId) sourceById.set(recordId, source)
  }
  const seen = new Set<string>()
  const actions: SyncAction[] = []
  let inserted = 0
  let updated = 0
  let unchanged = 0
  let disappeared = 0
  let reappeared = 0
  let conflicts = 0

  for (const source of sourceById.values()) {
    const planned = planSourceRow(source, input.catalogCodes)
    if (!planned) continue
    const recordId = text(source.id)!
    seen.add(recordId)
    const nextHash = hashRow(planned.row)
    const current = mirrorById.get(recordId)
    for (const override of input.overrides) {
      if (override.originalRecordId !== recordId) continue
      const value = sourceValue(planned.row, override.field)
      if (value !== override.sourceValueAtOverride) {
        actions.push({ kind: 'conflict', recordId, field: override.field, sourceValue: value })
        conflicts += 1
      }
    }
    if (!current) {
      actions.push({ kind: 'insert', recordId, row: planned.row, nextHash })
      inserted += 1
      continue
    }
    const kind = current.missingSince ? 'reappear' : 'update'
    if (!current.missingSince && current.sourceHash === nextHash) {
      actions.push({ kind: 'unchanged', recordId })
      unchanged += 1
      continue
    }
    if (current.reviewReason && planned.row.reviewReason == null && current.reviewReason !== 'UNKNOWN_STATUS' && !current.reviewReason.includes('UNKNOWN_STATUS') && !current.reviewReason.includes('UNMAPPED_CATEGORY')) {
      planned.row.importDisposition = current.importDisposition === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : planned.row.importDisposition
      planned.row.reviewReason = current.reviewReason
    }
    actions.push({ kind, recordId, row: planned.row, nextHash })
    if (kind === 'reappear') reappeared += 1
    else updated += 1
  }

  for (const current of input.mirror) {
    if (seen.has(current.originalRecordId) || current.missingSince) continue
    actions.push({ kind: 'disappear', recordId: current.originalRecordId })
    disappeared += 1
  }

  return { actions, inserted, updated, unchanged, disappeared, reappeared, conflicts }
}
