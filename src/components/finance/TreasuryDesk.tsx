import { useState } from 'react'

import { formatMoney } from '../../sales-dashboard/model'
import {
  EMPTY_TREASURY_FILTERS,
  accountCashCents,
  formatMeridaDate,
  meridaToday,
  movementMatches,
  movementsToCsv,
  scheduleToCsv,
  treasuryCashCents,
  treasuryFileName,
  weeklyFlowToCsv,
  type MovementStatus,
  type MovementType,
  type PaymentMethod,
  type TreasuryBooks,
  type TreasuryFilters,
  type TreasuryMovement,
} from '../../treasury/books'

const TYPE_LABEL: Record<MovementType, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  transfer: 'Transferencia',
}

const STATUS_LABEL: Record<MovementStatus, string> = {
  posted: 'Realizado',
  scheduled: 'Programado',
  cancelled: 'Cancelado',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  otro: 'Otro',
}

const ERROR_TEXT: Record<string, string> = {
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
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function pesosToCents(value: FormDataEntryValue | null, allowAny = false): number | null {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed)) return null
  if (!allowAny && parsed <= 0) return null
  return Math.round(parsed * 100)
}

function postedSum(books: TreasuryBooks, type: 'income' | 'expense'): number {
  return books.movements.reduce((sum, movement) => {
    if (movement.status === 'posted' && movement.type === type) return sum + movement.amountCents
    return sum
  }, 0)
}

export function TreasuryDesk({
  books,
  onSave,
  error,
  excludedSalesCents,
}: {
  books: TreasuryBooks
  onSave: (body: Record<string, unknown>) => Promise<boolean>
  error: string | null
  excludedSalesCents?: number
}) {
  const [filters, setFilters] = useState<TreasuryFilters>(EMPTY_TREASURY_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const today = meridaToday(new Date())
  const scheduled = books.movements
    .filter((movement) => movement.status === 'scheduled' && movement.type === 'expense')
    .reduce((sum, movement) => sum + movement.amountCents, 0)
  const visible = books.movements.filter((movement) => movementMatches(movement, filters))
  const activeAccounts = books.accounts.filter((account) => account.active)

  async function save(body: Record<string, unknown>, form?: HTMLFormElement): Promise<boolean> {
    setBusy(true)
    try {
      const saved = await onSave(body)
      if (saved) form?.reset()
      return saved
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="finance" data-testid="treasury-page">
      <h1>Tesorería</h1>
      <p className="muted">
        {excludedSalesCents == null
          ? 'El monto comercial de Ventas no se suma aquí y no se importa como ingreso ni como saldo inicial.'
          : `El monto comercial conocido en Ventas (${formatMoney(excludedSalesCents)}) no se suma aquí y no se importa como ingreso ni como saldo inicial.`}
      </p>
      <div className="kpi-grid">
        <article className="kpi">
          <p className="kpi-label">Efectivo realizado</p>
          <p className="kpi-value" data-testid="treasury-cash">{formatMoney(treasuryCashCents(books))}</p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Programado todavía no pagado</p>
          <p className="kpi-value" data-testid="treasury-scheduled" style={{ color: 'var(--color-warning)' }}>
            {formatMoney(scheduled)}
          </p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Ingresos realizados</p>
          <p className="kpi-value">{formatMoney(postedSum(books, 'income'))}</p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Egresos realizados</p>
          <p className="kpi-value">{formatMoney(postedSum(books, 'expense'))}</p>
        </article>
      </div>

      {error ? <p role="alert">{ERROR_TEXT[error] ?? error}</p> : null}

      <div className="chip-row">
        <button type="button" onClick={() => download(treasuryFileName('movimientos', new Date()), movementsToCsv(books, filters))}>
          Libro de movimientos
        </button>
        <button type="button" onClick={() => download(treasuryFileName('programacion', new Date()), scheduleToCsv(books, filters, today, selected))}>
          Programación
        </button>
        <button type="button" onClick={() => download(treasuryFileName('flujo', new Date()), weeklyFlowToCsv(books, today))}>
          Flujo semanal
        </button>
      </div>

      <section className="finance-panel">
        <h2>Cuentas</h2>
        <ul>
          {books.accounts.map((account) => (
            <li key={account.id}>
              {account.name}: {formatMoney(accountCashCents(books, account.id))}
              {account.active ? '' : ' · inactiva'}
            </li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const openingBalanceCents = pesosToCents(form.get('opening'), true)
            if (openingBalanceCents == null) return
            void save({
              intent: 'create-account',
              name: form.get('name'),
              openingBalanceCents,
              openingDate: form.get('openingDate'),
            }, event.currentTarget)
          }}
        >
          <label>Nombre <input name="name" aria-label="Nombre de cuenta" required /></label>
          <label>Saldo inicial <input name="opening" inputMode="decimal" aria-label="Saldo inicial" required /></label>
          <label>Fecha <input name="openingDate" type="date" aria-label="Fecha de apertura" required /></label>
          <button type="submit" disabled={busy}>Nueva cuenta</button>
        </form>
      </section>

      <section className="finance-panel">
        <h2>Categorías</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void save({
              intent: 'create-category',
              name: form.get('name'),
              kind: form.get('kind'),
            }, event.currentTarget)
          }}
        >
          <label>Nombre <input name="name" aria-label="Nombre de categoría" required /></label>
          <label>
            Clase
            <select name="kind" aria-label="Clase" defaultValue="expense">
              <option value="expense">Egreso</option>
              <option value="income">Ingreso</option>
            </select>
          </label>
          <button type="submit" disabled={busy}>Nueva categoría</button>
        </form>
      </section>

      <MovementForm
        books={books}
        accounts={activeAccounts}
        busy={busy}
        onSave={save}
      />

      <section className="finance-panel">
        <h2>Movimientos</h2>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th aria-label="Marcar" />
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Tipo</th>
                <th>Estatus</th>
                <th>Monto</th>
                <th>Capturado por</th>
                <th aria-label="Acción" />
              </tr>
            </thead>
            <tbody>
              {visible.map((movement) => (
                <MovementRow
                  key={movement.id}
                  movement={movement}
                  books={books}
                  selected={selected.includes(movement.id)}
                  busy={busy}
                  onToggle={(checked) => setSelected(checked
                    ? [...selected, movement.id]
                    : selected.filter((id) => id !== movement.id))}
                  onSave={save}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MovementForm({
  books,
  accounts,
  busy,
  onSave,
}: {
  books: TreasuryBooks
  accounts: TreasuryBooks['accounts']
  busy: boolean
  onSave: (body: Record<string, unknown>, form?: HTMLFormElement) => Promise<boolean>
}) {
  const [type, setType] = useState<MovementType>('expense')
  const categories = books.categories.filter((category) => category.active && category.kind === type)

  return (
    <section className="finance-panel">
      <h2>Nuevo movimiento</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const amountCents = pesosToCents(form.get('amount'))
          if (amountCents == null) return
          void onSave({
            intent: 'create-movement',
            type,
            status: form.get('status'),
            accountId: form.get('accountId'),
            destinationAccountId: type === 'transfer' ? form.get('destinationAccountId') : null,
            categoryId: type === 'transfer' ? null : form.get('categoryId'),
            paymentMethod: form.get('paymentMethod') || null,
            amountCents,
            occurredOn: form.get('occurredOn'),
            concept: form.get('concept'),
            counterparty: form.get('counterparty') || null,
            notes: form.get('notes') || null,
            cancelReason: form.get('status') === 'cancelled' ? form.get('cancelReason') : null,
          }, event.currentTarget)
        }}
      >
        <label>
          Tipo
          <select aria-label="Tipo" value={type} onChange={(event) => setType(event.target.value as MovementType)}>
            <option value="expense">Egreso</option>
            <option value="income">Ingreso</option>
            <option value="transfer">Transferencia</option>
          </select>
        </label>
        <label>
          Estado
          <select name="status" aria-label="Estado" defaultValue="scheduled">
            <option value="scheduled">Programado</option>
            <option value="posted">Realizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label>
          Cuenta
          <select name="accountId" aria-label="Cuenta" required>
            <option value="">Elegir…</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        {type === 'transfer' ? (
          <label>
            Cuenta destino
            <select name="destinationAccountId" aria-label="Cuenta destino" required>
              <option value="">Elegir…</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        ) : (
          <label>
            Categoría
            <select name="categoryId" aria-label="Categoría" required>
              <option value="">Elegir…</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Forma de pago
          <select name="paymentMethod" aria-label="Forma de pago" defaultValue="">
            <option value="">Al realizarlo</option>
            {Object.entries(METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>Monto <input name="amount" inputMode="decimal" aria-label="Monto" required /></label>
        <label>Fecha <input name="occurredOn" type="date" aria-label="Fecha" required /></label>
        <label>Concepto <input name="concept" aria-label="Concepto" required /></label>
        <label>Proveedor <input name="counterparty" aria-label="Proveedor" /></label>
        <label>Notas <input name="notes" aria-label="Notas" /></label>
        <label>Motivo de cancelación <input name="cancelReason" aria-label="Motivo" /></label>
        <button type="submit" disabled={busy}>Guardar movimiento</button>
      </form>
    </section>
  )
}

function MovementRow({
  movement,
  books,
  selected,
  busy,
  onToggle,
  onSave,
}: {
  movement: TreasuryMovement
  books: TreasuryBooks
  selected: boolean
  busy: boolean
  onToggle: (checked: boolean) => void
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [method, setMethod] = useState<PaymentMethod | ''>(movement.paymentMethod ?? '')
  const account = books.accounts.find((row) => row.id === movement.accountId)?.name ?? ''

  function base() {
    return {
      intent: 'update-movement',
      id: movement.id,
      type: movement.type,
      accountId: movement.accountId,
      destinationAccountId: movement.destinationAccountId,
      categoryId: movement.categoryId,
      amountCents: movement.amountCents,
      occurredOn: movement.occurredOn,
      concept: movement.concept,
      counterparty: movement.counterparty,
      notes: movement.notes,
    }
  }

  return (
    <tr data-testid="treasury-row">
      <td>
        {movement.status === 'scheduled' ? (
          <input
            type="checkbox"
            aria-label={`Marcar ${movement.concept}`}
            checked={selected}
            onChange={(event) => onToggle(event.target.checked)}
          />
        ) : null}
      </td>
      <td>{formatMeridaDate(movement.occurredOn)}</td>
      <td>
        {movement.concept}
        <p className="muted">{account}</p>
      </td>
      <td>{TYPE_LABEL[movement.type]}</td>
      <td>{STATUS_LABEL[movement.status]}</td>
      <td>{formatMoney(movement.amountCents)}</td>
      <td>{movement.createdBy}</td>
      <td>
        {movement.status === 'scheduled' ? (
          <>
            <select aria-label={`Forma de pago de ${movement.concept}`} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod | '')}>
              <option value="">Forma de pago</option>
              {Object.entries(METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !method}
              onClick={() => void onSave({ ...base(), status: 'posted', paymentMethod: method, cancelReason: null })}
            >
              Registrar pago
            </button>
          </>
        ) : null}
        {movement.status !== 'cancelled' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave({
              ...base(),
              status: 'cancelled',
              paymentMethod: movement.paymentMethod,
              cancelReason: 'Cancelado desde tesorería',
            })}
          >
            Cancelar
          </button>
        ) : null}
      </td>
    </tr>
  )
}
