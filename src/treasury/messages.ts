import { formatSpanishDate, type TreasuryBooks } from './books'

const TEXT: Record<string, string> = {
  INVALID_REQUEST: 'Revisa cuenta, monto, fecha y concepto.',
  PAYMENT_METHOD_REQUIRED: 'Un movimiento realizado necesita forma de pago.',
  CANCEL_REASON_REQUIRED: 'Cancelar pide un motivo.',
  CATEGORY_KIND: 'La categoría no corresponde al tipo de movimiento.',
  OPENING_FROZEN: 'El saldo inicial queda fijo cuando la cuenta ya tiene movimientos.',
  NOT_FOUND: 'Ese registro ya no está.',
  TERMINAL: 'Un movimiento cancelado no se reabre.',
  TYPE_IMMUTABLE: 'El tipo de movimiento no se cambia.',
  POSTED_ONLY_CANCELS: 'Un movimiento realizado solo puede cancelarse.',
  POSTED_NOT_EDITABLE: 'Para corregir un realizado, cancélalo y captura uno nuevo.',
  REJECTED: 'No se pudo guardar.',
  FORBIDDEN: 'Esta cuenta no entra a tesorería.',
  UNAUTHORIZED: 'La sesión no está vigente.',
  NETWORK: 'No hubo conexión con tesorería. Intenta de nuevo.',
}

export function treasuryFailureCode(caught: unknown): string {
  if (!caught || typeof caught !== 'object') return 'NETWORK'
  const record = caught as { statusCode?: unknown; error?: unknown; message?: unknown }
  const status = typeof record.statusCode === 'number' ? record.statusCode : 0
  const code = typeof record.error === 'string' ? record.error : ''
  const message = typeof record.message === 'string' ? record.message : ''
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (code === 'REJECTED' || code === 'DATE_BEFORE_OPENING' || TEXT[code]) return code
  if (TEXT[message]) return message
  if (status === 400) return 'INVALID_REQUEST'
  if (status === 409) return 'REJECTED'
  return 'NETWORK'
}

function openingWritten(books: TreasuryBooks, body: Record<string, unknown> | null): string {
  const occurredOn = typeof body?.occurredOn === 'string' ? body.occurredOn : ''
  const ids = [body?.accountId, body?.destinationAccountId]
  for (const id of ids) {
    if (typeof id !== 'string' || !id) continue
    const account = books.accounts.find((row) => row.id === id)
    if (account && occurredOn && occurredOn < account.openingDate) {
      return formatSpanishDate(account.openingDate)
    }
  }
  return ''
}

export function explainTreasuryError(
  code: string,
  books: TreasuryBooks,
  attempt: Record<string, unknown> | null,
): string {
  const written = openingWritten(books, attempt)
  if (written && (code === 'DATE_BEFORE_OPENING' || code === 'REJECTED')) {
    return `La fecha es anterior a la apertura de la cuenta (${written}).`
  }
  return TEXT[code] ?? 'No se pudo guardar.'
}
