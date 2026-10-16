/**
 * Legacy bank reconciliation (carril B). Legacy rows never mix with native
 * orders or payments. Courtesy/staff rows carry amount 0: no bank deposit.
 */

export type LegacyProvider = 'MERCADOPAGO' | 'CLIP' | 'OTHER'

export const LEGACY_PROVIDER_LABEL: Record<LegacyProvider, string> = {
  MERCADOPAGO: 'Mercado Pago',
  CLIP: 'Clip',
  OTHER: 'Otro',
}

export type LegacyReconcileRow = {
  id: string
  /** original_payment_id when the old landing stored one. */
  operationKey: string | null
  /** original_record_id: fallback folio when there is no payment id. */
  recordRef: string
  categoryName: string | null
  paidAt: string | null
  grossCents: number | null
  /** Computed by the backend. Free-text notes never reach the client. */
  courtesyTag: boolean
  reconciliation: {
    provider: LegacyProvider
    bankReference: string | null
    depositedCents: number
    feeCents: number
    reconciledAt: string
    updatedAt: string
  } | null
}

export type SaveLegacyReconciliation = {
  legacyRegistrationId: string
  provider: LegacyProvider
  depositedCents: number
  bankReference?: string | null
}

/** Amount 0 or null: courtesy/staff. Nothing to match against the bank. */
export function isBankReconcilable(row: Pick<LegacyReconcileRow, 'grossCents'>): boolean {
  return (row.grossCents ?? 0) > 0
}

/** Tagged but with money: stays visible, with a warning. */
export function needsTagReview(
  row: Pick<LegacyReconcileRow, 'grossCents' | 'courtesyTag'>,
): boolean {
  return row.courtesyTag && isBankReconcilable(row)
}

/** Blank is invalid. An explicit "0" is a captured zero. */
export function parsePesosToCents(text: string): number | null {
  const clean = text.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}

export function centsToPesosText(cents: number): string {
  return (cents / 100).toFixed(2)
}
