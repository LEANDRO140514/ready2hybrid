/**
 * Treasury writes. The actor is the verified session user.
 * created_by and updated_by from the request body are ignored.
 */
import type {
  MovementStatus,
  MovementType,
  PaymentMethod,
  TreasuryBooks,
  TreasuryMovement,
} from '../../../../src/treasury/books.ts'

const METHODS = new Set<PaymentMethod>(['transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro'])
const TYPES = new Set<MovementType>(['income', 'expense', 'transfer'])
const STATUSES = new Set<MovementStatus>(['scheduled', 'posted', 'cancelled'])

export type TreasuryIntent =
  | 'snapshot'
  | 'create-account'
  | 'update-account'
  | 'create-category'
  | 'update-category'
  | 'create-movement'
  | 'update-movement'

export function roleMayUseTreasury(role: unknown): role is 'OWNER' | 'FINANCE' {
  return role === 'OWNER' || role === 'FINANCE'
}

export function classifyTreasuryIntent(value: unknown):
  | { ok: true; intent: TreasuryIntent }
  | { ok: false; status: 403; code: 'FORBIDDEN' } {
  if (
    value === 'snapshot' ||
    value === 'create-account' ||
    value === 'update-account' ||
    value === 'create-category' ||
    value === 'update-category' ||
    value === 'create-movement' ||
    value === 'update-movement'
  ) {
    return { ok: true, intent: value }
  }
  return { ok: false, status: 403, code: 'FORBIDDEN' }
}

type Row = Record<string, unknown>

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value
}

function date(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function optional(value: unknown): string | null {
  if (value == null || value === '') return null
  return typeof value === 'string' ? value.trim() : null
}

export type PlannedWrite =
  | { ok: true; table: 'treasury_accounts' | 'treasury_categories' | 'treasury_movements'; op: 'insert' | 'update'; id?: string; row: Row }
  | { ok: false; status: number; code: string }

export function planTreasuryWrite(books: TreasuryBooks, body: unknown, actor: string): PlannedWrite {
  if (!actor.trim()) return { ok: false, status: 401, code: 'UNAUTHORIZED' }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  const input = body as Row
  const classified = classifyTreasuryIntent(input.intent)
  if (!classified.ok || classified.intent === 'snapshot') {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  if (classified.intent === 'create-account') return planAccount(books, input, actor, null)
  if (classified.intent === 'update-account') return planUpdate(books, input, actor, 'account')
  if (classified.intent === 'create-category') return planCategory(input, actor, null)
  if (classified.intent === 'update-category') return planUpdate(books, input, actor, 'category')
  if (classified.intent === 'create-movement') return planMovement(books, input, actor, null)
  return planUpdate(books, input, actor, 'movement')
}

function planUpdate(
  books: TreasuryBooks,
  input: Row,
  actor: string,
  kind: 'account' | 'category' | 'movement',
): PlannedWrite {
  const id = text(input.id)
  const exists = kind === 'account'
    ? books.accounts.some((account) => account.id === id)
    : kind === 'category'
      ? books.categories.some((category) => category.id === id)
      : books.movements.some((movement) => movement.id === id)
  if (!id || !exists) return { ok: false, status: 404, code: 'NOT_FOUND' }
  if (kind === 'account') return planAccount(books, input, actor, id)
  if (kind === 'category') return planCategory(input, actor, id)
  return planMovement(books, input, actor, id)
}

export function updatedRowCount(data: unknown): number {
  return Array.isArray(data) ? data.length : 0
}

function planAccount(books: TreasuryBooks, input: Row, actor: string, id: string | null): PlannedWrite {
  const name = text(input.name)
  const openingDate = date(input.openingDate)
  const openingBalanceCents = cents(input.openingBalanceCents)
  if (!name || name.length > 120 || !openingDate || openingBalanceCents == null) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  if (!id) {
    return {
      ok: true,
      table: 'treasury_accounts',
      op: 'insert',
      row: {
        name,
        opening_balance_cents: openingBalanceCents,
        opening_date: openingDate,
        active: true,
        created_by: actor,
        updated_by: actor,
      },
    }
  }
  const current = books.accounts.find((account) => account.id === id)
  if (!current) return { ok: false, status: 404, code: 'NOT_FOUND' }
  const used = books.movements.some(
    (movement) => movement.accountId === id || movement.destinationAccountId === id,
  )
  if (
    used &&
    (openingBalanceCents !== current.openingBalanceCents || openingDate !== current.openingDate)
  ) {
    return { ok: false, status: 409, code: 'OPENING_FROZEN' }
  }
  return {
    ok: true,
    table: 'treasury_accounts',
    op: 'update',
    id,
    row: {
      name,
      active: input.active !== false,
      opening_balance_cents: openingBalanceCents,
      opening_date: openingDate,
      updated_by: actor,
    },
  }
}

function planCategory(input: Row, actor: string, id: string | null): PlannedWrite {
  const name = text(input.name)
  const kind = input.kind === 'income' || input.kind === 'expense' ? input.kind : null
  if (!name || name.length > 120 || !kind) return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  if (!id) {
    return {
      ok: true,
      table: 'treasury_categories',
      op: 'insert',
      row: { name, kind, active: true, created_by: actor, updated_by: actor },
    }
  }
  return {
    ok: true,
    table: 'treasury_categories',
    op: 'update',
    id,
    row: { name, active: input.active !== false, updated_by: actor },
  }
}

function planMovement(books: TreasuryBooks, input: Row, actor: string, id: string | null): PlannedWrite {
  const type = TYPES.has(input.type as MovementType) ? (input.type as MovementType) : null
  const status = STATUSES.has(input.status as MovementStatus) ? (input.status as MovementStatus) : null
  const amountCents = cents(input.amountCents)
  const occurredOn = date(input.occurredOn)
  const concept = text(input.concept)
  const accountId = text(input.accountId)
  const destinationAccountId = optional(input.destinationAccountId)
  const categoryId = optional(input.categoryId)
  const paymentMethod = optional(input.paymentMethod)
  if (
    !type || !status || amountCents == null || amountCents <= 0 || !occurredOn || !concept ||
    concept.length > 500 || !accountId
  ) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  if (paymentMethod && !METHODS.has(paymentMethod as PaymentMethod)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  if (status === 'posted' && !paymentMethod) return { ok: false, status: 400, code: 'PAYMENT_METHOD_REQUIRED' }
  if (status === 'cancelled' && !text(input.cancelReason)) {
    return { ok: false, status: 400, code: 'CANCEL_REASON_REQUIRED' }
  }
  if (type === 'transfer') {
    if (!destinationAccountId || destinationAccountId === accountId || categoryId) {
      return { ok: false, status: 400, code: 'INVALID_REQUEST' }
    }
  } else if (destinationAccountId || !categoryId) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  const category = categoryId ? books.categories.find((row) => row.id === categoryId) : null
  if (type !== 'transfer' && (!category || category.kind !== type)) {
    return { ok: false, status: 400, code: 'CATEGORY_KIND' }
  }
  const row: Row = {
    type,
    status,
    account_id: accountId,
    destination_account_id: destinationAccountId,
    category_id: categoryId,
    payment_method: paymentMethod,
    amount_cents: amountCents,
    occurred_on: occurredOn,
    concept,
    counterparty: optional(input.counterparty),
    notes: optional(input.notes),
    cancel_reason: status === 'cancelled' ? text(input.cancelReason) : null,
    updated_by: actor,
  }
  if (!id) {
    row.created_by = actor
    return { ok: true, table: 'treasury_movements', op: 'insert', row }
  }
  const current = books.movements.find((movement) => movement.id === id)
  if (!current) return { ok: false, status: 404, code: 'NOT_FOUND' }
  const transition = movementTransition(current, row)
  if (!transition.ok) return transition
  return { ok: true, table: 'treasury_movements', op: 'update', id, row }
}

function movementTransition(current: TreasuryMovement, row: Row): PlannedWrite | { ok: true } {
  if (current.status === 'cancelled') return { ok: false, status: 409, code: 'TERMINAL' }
  if (row.type !== current.type) return { ok: false, status: 409, code: 'TYPE_IMMUTABLE' }
  if (current.status === 'posted') {
    if (row.status !== 'cancelled') return { ok: false, status: 409, code: 'POSTED_ONLY_CANCELS' }
    const same =
      row.account_id === current.accountId &&
      row.destination_account_id === current.destinationAccountId &&
      row.category_id === current.categoryId &&
      row.payment_method === current.paymentMethod &&
      row.amount_cents === current.amountCents &&
      row.occurred_on === current.occurredOn &&
      row.concept === current.concept &&
      row.counterparty === current.counterparty &&
      row.notes === current.notes
    if (!same) return { ok: false, status: 409, code: 'POSTED_NOT_EDITABLE' }
  }
  return { ok: true }
}
