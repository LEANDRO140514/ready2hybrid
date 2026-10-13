import { normalizeOpenpayChargeStatus } from './status'

const PAN = /\d{12,19}/g
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const SECRET = /\b(?:sk|pk)_[A-Za-z0-9]+\b/g
const CHARGE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function sanitizeErrorCode(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value
  if (typeof text !== 'string' || !/^[0-9]{1,6}$/.test(text)) return null
  return text
}

/** Provider text only. Drops card numbers, emails, and key material. */
export function sanitizeProviderDetail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value
    .replace(PAN, '')
    .replace(EMAIL, '')
    .replace(SECRET, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
  return cleaned.length > 0 ? cleaned : null
}

export function sanitizeChargeId(value: unknown): string | null {
  if (typeof value !== 'string' || !CHARGE_ID.test(value)) return null
  return value
}

export type OpenpayCreateClassification =
  | {
      outcome: 'charge'
      chargeId: string
      status: string | null
      errorCode: string | null
      description: string | null
    }
  | { outcome: 'business'; errorCode: string; description: string | null }
  | { outcome: 'technical' }

export function classifyOpenpayCreateBody(
  httpStatus: number,
  body: {
    id?: unknown
    status?: unknown
    error_code?: unknown
    description?: unknown
    error_message?: unknown
  },
): OpenpayCreateClassification {
  const chargeId = sanitizeChargeId(body.id)
  const errorCode = sanitizeErrorCode(body.error_code)
  const description = sanitizeProviderDetail(
    typeof body.description === 'string' ? body.description : body.error_message,
  )
  if (chargeId) {
    const status = typeof body.status === 'string' ? body.status.trim() : null
    return {
      outcome: 'charge',
      chargeId,
      status: status && /^[A-Za-z0-9_]{1,64}$/.test(status) ? status : null,
      errorCode,
      description,
    }
  }
  if (httpStatus >= 400 && httpStatus < 500 && errorCode) {
    return { outcome: 'business', errorCode, description }
  }
  return { outcome: 'technical' }
}

/** A failed promotion or card decline is a provider decision, not an outage. */
export function chargeIsBusinessRejection(status: string | null): boolean {
  if (!status) return false
  return normalizeOpenpayChargeStatus(status) === 'REJECTED'
}
