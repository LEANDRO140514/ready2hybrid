import { planTreasuryWrite } from '../../insforge/functions/_shared/treasury/write'
import type { TreasuryBooks, TreasuryMovement } from './books'

function id(): string {
  return crypto.randomUUID()
}

export function applyTreasuryCommand(
  books: TreasuryBooks,
  body: unknown,
  actor: string,
): { ok: true; books: TreasuryBooks } | { ok: false; code: string } {
  const planned = planTreasuryWrite(books, body, actor)
  if (!planned.ok) return { ok: false, code: planned.code }
  const now = new Date().toISOString()
  if (planned.table === 'treasury_accounts' && planned.op === 'insert') {
    return {
      ok: true,
      books: {
        ...books,
        accounts: [...books.accounts, {
          id: id(),
          name: String(planned.row.name),
          active: true,
          openingBalanceCents: Number(planned.row.opening_balance_cents),
          openingDate: String(planned.row.opening_date),
        }],
      },
    }
  }
  if (planned.table === 'treasury_accounts' && planned.op === 'update') {
    return {
      ok: true,
      books: {
        ...books,
        accounts: books.accounts.map((account) => account.id === planned.id
          ? {
              ...account,
              name: String(planned.row.name),
              active: planned.row.active !== false,
              openingBalanceCents: Number(planned.row.opening_balance_cents),
              openingDate: String(planned.row.opening_date),
            }
          : account),
      },
    }
  }
  if (planned.table === 'treasury_categories' && planned.op === 'insert') {
    return {
      ok: true,
      books: {
        ...books,
        categories: [...books.categories, {
          id: id(),
          name: String(planned.row.name),
          kind: planned.row.kind === 'income' ? 'income' : 'expense',
          active: true,
        }],
      },
    }
  }
  if (planned.table === 'treasury_categories' && planned.op === 'update') {
    return {
      ok: true,
      books: {
        ...books,
        categories: books.categories.map((category) => category.id === planned.id
          ? { ...category, name: String(planned.row.name), active: planned.row.active !== false }
          : category),
      },
    }
  }
  if (planned.op === 'insert') {
    const movement: TreasuryMovement = movementFrom(planned.row, id(), now, now)
    return { ok: true, books: { ...books, movements: [...books.movements, movement] } }
  }
  return {
    ok: true,
    books: {
      ...books,
      movements: books.movements.map((movement) => movement.id === planned.id
        ? movementFrom(planned.row, movement.id, movement.createdAt, now, movement.createdBy)
        : movement),
    },
  }
}

function movementFrom(
  row: Record<string, unknown>,
  movementId: string,
  createdAt: string,
  updatedAt: string,
  createdBy = String(row.created_by ?? ''),
): TreasuryMovement {
  return {
    id: movementId,
    type: row.type as TreasuryMovement['type'],
    status: row.status as TreasuryMovement['status'],
    accountId: String(row.account_id),
    destinationAccountId: row.destination_account_id ? String(row.destination_account_id) : null,
    categoryId: row.category_id ? String(row.category_id) : null,
    paymentMethod: row.payment_method ? row.payment_method as TreasuryMovement['paymentMethod'] : null,
    amountCents: Number(row.amount_cents),
    occurredOn: String(row.occurred_on),
    concept: String(row.concept),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    notes: row.notes ? String(row.notes) : null,
    cancelReason: row.cancel_reason ? String(row.cancel_reason) : null,
    createdBy,
    createdAt,
    updatedBy: String(row.updated_by),
    updatedAt,
  }
}
