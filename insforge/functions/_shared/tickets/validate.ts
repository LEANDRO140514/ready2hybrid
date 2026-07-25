import { TicketCredentialError } from './errors'

/** Opaque QR token: qr_ + 32 lowercase hex (~122 bits entropy via UUID). */
export const QR_TOKEN_PATTERN = /^qr_[0-9a-f]{32}$/

/** Opaque technical folio (OD-019 commercial format remains OPEN). */
export const FOLIO_PATTERN = /^tkt_[0-9a-f]{32}$/

export function parseQrToken(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string' || !QR_TOKEN_PATTERN.test(raw)) {
    throw new TicketCredentialError('INVALID_TOKEN')
  }
  return raw
}

export function parseTicketId(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw)) {
    throw new TicketCredentialError('INVALID_REQUEST')
  }
  return raw
}

export function parseReissueRequest(body: unknown): {
  ticketId: string
  idempotencyKey: string
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TicketCredentialError('INVALID_REQUEST')
  }
  const record = body as Record<string, unknown>
  const allowed = new Set(['ticket_id', 'idempotency_key', 'action'])
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TicketCredentialError('INVALID_REQUEST')
  }
  if (record.action !== undefined && record.action !== 'reissue') {
    throw new TicketCredentialError('INVALID_REQUEST')
  }
  const ticketId = parseTicketId(record.ticket_id)
  if (typeof record.idempotency_key !== 'string' || record.idempotency_key.length < 8) {
    throw new TicketCredentialError('INVALID_REQUEST')
  }
  return { ticketId, idempotencyKey: record.idempotency_key }
}

/** Reject payloads that look like PII / payment / medical QR content. */
export function assertOpaqueQrPayload(payload: unknown): void {
  if (typeof payload === 'string') {
    parseQrToken(payload.startsWith('qr_') ? payload : null)
    return
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TicketCredentialError('INVALID_TOKEN')
  }
  const record = payload as Record<string, unknown>
  const forbidden = [
    'email',
    'phone',
    'nombre',
    'name',
    'order_id',
    'payment_id',
    'participant_id',
    'medical',
    'emergency',
    'folio',
  ]
  for (const key of Object.keys(record)) {
    if (forbidden.includes(key.toLowerCase())) {
      throw new TicketCredentialError('INVALID_TOKEN')
    }
  }
  if (typeof record.v !== 'number' && typeof record.v !== 'string') {
    throw new TicketCredentialError('INVALID_TOKEN')
  }
  parseQrToken(typeof record.t === 'string' ? record.t : null)
}
