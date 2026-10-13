/** Legacy bank reconciliation. Reads legacy rows, writes only legacy_reconciliations. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const LEGACY_RECONCILE_VIEWS = ['list', 'upsert'] as const
export type LegacyReconcileView = (typeof LEGACY_RECONCILE_VIEWS)[number]

export const LEGACY_PROVIDERS = ['MERCADOPAGO', 'CLIP', 'OTHER'] as const
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number]

export function classifyLegacyReconcileRequest(view: unknown):
  | { ok: true; view: LegacyReconcileView }
  | { ok: false; status: 403; code: 'FORBIDDEN' } {
  if (view === 'list' || view === 'upsert') return { ok: true, view }
  return { ok: false, status: 403, code: 'FORBIDDEN' }
}

export function roleMayReconcileLegacy(role: unknown): role is 'OWNER' | 'FINANCE' {
  return role === 'OWNER' || role === 'FINANCE'
}

export type LegacyReconcileInput = {
  legacyRegistrationId: string
  provider: LegacyProvider
  depositedCents: number
  bankReference: string | null
  notes: string | null
}

export function parseLegacyReconcileInput(body: unknown):
  | { ok: true; input: LegacyReconcileInput }
  | { ok: false; status: 400; code: 'INVALID_REQUEST' } {
  const bad = { ok: false, status: 400, code: 'INVALID_REQUEST' } as const
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad
  const row = body as Record<string, unknown>
  const id = row.legacyRegistrationId
  if (typeof id !== 'string' || !UUID_RE.test(id)) return bad
  const provider = LEGACY_PROVIDERS.find((value) => value === row.provider)
  if (!provider) return bad
  const deposited = row.depositedCents
  if (typeof deposited !== 'number' || !Number.isInteger(deposited) || deposited < 0) return bad
  const bankReference = optionalText(row.bankReference, 200)
  const notes = optionalText(row.notes, 2000)
  if (bankReference === undefined || notes === undefined) return bad
  return {
    ok: true,
    input: {
      legacyRegistrationId: id,
      provider,
      depositedCents: deposited,
      bankReference,
      notes,
    },
  }
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value == null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > max) return undefined
  return trimmed.length === 0 ? null : trimmed
}

const COURTESY_TAG = /(^|[^a-z])(cortes[ií]a|staff)([^a-z]|$)/i

/** Computed here so FINANCE never receives free-text notes (they may carry names). */
export function hasCourtesyTag(notes: unknown): boolean {
  return typeof notes === 'string' && COURTESY_TAG.test(notes)
}

/** Mirrors the SQL guard so the client gets a clear code instead of a trigger error. */
export function legacyRowReconcilable(row: {
  commercialStatus: unknown
  amountCents: unknown
}): { ok: true; grossCents: number } | { ok: false; status: 409; code: string } {
  if (row.commercialStatus !== 'LEGACY_PAID') {
    return { ok: false, status: 409, code: 'NOT_LEGACY_PAID' }
  }
  if (
    typeof row.amountCents !== 'number' ||
    !Number.isInteger(row.amountCents) ||
    row.amountCents <= 0
  ) {
    return { ok: false, status: 409, code: 'NO_BANK_AMOUNT' }
  }
  return { ok: true, grossCents: row.amountCents }
}
