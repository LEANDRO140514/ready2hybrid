import { useCallback, useEffect, useMemo, useState } from 'react'

import { meridaFileStamp } from '../../treasury/books'
import { netIncomeToCsv } from '../../sales-dashboard/net-income'
import { formatMoney, type SalesOrder } from '../../sales-dashboard/model'
import { useOptionalSalesPort } from '../../sales-dashboard/port'
import {
  centsToPesosText,
  isBankReconcilable,
  LEGACY_PROVIDER_LABEL,
  needsTagReview,
  parsePesosToCents,
  type LegacyProvider,
  type LegacyReconcileRow,
  type SaveLegacyReconciliation,
} from '../../sales-dashboard/legacy-reconciliation'
import {
  createEdgeLegacyReconcilePort,
  type LegacyReconcilePort,
} from '../../sales-dashboard/legacy-reconcile-port'

const defaultPort = createEdgeLegacyReconcilePort()

export function ConciliationPage({ port = defaultPort }: { port?: LegacyReconcilePort }) {
  const sales = useOptionalSalesPort()
  const [rows, setRows] = useState<LegacyReconcileRow[] | null>(null)
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'done'>('pending')

  const load = useCallback(async () => {
    try {
      setRows(await port.list())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo leer el histórico legacy.')
    }
  }, [port])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    if (!sales) return
    sales.loadSnapshot()
      .then((snapshot) => {
        if (!cancelled) setOrders(snapshot.orders)
      })
      .catch(() => {
        if (!cancelled) setOrders([])
      })
    return () => {
      cancelled = true
    }
  }, [sales])

  function exportNet() {
    const blob = new Blob([netIncomeToCsv(orders, rows ?? [], filter)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hex2026_neto_${meridaFileStamp(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Courtesy / staff rows (amount 0) are not bank-reconcilable and never show here.
  const reconcilable = useMemo(() => (rows ?? []).filter(isBankReconcilable), [rows])
  const pending = reconcilable.filter((row) => !row.reconciliation)
  const done = reconcilable.filter((row) => row.reconciliation)
  const visible = filter === 'pending' ? pending : done
  const feeTotal = done.reduce((sum, row) => sum + (row.reconciliation?.feeCents ?? 0), 0)
  const pendingGross = pending.reduce((sum, row) => sum + (row.grossCents ?? 0), 0)

  return (
    <div data-testid="conciliation-page">
      <h1>Conciliación bancaria</h1>
      <button type="button" data-testid="export-net-income" onClick={exportNet}>
        Exportar ingreso neto
      </button>

      <section className="finance-panel" data-testid="lane-a">
        <h2>Carril A · Ventas nativas (Mercado Pago / Openpay)</h2>
        <p className="muted">
          La conciliación automática contra estado de cuenta aún no está disponible. Mientras
          tanto, las ventas nativas se concilian a mano en Ventas → Conciliación.
        </p>
        <button type="button" disabled>
          Importar estado de cuenta
        </button>
      </section>

      <section className="finance-panel" data-testid="lane-b">
        <h2>Carril B · Legacy (CSV importado)</h2>
        <p className="muted">
          Cortesías y staff (monto $0) no aparecen aquí: no hay depósito que cuadrar. Este carril
          no se mezcla con las ventas nativas.
        </p>
        <div className="kpi-grid">
          <article className="kpi" data-testid="legacy-pending-count">
            <p className="kpi-label">Pendientes de conciliar</p>
            <p className="kpi-value">{pending.length}</p>
          </article>
          <article className="kpi" data-testid="legacy-pending-gross">
            <p className="kpi-label">Bruto pendiente</p>
            <p className="kpi-value">{formatMoney(pendingGross)}</p>
          </article>
          <article className="kpi" data-testid="legacy-fee-total">
            <p className="kpi-label">Comisión registrada</p>
            <p className="kpi-value">{formatMoney(feeTotal)}</p>
          </article>
        </div>

        <div className="chip-row" role="tablist" aria-label="Estado de conciliación legacy">
          {(['pending', 'done'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? 'chip chip-on' : 'chip'}
              onClick={() => setFilter(key)}
            >
              {key === 'pending' ? `Pendientes (${pending.length})` : `Conciliados (${done.length})`}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" data-testid="legacy-error">
            {error}
          </p>
        ) : null}
        {rows === null && !error ? <p data-testid="legacy-loading">Cargando…</p> : null}
        {rows !== null && visible.length === 0 ? (
          <p className="muted" data-testid="legacy-empty">
            {filter === 'pending' ? 'No hay registros legacy pendientes.' : 'Aún no hay conciliaciones.'}
          </p>
        ) : null}

        {visible.length > 0 ? (
          <div className="table-wrap">
            <table data-testid="legacy-table">
              <thead>
                <tr>
                  <th>Origen / Proveedor</th>
                  <th>Clave / Folio de operación</th>
                  <th>Monto original</th>
                  <th>Monto depositado</th>
                  <th>Comisión</th>
                  <th aria-label="Acción" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <LegacyRow
                    key={row.id}
                    row={row}
                    onSave={async (input) => {
                      await port.save(input)
                      await load()
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function LegacyRow({
  row,
  onSave,
}: {
  row: LegacyReconcileRow
  onSave: (input: SaveLegacyReconciliation) => Promise<void>
}) {
  const [provider, setProvider] = useState<LegacyProvider | ''>(
    row.reconciliation?.provider ?? (row.operationKey ? 'MERCADOPAGO' : ''),
  )
  const [deposit, setDeposit] = useState(
    row.reconciliation ? centsToPesosText(row.reconciliation.depositedCents) : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gross = row.grossCents ?? 0
  const deposited = parsePesosToCents(deposit)
  const fee = deposited == null ? null : gross - deposited
  const invalid = !provider || deposited == null || fee == null || fee < 0

  async function save() {
    if (invalid || !provider || deposited == null) return
    setBusy(true)
    setError(null)
    try {
      await onSave({ legacyRegistrationId: row.id, provider, depositedCents: deposited })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr data-testid="legacy-row">
      <td>
        <select
          aria-label="Proveedor"
          value={provider}
          onChange={(event) => setProvider(event.target.value as LegacyProvider | '')}
        >
          <option value="">Elegir…</option>
          {(Object.keys(LEGACY_PROVIDER_LABEL) as LegacyProvider[]).map((key) => (
            <option key={key} value={key}>
              {LEGACY_PROVIDER_LABEL[key]}
            </option>
          ))}
        </select>
        {needsTagReview(row) ? (
          <p
            role="note"
            data-testid="legacy-tag-warning"
            style={{
              background: 'var(--color-warning)',
              color: '#111',
              borderRadius: 4,
              padding: '2px 6px',
              margin: '4px 0 0',
              fontSize: '0.8em',
              fontWeight: 600,
            }}
          >
            Etiqueta cortesía/staff con monto: revisar
          </p>
        ) : null}
      </td>
      <td>{row.operationKey ?? `Sin folio · ${row.recordRef.slice(0, 8)}`}</td>
      <td>{formatMoney(gross)}</td>
      <td>
        <input
          inputMode="decimal"
          aria-label="Monto depositado"
          placeholder="0.00"
          value={deposit}
          onChange={(event) => setDeposit(event.target.value)}
        />
      </td>
      <td data-testid="legacy-fee">
        {fee == null ? '—' : fee < 0 ? 'Depósito mayor al original' : formatMoney(fee)}
      </td>
      <td>
        <button type="button" disabled={invalid || busy} onClick={() => void save()}>
          {row.reconciliation ? 'Actualizar' : 'Conciliar'}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </td>
    </tr>
  )
}
