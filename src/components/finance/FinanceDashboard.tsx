import { useEffect, useMemo, useState } from 'react'

import type { OperationalRole } from '../../auth/types'
import {
  CommercialDirectory,
  CurrentOpportunities,
  EventTotal,
  FunnelBlock,
  HistoricalSales,
  PeriodPanorama,
} from './CommercialLayer'
import { ACTIVE_EVENT_CODE, type FunnelEvent, type LegacyRegistration } from '../../sales-dashboard/commercial'
import type { CommercialSource } from '../../sales-dashboard/commercial'
import {
  approvedPayment,
  buildDashboard,
  buildTimeline,
  effectiveFeeRate,
  EMPTY_FILTERS,
  formatAge,
  formatMoney,
  formatWhen,
  GROUP_LABEL,
  netRevenueCents,
  ordersToCsv,
  participantCount,
  productLabel,
  reconciliationLabel,
  stateLabel,
  type CommercialGroup,
  type SalesFilters,
  type SalesOrder,
  type SalesSnapshot,
  type SaveAdjustmentInput,
} from '../../sales-dashboard/model'

type Props = {
  snapshot: SalesSnapshot
  commercial?: {
    eventCode: string
    legacy: LegacyRegistration[]
    funnel: FunnelEvent[]
    summary?: {
      legacyPaid: number
      legacyPending: number
      legacyGrossCents: number
    } | null
  }
  role?: OperationalRole | null
  now?: Date
  onLoadDetail?: () => Promise<void>
  onSaveAdjustment?: (input: SaveAdjustmentInput) => Promise<void>
}

const PRESETS: { id: SalesFilters['preset']; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'custom', label: 'Rango' },
]

export function FinanceDashboard({ snapshot, commercial, role = 'OWNER', now, onLoadDetail, onSaveAdjustment }: Props) {
  const fallbackNow = useMemo(() => new Date(), [])
  const clock = now ?? fallbackNow
  const legacy = commercial?.legacy ?? []
  const funnel = commercial?.funnel ?? []
  const eventCode = commercial?.eventCode || ACTIVE_EVENT_CODE
  const [filters, setFilters] = useState<SalesFilters>(EMPTY_FILTERS)
  const [source, setSource] = useState<CommercialSource>('all')
  const [salesMode, setSalesMode] = useState<'current' | 'legacy'>('current')
  const [section, setSection] = useState<'resumen' | 'ventas' | 'base' | 'conciliacion'>('resumen')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const view = useMemo(
    () => buildDashboard(snapshot.orders, filters, clock),
    [snapshot.orders, filters, clock],
  )
  useEffect(() => {
    if (role !== 'OWNER' || !onLoadDetail) return
    if (section !== 'base' && salesMode !== 'legacy') return
    void onLoadDetail()
  }, [role, section, salesMode, onLoadDetail])

  const selected = snapshot.orders.find((order) => order.id === selectedId) ?? null
  const pageSize = 20
  const pageCount = Math.max(1, Math.ceil(view.table.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = view.table.slice(safePage * pageSize, safePage * pageSize + pageSize)

  function patch(partial: Partial<SalesFilters>) {
    setPage(0)
    setFilters((current) => ({ ...current, ...partial }))
  }

  function exportCsv() {
    const blob = new Blob([ordersToCsv(view.table)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ventas-filtradas.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const productOptions = uniqueLines(snapshot.orders)
  const providerOptions = uniqueProviders(snapshot.orders)
  const affiliateOptions = uniqueAffiliates(snapshot.orders)
  const pendingOrders = view.table.filter(
    (order) => order.state === 'PAID' && order.adjustment == null,
  )
  const salesMax = Math.max(1, ...view.series.map((point) => point.sales))
  const revenueMax = Math.max(1, ...view.series.map((point) => point.revenueCents))

  return (
    <div className="finance">
      <header className="finance-head">
        <div>
          <p className="muted">
            Consulta ventas aprobadas y registra los costos reales de procesamiento
            para conocer el ingreso neto conciliado.
          </p>
        </div>
        <p className="muted" data-testid="snapshot-time">
          Datos al {formatWhen(snapshot.generatedAt)}
        </p>
      </header>

      <EventTotal orders={snapshot.orders} legacy={legacy} eventCode={eventCode} summary={commercial?.summary} />

      <section className="finance-filters" aria-label="Filtros">
        <h2 data-testid="period-label">Periodo seleccionado</h2>
        <div className="chip-row" aria-label="Fuente">
          {(
            [
              ['all', 'Todos'],
              ['current', 'Ready2Hybrid'],
              ['legacy', 'Legacy'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={source === id ? 'chip chip-on' : 'chip'}
              onClick={() => setSource(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={filters.preset === preset.id ? 'chip chip-on' : 'chip'}
              onClick={() => patch({ preset: preset.id })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {filters.preset === 'custom' ? (
          <div className="chip-row">
            <label>
              Desde
              <input
                type="date"
                value={filters.customFrom}
                onChange={(event) => patch({ customFrom: event.target.value })}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={filters.customTo}
                onChange={(event) => patch({ customTo: event.target.value })}
              />
            </label>
          </div>
        ) : null}
        <div className="filter-grid">
          <label>
            Buscar
            <input
              type="search"
              placeholder="Nombre, email, teléfono, orden, tracking, pago"
              value={filters.search}
              onChange={(event) => patch({ search: event.target.value })}
            />
          </label>
          <label>
            Producto
            <select
              value={filters.productCode}
              onChange={(event) => patch({ productCode: event.target.value })}
            >
              <option value="">Todos</option>
              {productOptions.map((line) => (
                <option key={line.code} value={line.code}>
                  {line.code} · {line.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoría
            <select
              value={filters.group}
              onChange={(event) => patch({ group: event.target.value })}
            >
              <option value="">Todas</option>
              {(Object.keys(GROUP_LABEL) as CommercialGroup[]).map((group) => (
                <option key={group} value={group}>
                  {GROUP_LABEL[group]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={filters.orderState}
              onChange={(event) => patch({ orderState: event.target.value })}
            >
              <option value="">Todos</option>
              {orderStates(snapshot.orders).map((state) => (
                <option key={state} value={state}>
                  {stateLabel(state)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select
              value={filters.provider}
              onChange={(event) => patch({ provider: event.target.value })}
            >
              <option value="">Todos</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>
          <label>
            Community Partner
            <select
              value={filters.affiliate}
              onChange={(event) => patch({ affiliate: event.target.value })}
            >
              <option value="">Todos</option>
              <option value="DIRECT">Venta directa</option>
              {affiliateOptions.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conciliación
            <select
              value={filters.reconciliation}
              onChange={(event) =>
                patch({
                  reconciliation: event.target.value as SalesFilters['reconciliation'],
                })
              }
            >
              <option value="">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="reconciled">Conciliados</option>
            </select>
          </label>
        </div>
        {view.rangeError ? <p role="alert">{view.rangeError}</p> : null}
      </section>

      <div className="chip-row" role="tablist" aria-label="Secciones">
        {(
          [
            ['resumen', 'Resumen'],
            ['ventas', 'Ventas'],
            ...(role === 'OWNER' ? [['base', 'Base comercial'] as const] : []),
            ['conciliacion', 'Conciliación'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? 'chip chip-on' : 'chip'}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'resumen' ? (
      <section className="finance-panel" aria-label="Resumen">
        <h2>Qué se vendió y qué falta conciliar</h2>
        {view.unreconciledCount > 0 ? (
          <div className="reconcile-cta">
            <p>
              {view.unreconciledCount}{' '}
              {view.unreconciledCount === 1
                ? 'venta pendiente de conciliar'
                : 'ventas pendientes de conciliar'}
            </p>
            <button type="button" onClick={() => setSection('conciliacion')}>
              Conciliar ahora
            </button>
          </div>
        ) : null}
        <div className="kpi-grid">
        <Kpi testId="kpi-paid" label="Ventas aprobadas" value={String(view.paidCount)} />
        <Kpi
          testId="kpi-revenue"
          label="Ingreso bruto aprobado"
          value={formatMoney(view.revenueCents)}
          hint="Pagadas, conciliadas y pendientes."
        />
        <Kpi
          testId="kpi-costs"
          label="Costos registrados"
          value={formatMoney(view.processingCostCents)}
          hint="Solo filas de conciliación ya capturadas."
        />
        <Kpi
          testId="kpi-net"
          label="Ingreso neto conciliado"
          value={formatMoney(view.netRevenueCents)}
          hint="Bruto de las pagadas ya conciliadas, menos sus costos."
        />
        <Kpi
          testId="kpi-pending-gross"
          label="Bruto pendiente de conciliar"
          value={formatMoney(view.pendingGrossCents)}
          hint="Pagadas sin fila financiera. No entra al neto."
        />
        <Kpi
          testId="kpi-unreconciled"
          label="Pendientes de conciliar"
          value={String(view.unreconciledCount)}
          hint="Un cero explícito no cuenta como pendiente."
        />
        </div>
        <PeriodPanorama
          orders={snapshot.orders}
          legacy={legacy}
          eventCode={eventCode}
          filters={filters}
          now={clock}
          source={source}
        />
        <FunnelBlock
          orders={snapshot.orders}
          legacy={legacy}
          funnel={funnel}
          eventCode={eventCode}
          filters={filters}
          now={clock}
          source={source}
        />
        <div className="kpi-grid kpi-secondary">
        <Kpi testId="kpi-created" label="Órdenes creadas" value={String(view.createdCount)} />
        <Kpi
          testId="kpi-pending"
          label="Pagos pendientes"
          value={String(view.preferencePending + view.paymentPending)}
          hint={`Preferencia ${view.preferencePending} · Pago pendiente ${view.paymentPending}`}
        />
        <Kpi testId="kpi-rejected" label="Rechazadas" value={String(view.rejectedCount)} />
        <Kpi
          testId="kpi-average"
          label="Ticket promedio"
          value={
            view.averageTicketCents == null ? '—' : formatMoney(view.averageTicketCents)
          }
        />
        <Kpi
          testId="kpi-participants"
          label="Participantes vendidos"
          value={String(view.participants)}
        />
        <Kpi
          testId="kpi-last"
          label="Última venta"
          value={view.lastSale ? formatWhen(view.lastSale.at) : '—'}
          hint={
            view.lastSale
              ? `${view.lastSale.trackingRef} · ${formatMoney(view.lastSale.totalCents)}`
              : 'Sin venta aprobada en el periodo'
          }
        />
        </div>
        <section className="finance-panel" data-testid="partner-sales-summary">
          <h2>Ventas por Community Partner</h2>
          <p className="muted">
            Ingreso de órdenes PAID con orders.total_cents. El escaneo no cuenta como venta.
          </p>
          {view.partners.some((row) => row.code) ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Estudio</th>
                    <th>Ventas PAID</th>
                    <th>Participantes</th>
                    <th>Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {view.partners.filter((row) => row.code).map((row) => (
                    <tr key={row.key}>
                      <td>
                        <button
                          type="button"
                          className="linkish partner-action"
                          onClick={() => {
                            setSection('ventas')
                            patch({ affiliate: row.code ?? '' })
                          }}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td>{row.sales}</td>
                      <td>{row.participants}</td>
                      <td>{formatMoney(row.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Sin ventas PAID atribuidas en el periodo.</p>
          )}
        </section>
      </section>
      ) : null}

      {section === 'ventas' ? (
      <>
      <div className="chip-row" aria-label="Modo de ventas">
        <button type="button" className={salesMode === 'current' ? 'chip chip-on' : 'chip'} onClick={() => setSalesMode('current')}>Ventas actuales</button>
        {role === 'OWNER' ? (
          <button type="button" className={salesMode === 'legacy' ? 'chip chip-on' : 'chip'} onClick={() => setSalesMode('legacy')}>Ventas históricas</button>
        ) : null}
      </div>
      {salesMode === 'legacy' && role === 'OWNER' ? (
        <section className="finance-panel">
          <HistoricalSales orders={snapshot.orders} legacy={legacy} eventCode={eventCode} filters={filters} now={clock} />
        </section>
      ) : null}
      {salesMode === 'current' ? (
      <>
      <section className="finance-panel">
        <CurrentOpportunities orders={snapshot.orders} eventCode={eventCode} filters={filters} now={clock} />
      </section>
      <section className="finance-panel">
        <h2>Reporte comercial</h2>
        <p className="muted">Qué se vendió en el periodo. Aquí no se capturan costos.</p>
        {view.series.length === 0 ? (
          <p className="muted">Sin ventas aprobadas en el periodo.</p>
        ) : (
          <div className="day-charts">
            <div>
              <h3>Ventas por día</h3>
              <p className="muted">Número de operaciones</p>
              <div className="bars" data-testid="sales-series">
                {view.series.map((point) => (
                  <div key={point.day} className="bar-col">
                    <div
                      className="bar"
                      style={{ height: Math.max(4, Math.round((point.sales / salesMax) * 120)) }}
                      title={`${point.day}: ${point.sales} ventas`}
                    />
                    <span>{point.sales}</span>
                    <span>{point.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Ingresos por día</h3>
              <p className="muted">MXN</p>
              <div className="bars" data-testid="revenue-series">
                {view.series.map((point) => (
                  <div key={point.day} className="bar-col">
                    <div
                      className="bar bar-money"
                      style={{ height: Math.max(4, Math.round((point.revenueCents / revenueMax) * 120)) }}
                      title={`${point.day}: ${formatMoney(point.revenueCents)}`}
                    />
                    <span>{formatMoney(point.revenueCents)}</span>
                    <span>{point.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {view.series.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption>Acumulado del periodo, día America/Mérida</caption>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Ventas</th>
                    <th>Ingresos</th>
                    <th>Ventas acumuladas</th>
                    <th>Ingresos acumulados</th>
                  </tr>
                </thead>
                <tbody>
                  {view.series.map((point) => (
                    <tr key={point.day}>
                      <td>{point.day}</td>
                      <td>{point.sales}</td>
                      <td>{formatMoney(point.revenueCents)}</td>
                      <td>{point.cumulativeSales}</td>
                      <td>{formatMoney(point.cumulativeRevenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        ) : null}
      </section>

      <section className="finance-panel">
        <h2>Ventas por producto</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Producto</th>
                <th>Código</th>
                <th>Bloque</th>
                <th>Ventas</th>
                <th>Ingresos</th>
                <th>Participantes</th>
                <th>% ventas</th>
                <th>% ingresos</th>
              </tr>
            </thead>
            <tbody>
              {view.products.map((row) => (
                <tr key={row.productCode}>
                  <td>{row.groupLabel}</td>
                  <td>{row.productName}</td>
                  <td>{row.productCode}</td>
                  <td>{row.block}</td>
                  <td>{row.sales}</td>
                  <td>{formatMoney(row.revenueCents)}</td>
                  <td>{row.participants}</td>
                  <td>{percent(row.salesShare)}</td>
                  <td>{percent(row.revenueShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="finance-panel">
        <h2>Etapa comercial pública</h2>
        <p className="muted">
          Es la etapa de calendario guardada en la orden. No indica el precio
          de Community Partner.
        </p>
        <ul className="plain-list">
          {view.stages.map((row) => (
            <li key={row.stage}>
              {row.stage}: {row.sales} ventas · {formatMoney(row.revenueCents)}
            </li>
          ))}
          {view.stages.length === 0 ? <li>Sin ventas en el periodo.</li> : null}
        </ul>
      </section>

      <section className="finance-panel">
        <h2>Community Partners</h2>
        <p className="muted">
          El neto del partner solo incluye ventas ya conciliadas. Una orden sin
          fila no se trata como costo cero. La comisión del procesador no es una
          comisión al partner.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>Ventas</th>
                <th>Bruto aprobado</th>
                <th>Neto conciliado</th>
                <th>Bruto pendiente</th>
                <th>Pendientes</th>
                <th>Participantes</th>
                <th>Ticket promedio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {view.partners.map((row) => (
                <tr key={row.key}>
                  <td>{row.name}</td>
                  <td>{row.sales}</td>
                  <td>{formatMoney(row.revenueCents)}</td>
                  <td>{formatMoney(row.netRevenueCents)}</td>
                  <td>{formatMoney(row.pendingGrossCents)}</td>
                  <td>{row.unreconciledCount}</td>
                  <td>{row.participants}</td>
                  <td>
                    {row.averageTicketCents == null
                      ? '—'
                      : formatMoney(row.averageTicketCents)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        setSection('ventas')
                        patch({ affiliate: row.code ?? 'DIRECT' })
                      }}
                    >
                      Ver órdenes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="finance-panel">
        <h2>Pagos por proveedor</h2>
        {view.providers.length === 0 ? (
          <p className="muted">Sin pagos en las órdenes del periodo.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Aprobados</th>
                  <th>Monto</th>
                  <th>Pending</th>
                  <th>Rejected</th>
                  <th>Cancelled</th>
                  <th>Refunded</th>
                  <th>Charged back</th>
                </tr>
              </thead>
              <tbody>
                {view.providers.map((row) => (
                  <tr key={row.provider}>
                    <td>{row.provider}</td>
                    <td>{row.approved}</td>
                    <td>{formatMoney(row.approvedCents)}</td>
                    <td>{row.pending}</td>
                    <td>{row.rejected}</td>
                    <td>{row.cancelled}</td>
                    <td>{row.refunded}</td>
                    <td>{row.chargedBack}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="finance-panel" data-testid="anomalies">
        <h2>Requieren atención</h2>
        {view.anomalies.length === 0 ? (
          <p className="muted">Sin incidencias en las órdenes del periodo.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Edad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {view.anomalies.map((row) => (
                  <tr key={row.id}>
                    <td>{row.type}</td>
                    <td>{shortId(row.orderId)}</td>
                    <td>{row.buyer}</td>
                    <td>{formatMoney(row.amountCents)}</td>
                    <td>{formatAge(row.at, clock.getTime())}</td>
                    <td>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => setSelectedId(row.orderId)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="finance-panel finance-orders">
        <div className="panel-title">
          <h2>Órdenes</h2>
          <button type="button" onClick={exportCsv} data-testid="export-csv">
            Exportar CSV
          </button>
        </div>
        <p className="muted">{view.table.length} órdenes en el filtro.</p>
        <div className="table-wrap finance-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Participantes</th>
                <th>Bruto</th>
                <th>Comisión</th>
                <th>IVA comisión</th>
                <th>Otros costos</th>
                <th>Neto</th>
                <th>Conciliación</th>
                <th>Estado</th>
                <th>Proveedor</th>
                <th>Community Partner</th>
                <th>Código</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onOpen={() => setSelectedId(order.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="order-cards">
          {pageRows.map((order) => (
            <button
              key={order.id}
              type="button"
              className="order-card"
              onClick={() => setSelectedId(order.id)}
            >
              <strong>{order.buyerName || shortId(order.id)}</strong>
              <span>{productLabel(order)}</span>
              <span>
                Bruto {formatMoney(order.totalCents)} · {stateLabel(order.state)}
              </span>
              <span>
                {order.affiliateName || (order.affiliateCode ? order.affiliateCode : '—')}
                {order.affiliateCode ? ` · ${order.affiliateCode}` : ''}
              </span>
              <span>
                Comisión {moneyOrDash(order.adjustment?.providerFeeCents)} · IVA{' '}
                {moneyOrDash(order.adjustment?.providerFeeTaxCents)} · Otros{' '}
                {moneyOrDash(order.adjustment?.otherCostsCents)}
              </span>
              <span>
                Neto {moneyOrDash(netRevenueCents(order))} · {reconciliationLabel(order)}
              </span>
            </button>
          ))}
        </div>
        <div className="chip-row">
          <button
            type="button"
            className="chip"
            disabled={safePage === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Anterior
          </button>
          <span className="muted">
            Página {safePage + 1} de {pageCount}
          </span>
          <button
            type="button"
            className="chip"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
      </>
      ) : null}
      </>
      ) : null}

      {section === 'base' && role === 'OWNER' ? (
        <CommercialDirectory orders={snapshot.orders} legacy={legacy} eventCode={eventCode} role={role} />
      ) : null}

      {section === 'conciliacion' ? (
        <section className="finance-panel" data-testid="reconcile-queue">
          <h2>Conciliación financiera</h2>
          <p className="muted">
            Cuánto costó procesar las ventas ya pagadas. El neto es el bruto menos
            los costos que registres. No cambia la orden ni el pago.
          </p>
          <p className="muted" data-testid="legacy-finance-note">
            El histórico Legacy se muestra en el panorama comercial y no forma parte de la conciliación de pagos actual.
          </p>
          <div className="kpi-grid">
            <Kpi testId="queue-count" label="Pendientes de conciliar" value={String(view.unreconciledCount)} />
            <Kpi testId="queue-gross" label="Bruto pendiente" value={formatMoney(view.pendingGrossCents)} />
            <Kpi testId="queue-costs" label="Costos registrados" value={formatMoney(view.processingCostCents)} />
            <Kpi testId="queue-net" label="Neto conciliado" value={formatMoney(view.netRevenueCents)} />
          </div>
          {pendingOrders.length === 0 ? (
            <p className="muted">No hay ventas pagadas pendientes de conciliar en este periodo.</p>
          ) : (
            pendingOrders.map((order) => (
              <ReconcileCard
                key={order.id}
                order={order}
                onSave={onSaveAdjustment}
                onOpen={() => setSelectedId(order.id)}
              />
            ))
          )}
        </section>
      ) : null}

      {selected ? (
        <OrderDetail
          order={selected}
          onClose={() => setSelectedId(null)}
          onSave={onSaveAdjustment}
        />
      ) : null}
    </div>
  )
}

function ReconcileCard({
  order,
  onSave,
  onOpen,
}: {
  order: SalesOrder
  onSave?: (input: SaveAdjustmentInput) => Promise<void>
  onOpen: () => void
}) {
  const payment = approvedPayment(order) ?? order.payments[0] ?? null
  return (
    <article className="reconcile-card" data-testid={`reconcile-${order.trackingRef || order.id}`}>
      <div className="panel-title">
        <div>
          <p className="kpi-label">Pendiente de conciliar</p>
          <h3>{order.buyerName || 'Sin cliente'}</h3>
          <p className="muted">
            {formatWhen(order.createdAt)} · {order.trackingRef || shortId(order.id)} · {productLabel(order)}
          </p>
          <p>
            {payment?.provider ?? 'Sin proveedor'} · pago {payment?.providerPaymentId || '—'} · bruto {formatMoney(order.totalCents)}
          </p>
        </div>
        <button type="button" className="chip" onClick={onOpen}>
          Ver detalle
        </button>
      </div>
      <ReconciliationForm order={order} onSave={onSave} />
    </article>
  )
}

function Kpi({
  label,
  value,
  hint,
  testId,
}: {
  label: string
  value: string
  hint?: string
  testId: string
}) {
  return (
    <article className="kpi" data-testid={testId}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {hint ? <p className="muted">{hint}</p> : null}
    </article>
  )
}

function OrderRow({
  order,
  onOpen,
}: {
  order: SalesOrder
  onOpen: () => void
}) {
  const payment = order.payments.find((row) => row.normalizedState === 'APPROVED') ?? order.payments[0]
  return (
    <tr>
      <td>{formatWhen(order.createdAt)}</td>
      <td>
        <button type="button" className="linkish" onClick={onOpen}>
          {order.trackingRef || shortId(order.id)}
        </button>
      </td>
      <td>{order.buyerName || '—'}</td>
      <td>{productLabel(order)}</td>
      <td>{participantCount(order)}</td>
      <td>{formatMoney(order.totalCents)}</td>
      <td>{moneyOrDash(order.adjustment?.providerFeeCents)}</td>
      <td>{moneyOrDash(order.adjustment?.providerFeeTaxCents)}</td>
      <td>{moneyOrDash(order.adjustment?.otherCostsCents)}</td>
      <td>{moneyOrDash(netRevenueCents(order))}</td>
      <td>{reconciliationLabel(order)}</td>
      <td>
        <span className={`state state-${order.state}`}>{stateLabel(order.state)}</span>
      </td>
      <td>{payment?.provider ?? '—'}</td>
      <td>{order.affiliateCode ? (order.affiliateName || order.affiliateCode) : '—'}</td>
      <td>{order.affiliateCode ?? '—'}</td>
      <td>{payment?.providerPaymentId || '—'}</td>
    </tr>
  )
}

function OrderDetail({
  order,
  onClose,
  onSave,
}: {
  order: SalesOrder
  onClose: () => void
  onSave?: (input: SaveAdjustmentInput) => Promise<void>
}) {
  const payment =
    order.payments.find((row) => row.normalizedState === 'APPROVED') ??
    order.payments[0] ??
    null
  const timeline = buildTimeline(order)
  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <article
        className="detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        data-testid="order-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-title">
          <h2 id="order-detail-title">Detalle de orden</h2>
          <button type="button" className="chip" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <h3>Resumen</h3>
        <dl className="facts">
          <dt>Order id</dt>
          <dd>{order.id}</dd>
          <dt>Tracking</dt>
          <dd>{order.trackingRef}</dd>
          <dt>Estado</dt>
          <dd>{stateLabel(order.state)}</dd>
          <dt>Creada</dt>
          <dd>{formatWhen(order.createdAt)}</dd>
          <dt>Monto</dt>
          <dd>
            {formatMoney(order.totalCents)} {order.currency}
          </dd>
        </dl>
        <h3>Cliente</h3>
        <dl className="facts">
          <dt>Nombre</dt>
          <dd>{order.buyerName || '—'}</dd>
          <dt>Email</dt>
          <dd>{order.buyerEmail || '—'}</dd>
          <dt>Teléfono</dt>
          <dd>{order.buyerPhone || '—'}</dd>
        </dl>
        <h3>Producto</h3>
        {order.lines.map((line) => (
          <p key={line.productCode}>
            {line.productCode} · {line.productName} · cantidad {line.quantity} ·
            integrantes {line.teamSize}
          </p>
        ))}
        <p>Participantes representados: {participantCount(order)}</p>
        <h3>Atribución</h3>
        <dl className="facts" data-testid="order-attribution">
          <dt>Community Partner</dt>
          <dd>{order.affiliateCode ? (order.affiliateName || order.affiliateCode) : '—'}</dd>
          <dt>Código</dt>
          <dd>{order.affiliateCode ?? '—'}</dd>
        </dl>
        <p className="muted">
          Etapa comercial pública: {order.commercialStage || 'Sin etapa'}
        </p>
        <h3>Pago</h3>
        {payment ? (
          <dl className="facts">
            <dt>Proveedor</dt>
            <dd>{payment.provider}</dd>
            <dt>Payment id</dt>
            <dd>{payment.providerPaymentId || '—'}</dd>
            <dt>Estado</dt>
            <dd>{payment.normalizedState}</dd>
            <dt>Monto</dt>
            <dd>
              {payment.amountCents == null ? '—' : formatMoney(payment.amountCents)}
            </dd>
            <dt>Fecha del proveedor</dt>
            <dd>{formatWhen(payment.providerUpdatedAt)}</dd>
          </dl>
        ) : (
          <p className="muted">Sin pago registrado.</p>
        )}
        <ReconciliationForm order={order} onSave={onSave} />
        <h3>Boletos</h3>
        {order.tickets.length === 0 ? (
          <p className="muted">Sin boleto.</p>
        ) : (
          order.tickets.map((ticket) => (
            <div key={ticket.id} className="ticket-block">
              <p>
                {ticket.id} · estado del boleto: {ticket.state}
              </p>
              <p>Emitido: {formatWhen(ticket.issuedAt)}</p>
              <p>
                Envío: {ticket.emailState ?? 'sin job'}{' '}
                {ticket.emailResult ? `· ${ticket.emailResult}` : ''}
              </p>
            </div>
          ))
        )}
        <h3>Roster</h3>
        {order.roster.length === 0 ? (
          <p className="muted">Sin integrantes con nombre.</p>
        ) : (
          <ul>
            {order.roster.map((member, index) => (
              <li key={`${member.position ?? index}-${member.name ?? 'sin-nombre'}`}>
                {member.name || 'Sin nombre'}
                {member.role ? ` · ${member.role}` : ''}
              </li>
            ))}
          </ul>
        )}
        <h3>Timeline</h3>
        <ol className="timeline">
          {timeline.map((event) => (
            <li key={`${event.title}-${event.at}`}>
              <span>{formatWhen(event.at)}</span> {event.title}
              {event.detail ? ` · ${event.detail}` : ''}
            </li>
          ))}
        </ol>
      </article>
    </div>
  )
}

function actorName(label: string | null): string {
  const trimmed = label?.trim() ?? ''
  return trimmed || 'Usuario del dashboard'
}

function moneyOrDash(cents: number | null | undefined): string {
  return cents == null ? '—' : formatMoney(cents)
}

function pesosToCents(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, frac = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

function centsToPesos(cents: number): string {
  return (cents / 100).toFixed(2)
}

function ReconciliationForm({
  order,
  onSave,
}: {
  order: SalesOrder
  onSave?: (input: SaveAdjustmentInput) => Promise<void>
}) {
  const saved = order.adjustment
  const fallbackPayment = approvedPayment(order) ?? order.payments[0] ?? null
  const [paymentId, setPaymentId] = useState(saved?.paymentId ?? fallbackPayment?.id ?? '')
  const [fee, setFee] = useState(saved ? centsToPesos(saved.providerFeeCents) : '')
  const [tax, setTax] = useState(saved ? centsToPesos(saved.providerFeeTaxCents) : '')
  const [other, setOther] = useState(saved ? centsToPesos(saved.otherCostsCents) : '')
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const next = order.adjustment
    const payment = approvedPayment(order) ?? order.payments[0] ?? null
    setPaymentId(next?.paymentId ?? payment?.id ?? '')
    setFee(next ? centsToPesos(next.providerFeeCents) : '')
    setTax(next ? centsToPesos(next.providerFeeTaxCents) : '')
    setOther(next ? centsToPesos(next.otherCostsCents) : '')
    setNotes(next?.notes ?? '')
    setError(null)
  }, [order])

  const feeCents = pesosToCents(fee)
  const taxCents = pesosToCents(tax)
  const otherCents = pesosToCents(other)
  const draftNet =
    feeCents == null || taxCents == null || otherCents == null
      ? null
      : order.totalCents - feeCents - taxCents - otherCents
  const rate = effectiveFeeRate(order)
  const selectedPayment = order.payments.find((row) => row.id === paymentId) ?? fallbackPayment

  async function submit() {
    if (order.state !== 'PAID' || !onSave) {
      setError('No se puede guardar la conciliación.')
      return
    }
    if (!paymentId || feeCents == null || taxCents == null || otherCents == null) {
      setError('Captura importes en pesos, con cero explícito si no hay costo.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSave({
        orderId: order.id,
        paymentId,
        providerFeeCents: feeCents,
        providerFeeTaxCents: taxCents,
        otherCostsCents: otherCents,
        notes: notes.trim() ? notes.trim() : null,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la conciliación.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section data-testid="reconciliation">
      <h3>Conciliación financiera</h3>
      <dl className="facts">
        <dt>Monto bruto</dt>
        <dd>{formatMoney(order.totalCents)}</dd>
        <dt>Procesador</dt>
        <dd>{selectedPayment?.provider ?? '—'}</dd>
        <dt>Estado</dt>
        <dd>{reconciliationLabel(order)}</dd>
        <dt>Ingreso neto</dt>
        <dd>{moneyOrDash(saved ? netRevenueCents(order) : null)}</dd>
        <dt>Conciliado por</dt>
        <dd>{saved ? actorName(saved.createdByLabel) : '—'}</dd>
        <dt>Última modificación por</dt>
        <dd>{saved ? actorName(saved.updatedByLabel) : '—'}</dd>
        <dt>Fecha/hora</dt>
        <dd>{saved ? formatWhen(saved.updatedAt) : 'No capturado'}</dd>
      </dl>
      {rate != null ? (
        <p className="muted">
          Comisión efectiva {(rate * 100).toFixed(2)}% del bruto. Es informativa;
          el importe capturado es la fuente.
        </p>
      ) : null}
      {order.state !== 'PAID' ? (
        <p className="muted">La conciliación aplica a órdenes pagadas.</p>
      ) : order.payments.length === 0 ? (
        <p className="muted">Esta orden pagada no tiene un pago para conciliar.</p>
      ) : (
        <div className="filter-grid">
          {order.payments.length > 1 ? (
            <label>
              Pago
              <select value={paymentId} onChange={(event) => setPaymentId(event.target.value)}>
                {order.payments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.provider} · {row.providerPaymentId || row.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Comisión del procesador
            <input
              inputMode="decimal"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              aria-label="Comisión del procesador"
            />
          </label>
          <label>
            IVA de la comisión
            <input
              inputMode="decimal"
              value={tax}
              onChange={(event) => setTax(event.target.value)}
              aria-label="IVA de la comisión"
            />
          </label>
          <label>
            Otros costos
            <input
              inputMode="decimal"
              value={other}
              onChange={(event) => setOther(event.target.value)}
              aria-label="Otros costos"
            />
          </label>
          <label>
            Notas
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              aria-label="Notas de conciliación"
            />
          </label>
          <p data-testid="draft-net">
            Neto calculado: {draftNet == null ? '—' : formatMoney(draftNet)}
          </p>
          <button type="button" onClick={() => void submit()} disabled={pending}>
            Guardar conciliación
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      )}
    </section>
  )
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function uniqueLines(orders: SalesOrder[]): { code: string; name: string }[] {
  const map = new Map<string, string>()
  for (const order of orders) {
    for (const line of order.lines) map.set(line.productCode, line.productName)
  }
  return [...map.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

function uniqueProviders(orders: SalesOrder[]): string[] {
  const set = new Set<string>()
  for (const order of orders) {
    for (const payment of order.payments) set.add(payment.provider)
  }
  return [...set].sort()
}

function uniqueAffiliates(orders: SalesOrder[]): { code: string; name: string }[] {
  const map = new Map<string, string>()
  for (const order of orders) {
    if (order.affiliateCode) {
      map.set(order.affiliateCode, order.affiliateName || order.affiliateCode)
    }
  }
  return [...map.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function orderStates(orders: SalesOrder[]): string[] {
  return [...new Set(orders.map((order) => order.state))].sort()
}
