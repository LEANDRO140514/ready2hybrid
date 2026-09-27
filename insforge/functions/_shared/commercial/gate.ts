/**
 * Base comercial carries contact PII. Aggregates do not.
 * OWNER and FINANCE may read commercial totals.
 * Only OWNER may read the contact directory or its export.
 * Valentina's dashboard role is OWNER, so she uses this same grant.
 */
export function roleMayReadCommercialAggregates(role: unknown): role is 'OWNER' | 'FINANCE' {
  return role === 'OWNER' || role === 'FINANCE'
}

export function roleMayReadCommercialDirectory(role: unknown): role is 'OWNER' {
  return role === 'OWNER'
}

export function classifyCommercialRead(view: unknown):
  | { ok: true; view: 'aggregates' | 'rows' | 'directory' }
  | { ok: false; status: 403; code: 'FORBIDDEN' } {
  if (view === 'aggregates' || view === 'rows' || view === 'directory') {
    return { ok: true, view }
  }
  return { ok: false, status: 403, code: 'FORBIDDEN' }
}
