export type Touch = { fbclid?: string; capturedAt?: string }

export type PurchaseContext = {
  orderId: string
  /** orders.tracking_ref, the value the browser Pixel sends as eventID. */
  trackingRef: string
  totalCents: number
  /** Latest APPROVED payment time. */
  approvedAt: string | null
  productCodes: string[]
  buyerContactId: string
  contact: { email: string | null; phone: string | null; consent: boolean } | null
  touch: Touch | null
}

export type ActionSource = 'system_generated' | 'website' | 'other'

export type BuildOptions = {
  eventSourceUrl: string
  actionSource: ActionSource
  now: Date
}

export type MetaEvent = {
  event_name: 'Purchase'
  event_time: number
  event_id: string
  action_source: ActionSource
  event_source_url: string
  user_data: {
    em?: string[]
    ph?: string[]
    fbc?: string
    external_id: string[]
  }
  custom_data: {
    currency: 'MXN'
    value: number
    content_ids: string[]
    content_type: 'product'
    num_items: number
  }
}

export type BuildResult =
  | { ok: true; event: MetaEvent }
  | { ok: false; reason: 'NO_APPROVAL_TIME' | 'ZERO_VALUE' | 'TOO_OLD' }

/** Meta rejects events with an event_time older than seven days. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = (value ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

/** Mexican numbers as country code + 10 digits, no plus sign. Anything else is dropped. */
export function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return digits
  if (digits.length === 13 && digits.startsWith('521')) return `52${digits.slice(3)}`
  return null
}

export async function hashIdentifier(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Meta click id cookie value: fb.1.<click time in ms>.<fbclid>. */
export function fbcFromTouch(touch: Touch | null | undefined): string | null {
  const fbclid = touch?.fbclid?.trim()
  if (!fbclid || !/^[A-Za-z0-9_-]{1,512}$/.test(fbclid)) return null
  const clickedAt = Date.parse(touch?.capturedAt ?? '')
  if (!Number.isFinite(clickedAt)) return null
  return `fb.1.${clickedAt}.${fbclid}`
}

export async function buildPurchaseEvent(ctx: PurchaseContext, options: BuildOptions): Promise<BuildResult> {
  const approvedMs = Date.parse(ctx.approvedAt ?? '')
  if (!Number.isFinite(approvedMs)) return { ok: false, reason: 'NO_APPROVAL_TIME' }
  if (!(ctx.totalCents > 0)) return { ok: false, reason: 'ZERO_VALUE' }
  const nowMs = options.now.getTime()
  if (nowMs - approvedMs > MAX_EVENT_AGE_MS) return { ok: false, reason: 'TOO_OLD' }

  const user_data: MetaEvent['user_data'] = {
    // Pseudonymous internal id, hashed: keeps the event from being rejected as anonymous.
    external_id: [await hashIdentifier(ctx.buyerContactId)],
  }
  if (ctx.contact?.consent) {
    const email = normalizeEmail(ctx.contact.email)
    const phone = normalizePhone(ctx.contact.phone)
    if (email) user_data.em = [await hashIdentifier(email)]
    if (phone) user_data.ph = [await hashIdentifier(phone)]
  }
  const fbc = fbcFromTouch(ctx.touch)
  if (fbc) user_data.fbc = fbc

  return {
    ok: true,
    event: {
      event_name: 'Purchase',
      event_time: Math.floor(Math.min(approvedMs, nowMs) / 1000),
      event_id: ctx.trackingRef,
      action_source: options.actionSource,
      event_source_url: options.eventSourceUrl,
      user_data,
      custom_data: {
        currency: 'MXN',
        value: ctx.totalCents / 100,
        content_ids: ctx.productCodes,
        content_type: 'product',
        num_items: ctx.productCodes.length || 1,
      },
    },
  }
}
