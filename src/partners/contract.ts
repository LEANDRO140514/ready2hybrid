/**
 * Community Partner codes are affiliates.code.
 * Shape matches checkout normalizeAffiliateCode and the SQL check
 * `^[A-Z0-9]{3,12}$`. Invalid input is rejected; it is not rewritten.
 */

export const PARTNER_CODE_RE = /^[A-Z0-9]{3,12}$/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+\-().\s]{8,32}$/

export const PARTNER_LIMITS = {
  studioName: 120,
  contactName: 120,
  phone: 32,
  email: 160,
} as const

export type PartnerProfile = {
  studioName: string
  contactName: string
  phone: string
  email: string
}

export type CommunityPartner = PartnerProfile & {
  code: string
  active: boolean
  createdAt: string
  locksLaunchPrice: boolean
}

export type PartnerReject = { ok: false; status: number; code: string }

export function suggestPartnerCode(studioName: string): string | null {
  const compact = studioName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.length < 3) return null
  return compact.slice(0, 12)
}

export function normalizePartnerCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  if (!PARTNER_CODE_RE.test(code)) return null
  return code
}

function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > max) return null
  return trimmed
}

function parseProfile(row: Record<string, unknown>): PartnerProfile | null {
  const studioName = requiredText(row.studioName, PARTNER_LIMITS.studioName)
  const contactName = requiredText(row.contactName, PARTNER_LIMITS.contactName)
  const phone = requiredText(row.phone, PARTNER_LIMITS.phone)
  const email = requiredText(row.email, PARTNER_LIMITS.email)
  if (!studioName || !contactName || !phone || !email) return null
  if (!PHONE_RE.test(phone) || !EMAIL_RE.test(email)) return null
  return { studioName, contactName, phone, email }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseCreatePartner(body: unknown):
  | { ok: true; profile: PartnerProfile; code: string }
  | PartnerReject {
  if (!isRecord(body)) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  const profile = parseProfile(body)
  const code = normalizePartnerCode(typeof body.code === 'string' ? body.code : null)
  if (!profile || !code) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  return { ok: true, profile, code }
}

export function parseUpdatePartner(body: unknown):
  | { ok: true; code: string; profile: PartnerProfile }
  | PartnerReject {
  if (!isRecord(body)) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  const code = normalizePartnerCode(typeof body.code === 'string' ? body.code : null)
  if (!code) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  if ('nextCode' in body || body.newCode != null) {
    return { ok: false, status: 400, code: 'CODE_IMMUTABLE' }
  }
  const profile = parseProfile(body)
  if (!profile) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  return { ok: true, code, profile }
}

export function parseSetActive(body: unknown):
  | { ok: true; code: string; active: boolean }
  | PartnerReject {
  if (!isRecord(body)) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  const code = normalizePartnerCode(typeof body.code === 'string' ? body.code : null)
  if (!code || typeof body.active !== 'boolean') {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  return { ok: true, code, active: body.active }
}

/**
 * Same predicate as checkout_start_tx: only an active affiliates row is stored
 * on a new order. Historical orders are not an input to this function.
 */
export function codeAcceptedOnNewCheckout(
  partner: Pick<CommunityPartner, 'code' | 'active'> | null,
  submitted: string | null | undefined,
): string | null {
  const code = normalizePartnerCode(submitted)
  if (!code || !partner || partner.code !== code || partner.active !== true) return null
  return code
}
