/**
 * whoami and snapshot are reads.
 * upsert-adjustment writes only payment_finance_adjustments.
 * Any other intent is forbidden.
 */
export const SALES_READ_VIEWS = ['whoami', 'snapshot', 'upsert-adjustment'] as const

export type SalesReadView = (typeof SALES_READ_VIEWS)[number]

export function classifySalesReadRequest(view: unknown):
  | { ok: true; view: SalesReadView }
  | { ok: false; status: 403; code: 'FORBIDDEN' } {
  if (view === 'whoami' || view === 'snapshot' || view === 'upsert-adjustment') {
    return { ok: true, view }
  }
  return { ok: false, status: 403, code: 'FORBIDDEN' }
}

export function roleMayReadSales(role: unknown): role is 'OWNER' | 'FINANCE' {
  return role === 'OWNER' || role === 'FINANCE'
}
