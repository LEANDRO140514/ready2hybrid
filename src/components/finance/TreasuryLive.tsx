import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { loadTreasury, saveTreasury } from '../../treasury/port'
import {
  EMPTY_TREASURY_FILTERS,
  movementsToCsv,
  scheduleToCsv,
  treasuryCashCents,
  treasuryFileName,
  weeklyFlowToCsv,
  meridaToday,
  type TreasuryBooks,
  type TreasuryFilters,
} from '../../treasury/books'

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function TreasuryLive() {
  const [books, setBooks] = useState<TreasuryBooks | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TreasuryFilters>(EMPTY_TREASURY_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const today = meridaToday(new Date())

  const reload = useCallback(async () => {
    setBooks(await loadTreasury())
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTreasury()
      .then((next) => {
        if (!cancelled) setBooks(next)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'No se pudo leer tesorería.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await saveTreasury({
        intent: 'create-movement',
        type: form.get('type'),
        status: form.get('status'),
        accountId: form.get('accountId'),
        destinationAccountId: form.get('destinationAccountId') || null,
        categoryId: form.get('categoryId') || null,
        paymentMethod: form.get('paymentMethod') || null,
        amountCents: Math.round(Number(form.get('amount')) * 100),
        occurredOn: form.get('occurredOn'),
        concept: form.get('concept'),
        counterparty: form.get('counterparty') || null,
        notes: form.get('notes') || null,
        cancelReason: form.get('cancelReason') || null,
      })
      setError(null)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'REJECTED')
    }
  }

  if (error && !books) return <p role="alert">{error}</p>
  if (!books) return <p>Cargando tesorería…</p>

  return (
    <div data-testid="treasury-live">
      <h1>Tesorería</h1>
      <p>Caja {(treasuryCashCents(books) / 100).toFixed(2)}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="chip-row">
        <button type="button" onClick={() => download(treasuryFileName('movimientos', new Date()), movementsToCsv(books, filters))}>Libro de movimientos</button>
        <button type="button" onClick={() => download(treasuryFileName('programacion', new Date()), scheduleToCsv(books, filters, today, selected))}>Programación</button>
        <button type="button" onClick={() => download(treasuryFileName('flujo', new Date()), weeklyFlowToCsv(books, today))}>Flujo semanal</button>
      </div>
      <label>
        Cuenta
        <select aria-label="Filtro de cuenta" value={filters.accountId} onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}>
          <option value="">Todas</option>
          {books.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void saveTreasury({
            intent: 'create-account',
            name: form.get('name'),
            openingBalanceCents: Math.round(Number(form.get('opening')) * 100),
            openingDate: form.get('openingDate'),
          }).then(reload).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'REJECTED'))
        }}
      >
        <input name="name" aria-label="Nombre de cuenta" />
        <input name="opening" aria-label="Saldo inicial" />
        <input name="openingDate" aria-label="Fecha de apertura" />
        <button type="submit">Nueva cuenta</button>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void saveTreasury({
            intent: 'create-category',
            name: form.get('name'),
            kind: form.get('kind'),
          }).then(reload).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'REJECTED'))
        }}
      >
        <input name="name" aria-label="Nombre de categoría" />
        <select name="kind" aria-label="Clase" defaultValue="expense">
          <option value="expense">Egreso</option>
          <option value="income">Ingreso</option>
        </select>
        <button type="submit">Nueva categoría</button>
      </form>
      <form onSubmit={(event) => void onSubmit(event)}>
        <input name="type" defaultValue="expense" aria-label="Tipo" />
        <input name="status" defaultValue="scheduled" aria-label="Estado" />
        <select name="accountId" aria-label="Cuenta">{books.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
        <select name="categoryId" aria-label="Categoría"><option value="">—</option>{books.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <input name="destinationAccountId" aria-label="Cuenta destino" />
        <input name="paymentMethod" aria-label="Forma de pago" />
        <input name="amount" aria-label="Monto" />
        <input name="occurredOn" aria-label="Fecha" />
        <input name="concept" aria-label="Concepto" />
        <input name="counterparty" aria-label="Proveedor" />
        <input name="notes" aria-label="Notas" />
        <input name="cancelReason" aria-label="Motivo" />
        <button type="submit">Guardar movimiento</button>
      </form>
      <table>
        <tbody>
          {books.movements.map((movement) => (
            <tr key={movement.id}>
              <td>
                {movement.status === 'scheduled' ? (
                  <input
                    type="checkbox"
                    aria-label={`Marcar ${movement.concept}`}
                    checked={selected.includes(movement.id)}
                    onChange={(event) => setSelected(event.target.checked
                      ? [...selected, movement.id]
                      : selected.filter((id) => id !== movement.id))}
                  />
                ) : null}
              </td>
              <td>{movement.concept}</td>
              <td>{movement.status}</td>
              <td>{movement.createdBy}</td>
              {movement.status !== 'cancelled' ? (
                <td>
                  <button
                    type="button"
                    onClick={() => void saveTreasury({
                      intent: 'update-movement',
                      id: movement.id,
                      type: movement.type,
                      status: 'cancelled',
                      accountId: movement.accountId,
                      destinationAccountId: movement.destinationAccountId,
                      categoryId: movement.categoryId,
                      paymentMethod: movement.paymentMethod,
                      amountCents: movement.amountCents,
                      occurredOn: movement.occurredOn,
                      concept: movement.concept,
                      counterparty: movement.counterparty,
                      notes: movement.notes,
                      cancelReason: 'Cancelado desde tesorería',
                    }).then(reload).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'REJECTED'))}
                  >
                    Cancelar
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
