/** Hybrid Event Openpay installments. Openpay remains the card-eligibility authority. */

/** ENFORMA account limit confirmed by Openpay: MXN 150,000 per transaction. */
export const OPENPAY_MAX_CHARGE_CENTS = 15_000_000
export const OPENPAY_MSI_MIN_CENTS = 30_000
export const OPENPAY_ALLOWED_INSTALLMENTS = [1, 3] as const

export type OpenpayInstallments = (typeof OPENPAY_ALLOWED_INSTALLMENTS)[number]

export function openpayInstallmentChoice(
  totalCents: number,
  installments: number,
): { ok: true; installments: OpenpayInstallments } | { ok: false; code: 'MSI_NOT_OFFERED' | 'MSI_BELOW_MINIMUM' } {
  if (!OPENPAY_ALLOWED_INSTALLMENTS.includes(installments as OpenpayInstallments)) {
    return { ok: false, code: 'MSI_NOT_OFFERED' }
  }
  if (installments === 3 && totalCents < OPENPAY_MSI_MIN_CENTS) {
    return { ok: false, code: 'MSI_BELOW_MINIMUM' }
  }
  return { ok: true, installments: installments as OpenpayInstallments }
}

export function openpayChoicesForAmount(totalCents: number): OpenpayInstallments[] {
  if (totalCents >= OPENPAY_MSI_MIN_CENTS) return [1, 3]
  return [1]
}
