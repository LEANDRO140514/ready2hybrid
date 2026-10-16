import { useMemo, useState } from 'react'

import {
  EMPTY_TREASURY_FILTERS,
  movementsToCsv,
  scheduleToCsv,
  treasuryCashCents,
  treasuryFileName,
  weeklyFlowToCsv,
  type TreasuryBooks,
  type TreasuryFilters,
} from '../../treasury/books'
import { applyTreasuryCommand } from '../../treasury/memory'

const EMPTY: TreasuryBooks = { accounts: [], categories: [], movements: [] }

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function TreasuryPage({
  initial = EMPTY,
  actor = 'local',
  role = 'FINANCE',
}: {
  initial?: TreasuryBooks
  actor?: string
  role?: string
}) {
  const [books, setBooks] = useState(initial)
  const [filters, setFilters] = useState<TreasuryFilters>(EMPTY_TREASURY_FILTERS)
  const [error, setError] = useState<string | null>(null)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  if (role === 'MARKETING') return <p role="alert">MARKETING no entra a tesorería.</p>

  function run(body: unknown) {
    const result = applyTreasuryCommand(books, body, actor)
    if (!result.ok) {
      setError(result.code)
      return
    }
    setError(null)
    setBooks(result.books)
  }

  return (
    <div data-testid="treasury-page">
      <h1>Tesorería</h1>
      <p data-testid="treasury-cash">Caja {(treasuryCashCents(books) / 100).toFixed(2)}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="chip-row">
        <button type="button" onClick={() => download(treasuryFileName('movimientos', new Date()), movementsToCsv(books, filters))}>
          Libro de movimientos
        </button>
        <button type="button" onClick={() => download(treasuryFileName('programacion', new Date()), scheduleToCsv(books, filters, today, []))}>
          Programación
        </button>
        <button type="button" onClick={() => download(treasuryFileName('flujo', new Date()), weeklyFlowToCsv(books, today))}>
          Flujo semanal
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          run({
            intent: 'create-movement',
            type: form.get('type'),
            status: form.get('status'),
            accountId: form.get('accountId'),
            destinationAccountId: form.get('destinationAccountId'),
            categoryId: form.get('categoryId'),
            paymentMethod: form.get('paymentMethod'),
            amountCents: Math.round(Number(form.get('amount')) * 100),
            occurredOn: form.get('occurredOn'),
            concept: form.get('concept'),
            counterparty: form.get('counterparty'),
            notes: form.get('notes'),
            cancelReason: form.get('cancelReason'),
            createdBy: 'from-body',
          })
        }}
      >
        <input name="type" defaultValue="expense" aria-label="Tipo" />
        <input name="status" defaultValue="scheduled" aria-label="Estado" />
        <input name="accountId" aria-label="Cuenta" />
        <input name="categoryId" aria-label="Categoría" />
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
      <label>
        Cuenta
        <select
          aria-label="Filtro de cuenta"
          value={filters.accountId}
          onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}
        >
          <option value="">Todas</option>
          {books.accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </label>
      <table>
        <tbody>
          {books.movements.map((movement) => (
            <tr key={movement.id} data-testid="treasury-row">
              <td>{movement.concept}</td>
              <td>{movement.status}</td>
              <td>{movement.createdBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
