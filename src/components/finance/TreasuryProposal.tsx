import { useMemo, useState } from 'react'

import { formatMoney } from '../../sales-dashboard/model'
import {
  EXAMPLE_ACTOR,
  EXAMPLE_BOOKS,
  TREASURY_CSV_HEADER,
  activeCatalog,
  addCatalog,
  addMovement,
  cashCents,
  catalogName,
  confirmImport,
  correctMovement,
  parsePesosToCents,
  planImport,
  renameCatalog,
  scheduledCents,
  setCatalogActive,
  type CatalogKind,
  type ImportPlan,
  type MovementDraft,
  type MovementKind,
  type TreasuryBooks,
} from '../../treasury/books'

type Section = 'posicion' | 'movimientos' | 'catalogos' | 'saldos' | 'carga'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'posicion', label: 'Posición' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'catalogos', label: 'Catálogos' },
  { id: 'saldos', label: 'Saldos iniciales' },
  { id: 'carga', label: 'Carga' },
]

const KIND_LABEL: Record<MovementKind, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  opening: 'Saldo inicial',
}

const CATALOG_LABEL: Record<CatalogKind, string> = {
  category: 'Categorías de gasto',
  supplier: 'Proveedores',
  account: 'Cuentas y cajas',
  method: 'Formas de pago',
}

type Props = {
  role?: 'OWNER' | 'FINANCE' | 'MARKETING'
  excludedSalesCents: number
}

export function TreasuryProposal({ role = 'OWNER', excludedSalesCents }: Props) {
  const [books, setBooks] = useState<TreasuryBooks>(EXAMPLE_BOOKS)
  const [section, setSection] = useState<Section>('posicion')
  if (role === 'MARKETING') {
    return <p role="alert">MARKETING no entra a tesorería.</p>
  }
  return (
    <section className="finance" aria-label="Tesorería">
      <h2>Tesorería</h2>
      <p className="muted">
        Propuesta para OWNER y FINANCE. Programar un gasto no lo descuenta. Los ingresos de ventas ya integrados no se vuelven a capturar.
      </p>
      <div className="chip-row" role="tablist" aria-label="Secciones de tesorería">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? 'chip chip-on' : 'chip'}
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {section === 'posicion' ? <Position books={books} excludedSalesCents={excludedSalesCents} /> : null}
      {section === 'movimientos' ? <Movements books={books} onChange={setBooks} /> : null}
      {section === 'catalogos' ? <Catalogs books={books} onChange={setBooks} /> : null}
      {section === 'saldos' ? <Openings books={books} onChange={setBooks} /> : null}
      {section === 'carga' ? <ImportPanel books={books} onChange={setBooks} /> : null}
    </section>
  )
}

function Position({ books, excludedSalesCents }: { books: TreasuryBooks; excludedSalesCents: number }) {
  const accounts = books.catalogs.filter((item) => item.kind === 'account')
  const income = books.movements.filter((movement) => movement.kind === 'income' && movement.status === 'posted')
    .reduce((sum, movement) => sum + movement.amountCents, 0)
  const postedExpenses = books.movements.filter((movement) => movement.kind === 'expense' && movement.status === 'posted')
    .reduce((sum, movement) => sum + movement.amountCents, 0)
  return (
    <div>
      <div className="kpi-grid">
        <article className="kpi">
          <p className="kpi-label">Efectivo realizado</p>
          <p className="kpi-value" data-testid="treasury-cash">{formatMoney(cashCents(books))}</p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Programado, todavía no pagado</p>
          <p className="kpi-value" data-testid="treasury-scheduled">{formatMoney(scheduledCents(books))}</p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Ingresos adicionales realizados</p>
          <p className="kpi-value">{formatMoney(income)}</p>
        </article>
        <article className="kpi">
          <p className="kpi-label">Egresos realizados</p>
          <p className="kpi-value">{formatMoney(postedExpenses)}</p>
        </article>
      </div>
      <p className="muted" data-testid="treasury-sales-excluded">
        Monto comercial conocido en Ventas: {formatMoney(excludedSalesCents)}. No se suma aquí y no se captura como saldo inicial ni como ingreso.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Efectivo realizado</th>
              <th>Programado</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}{account.active ? '' : ' · INACTIVA'}</td>
                <td className="money">{formatMoney(cashCents(books, account.id))}</td>
                <td className="money">{formatMoney(scheduledCents(books, account.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Movements({ books, onChange }: { books: TreasuryBooks; onChange: (books: TreasuryBooks) => void }) {
  const [draft, setDraft] = useState<MovementDraft>(emptyExpense(books))
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rows = [...books.movements].sort((left, right) => right.occurredOn.localeCompare(left.occurredOn))
  return (
    <div>
      <MovementForm
        key={editing ?? 'new'}
        books={books}
        draft={draft}
        submitLabel={editing ? 'Guardar corrección' : 'Registrar movimiento'}
        error={error}
        onChange={setDraft}
        onSubmit={() => {
          const at = new Date().toISOString()
          const result = editing
            ? correctMovement(books, editing, draft, EXAMPLE_ACTOR, at)
            : addMovement(books, draft, EXAMPLE_ACTOR, at)
          if (!result.ok) {
            setError(result.error)
            return
          }
          onChange(result.books)
          setEditing(null)
          setDraft(emptyExpense(result.books))
          setError(null)
        }}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Cuenta</th>
              <th>Concepto</th>
              <th>Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((movement) => (
              <tr key={movement.id}>
                <td>{movement.occurredOn}</td>
                <td>{KIND_LABEL[movement.kind]}</td>
                <td style={movement.status === 'scheduled' ? { color: 'var(--color-warning)' } : undefined}>
                  {movement.status === 'scheduled' ? 'PROGRAMADO' : 'REALIZADO'}
                </td>
                <td>{catalogName(books, movement.accountId)}</td>
                <td>
                  {movement.concept}
                  {movement.revisions.length > 0 ? (
                    <span className="muted"> · {movement.revisions.length} corrección{movement.revisions.length === 1 ? '' : 'es'}</span>
                  ) : null}
                </td>
                <td className="money">{formatMoney(movement.amountCents)}</td>
                <td>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setEditing(movement.id)
                      setDraft({
                        kind: movement.kind,
                        status: movement.status,
                        accountId: movement.accountId,
                        categoryId: movement.categoryId,
                        supplierId: movement.supplierId,
                        methodId: movement.methodId,
                        amountCents: movement.amountCents,
                        occurredOn: movement.occurredOn,
                        concept: movement.concept,
                        reference: movement.reference,
                      })
                      setError(null)
                    }}
                  >
                    Corregir
                  </button>
                  {movement.kind === 'expense' && movement.status === 'scheduled' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const result = correctMovement(books, movement.id, { ...movement, status: 'posted' }, EXAMPLE_ACTOR, new Date().toISOString())
                        if (result.ok) onChange(result.books)
                      }}
                    >
                      Registrar pago
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <Audit books={books} id={editing} /> : null}
    </div>
  )
}

function Audit({ books, id }: { books: TreasuryBooks; id: string }) {
  const movement = books.movements.find((item) => item.id === id)
  if (!movement) return null
  return (
    <section className="finance-panel" aria-label="Trazabilidad">
      <h3>Quién cambió qué</h3>
      {movement.revisions.length === 0 ? <p className="muted">Este movimiento no tiene correcciones.</p> : (
        <ul>
          {movement.revisions.map((revision, index) => (
            <li key={`${revision.at}-${index}`}>
              {revision.actor} cambió {revision.field}: {revision.before || '—'} → {revision.after || '—'}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MovementForm({
  books,
  draft,
  submitLabel,
  error,
  onChange,
  onSubmit,
}: {
  books: TreasuryBooks
  draft: MovementDraft
  submitLabel: string
  error: string | null
  onChange: (draft: MovementDraft) => void
  onSubmit: () => void
}) {
  const accounts = activeCatalog(books, 'account')
  const categories = activeCatalog(books, 'category')
  const suppliers = activeCatalog(books, 'supplier')
  const methods = activeCatalog(books, 'method')
  const [amountText, setAmountText] = useState((draft.amountCents / 100).toFixed(2))
  return (
    <form
      className="filter-grid"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label>
        Tipo
        <select
          value={draft.kind}
          onChange={(event) => {
            const kind = event.target.value as MovementKind
            onChange({ ...draft, kind, status: kind === 'expense' ? draft.status : 'posted', categoryId: kind === 'opening' ? null : draft.categoryId })
          }}
        >
          <option value="income">Ingreso adicional</option>
          <option value="expense">Egreso</option>
          <option value="opening">Saldo inicial</option>
        </select>
      </label>
      <label>
        Estado
        <select
          value={draft.status}
          disabled={draft.kind !== 'expense'}
          onChange={(event) => onChange({ ...draft, status: event.target.value as MovementDraft['status'] })}
        >
          <option value="posted">Realizado</option>
          <option value="scheduled">Programado</option>
        </select>
      </label>
      <label>
        Cuenta
        <select value={draft.accountId} onChange={(event) => onChange({ ...draft, accountId: event.target.value })}>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {draft.kind === 'opening' ? null : (
        <label>
          Categoría
          <select value={draft.categoryId ?? ''} onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <label>
        Proveedor
        <select value={draft.supplierId ?? ''} onChange={(event) => onChange({ ...draft, supplierId: event.target.value || null })}>
          <option value="">Sin proveedor</option>
          {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Forma de pago
        <select value={draft.methodId ?? ''} onChange={(event) => onChange({ ...draft, methodId: event.target.value || null })}>
          <option value="">Sin forma de pago</option>
          {methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Fecha
        <input type="date" value={draft.occurredOn} onChange={(event) => onChange({ ...draft, occurredOn: event.target.value })} required />
      </label>
      <label>
        Concepto
        <input value={draft.concept} onChange={(event) => onChange({ ...draft, concept: event.target.value })} required />
      </label>
      <label>
        Monto
        <input
          inputMode="decimal"
          value={amountText}
          onChange={(event) => {
            setAmountText(event.target.value)
            const cents = parsePesosToCents(event.target.value)
            if (cents != null) onChange({ ...draft, amountCents: cents })
          }}
          required
        />
      </label>
      <button type="submit">{submitLabel}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  )
}

function Catalogs({ books, onChange }: { books: TreasuryBooks; onChange: (books: TreasuryBooks) => void }) {
  return (
    <div className="kpi-grid">
      {(Object.keys(CATALOG_LABEL) as CatalogKind[]).map((kind) => (
        <CatalogColumn key={kind} books={books} kind={kind} onChange={onChange} />
      ))}
    </div>
  )
}

function CatalogColumn({
  books,
  kind,
  onChange,
}: {
  books: TreasuryBooks
  kind: CatalogKind
  onChange: (books: TreasuryBooks) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const items = books.catalogs.filter((item) => item.kind === kind)
  return (
    <section className="finance-panel" aria-label={CATALOG_LABEL[kind]}>
      <h3>{CATALOG_LABEL[kind]}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const result = addCatalog(books, kind, name)
          if (!result.ok) {
            setError(result.error)
            return
          }
          onChange(result.books)
          setName('')
          setError(null)
        }}
      >
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit">Agregar</button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name}{item.active ? '' : ' · INACTIVO'}
            <button
              type="button"
              className="chip"
              onClick={() => {
                const next = window.prompt('Nombre', item.name)
                if (next == null) return
                const result = renameCatalog(books, item.id, next)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                onChange(result.books)
                setError(null)
              }}
            >
              Editar
            </button>
            <button type="button" className="chip" onClick={() => onChange(setCatalogActive(books, item.id, !item.active))}>
              {item.active ? 'Desactivar' : 'Activar'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Openings({ books, onChange }: { books: TreasuryBooks; onChange: (books: TreasuryBooks) => void }) {
  const openings = books.movements.filter((movement) => movement.kind === 'opening')
  const available = activeCatalog(books, 'account').filter(
    (account) => !openings.some((movement) => movement.accountId === account.id),
  )
  const [accountId, setAccountId] = useState(available[0]?.id ?? '')
  const [occurredOn, setOccurredOn] = useState('2026-08-01')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <p className="muted">Un saldo inicial por cuenta, con su fecha. No reemplaza el monto comercial conocido de Ventas.</p>
      <form
        className="filter-grid"
        onSubmit={(event) => {
          event.preventDefault()
          const amountCents = parsePesosToCents(amount)
          if (amountCents == null) {
            setError('El monto debe ser mayor que cero.')
            return
          }
          const result = addMovement(books, {
            kind: 'opening',
            status: 'posted',
            accountId,
            categoryId: null,
            supplierId: null,
            methodId: null,
            amountCents,
            occurredOn,
            concept: 'Saldo inicial',
            reference: null,
          }, EXAMPLE_ACTOR, new Date().toISOString())
          if (!result.ok) {
            setError(result.error)
            return
          }
          onChange(result.books)
          setAmount('')
          setError(null)
        }}
      >
        <label>
          Cuenta
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {available.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label>
          Fecha de referencia
          <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required />
        </label>
        <label>
          Monto
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
        </label>
        <button type="submit" disabled={available.length === 0}>Guardar saldo inicial</button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
      <ul>
        {openings.map((movement) => (
          <li key={movement.id}>
            {catalogName(books, movement.accountId)} · {movement.occurredOn} · {formatMoney(movement.amountCents)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ImportPanel({ books, onChange }: { books: TreasuryBooks; onChange: (books: TreasuryBooks) => void }) {
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)
  const readyCount = plan?.ready.length ?? 0
  const summary = useMemo(() => {
    if (!plan) return null
    const duplicates = plan.issues.filter((issue) => issue.level === 'duplicate').length
    const errors = plan.issues.filter((issue) => issue.level === 'error').length
    return `${readyCount} listas, ${duplicates} duplicadas, ${errors} con error. Nada se guarda hasta confirmar.`
  }, [plan, readyCount])
  return (
    <div>
      <p className="muted">La plantilla abre en Excel. Esta vista previa valida CSV. Un archivo .xlsx usa las mismas columnas y se leerá al implementar el módulo.</p>
      <button
        type="button"
        onClick={() => {
          const blob = new Blob([`${TREASURY_CSV_HEADER}\n`], { type: 'text/csv;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'tesoreria-plantilla.csv'
          link.click()
          URL.revokeObjectURL(url)
        }}
      >
        Descargar plantilla
      </button>
      <label>
        Archivo CSV o Excel
        <input
          type="file"
          accept=".csv,.xlsx,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            setPlan(null)
            setError(null)
            setFileNote(null)
            if (!file) return
            if (/\.xlsx?$/i.test(file.name)) {
              setFileNote(`${file.name} se aceptará con estas columnas al implementar. Para la vista previa, exporta esa hoja como CSV.`)
              return
            }
            void file.text().then((text) => {
              const result = planImport(books, text)
              if (!result.ok) {
                setError(result.error)
                return
              }
              setPlan(result.plan)
            })
          }}
        />
      </label>
      {fileNote ? <p role="status">{fileNote}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {summary ? <p data-testid="treasury-import-summary">{summary}</p> : null}
      {plan && plan.issues.length > 0 ? (
        <ul>
          {plan.issues.map((issue) => (
            <li key={`${issue.line}-${issue.message}`}>Fila {issue.line}: {issue.level === 'duplicate' ? 'DUPLICADO' : 'ERROR'} · {issue.message}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={readyCount === 0}
        onClick={() => {
          if (!plan) return
          onChange(confirmImport(books, plan.ready, EXAMPLE_ACTOR, new Date().toISOString()))
          setPlan(null)
        }}
      >
        Confirmar {readyCount} movimientos
      </button>
    </div>
  )
}

function emptyExpense(books: TreasuryBooks): MovementDraft {
  return {
    kind: 'expense',
    status: 'scheduled',
    accountId: activeCatalog(books, 'account')[0]?.id ?? '',
    categoryId: activeCatalog(books, 'category')[0]?.id ?? null,
    supplierId: null,
    methodId: null,
    amountCents: 10000,
    occurredOn: '2026-10-16',
    concept: '',
    reference: null,
  }
}
