/**
 * Base comercial carries contact PII. Aggregates do not.
 * OWNER and FINANCE may read commercial totals.
 * Only OWNER may read the contact directory or its export.
 * Valentina's dashboard role is OWNER, so she uses this same grant.
 *
 * MARKETING reads one view only: `contacts`, the contact list for retargeting.
 * It carries no provider fees, costs, payment ids, or notes, and it is the
 * only commercial view MARKETING may call.
 */
export function roleMayReadCommercialAggregates(role: unknown): role is 'OWNER' | 'FINANCE' {
  return role === 'OWNER' || role === 'FINANCE'
}

export function roleMayReadCommercialDirectory(role: unknown): role is 'OWNER' {
  return role === 'OWNER'
}

export function roleMayReadMarketingContacts(role: unknown): role is 'OWNER' | 'MARKETING' {
  return role === 'OWNER' || role === 'MARKETING'
}

export function classifyCommercialRead(view: unknown):
  | { ok: true; view: 'aggregates' | 'rows' | 'directory' | 'contacts' }
  | { ok: false; status: 403; code: 'FORBIDDEN' } {
  if (view === 'aggregates' || view === 'rows' || view === 'directory' || view === 'contacts') {
    return { ok: true, view }
  }
  return { ok: false, status: 403, code: 'FORBIDDEN' }
}
