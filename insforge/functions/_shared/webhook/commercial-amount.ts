/**
 * SPEC-031/032 — payment amount authority is the order commercial snapshot.
 * Used by webhook verification (TS mirror of SQL order_canonical_* helpers).
 */

export type OrderCommercialAmountAuthority = {
  id: string
  external_reference: string | null
  total_cents: number
  currency: string
  commercial_snapshot: Record<string, unknown> | null
}

export type CanonicalPaymentMatchInput = {
  amountCents: number
  currency: string
  externalReference: string
  order: OrderCommercialAmountAuthority
}

export type CanonicalPaymentMatchResult = {
  amountOk: boolean
  currencyOk: boolean
  externalReferenceOk: boolean
  expectedAmountCents: number
  expectedCurrency: string
  mismatchReason: 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH' | 'REFERENCE_MISMATCH' | null
}

function snapshotTotalCents(snapshot: Record<string, unknown> | null): number | null {
  if (!snapshot) return null
  const raw = snapshot.total_price_cents
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Math.trunc(Number(raw))
  }
  return null
}

function snapshotCurrency(snapshot: Record<string, unknown> | null): string | null {
  if (!snapshot) return null
  const raw = snapshot.currency
  if (typeof raw !== 'string' || !raw.trim()) return null
  return raw.trim().toUpperCase()
}

/** Canonical expected amount: snapshot.total_price_cents, else denormalized total_cents. */
export function orderCanonicalTotalCents(order: OrderCommercialAmountAuthority): number {
  return snapshotTotalCents(order.commercial_snapshot) ?? order.total_cents
}

export function orderCanonicalCurrency(order: OrderCommercialAmountAuthority): string {
  return snapshotCurrency(order.commercial_snapshot) ?? String(order.currency || '').toUpperCase()
}

export function matchPaymentToCommercialSnapshot(
  input: CanonicalPaymentMatchInput,
): CanonicalPaymentMatchResult {
  const expectedAmountCents = orderCanonicalTotalCents(input.order)
  const expectedCurrency = orderCanonicalCurrency(input.order)
  const ref = input.externalReference.trim()
  const externalReferenceOk =
    ref.length > 0 &&
    (ref === input.order.id || ref === (input.order.external_reference ?? '').trim())
  const amountOk = input.amountCents > 0 && input.amountCents === expectedAmountCents
  const currencyOk = input.currency.toUpperCase() === expectedCurrency && expectedCurrency === 'MXN'

  let mismatchReason: CanonicalPaymentMatchResult['mismatchReason'] = null
  if (!externalReferenceOk) mismatchReason = 'REFERENCE_MISMATCH'
  else if (!amountOk) mismatchReason = 'AMOUNT_MISMATCH'
  else if (!currencyOk) mismatchReason = 'CURRENCY_MISMATCH'

  return {
    amountOk,
    currencyOk,
    externalReferenceOk,
    expectedAmountCents,
    expectedCurrency,
    mismatchReason,
  }
}
