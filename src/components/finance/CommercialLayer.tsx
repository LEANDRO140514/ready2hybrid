import { useMemo, useState } from 'react'

import type { OperationalRole } from '../../auth/types'
import { buildSourceLedger } from '../../sales-dashboard/source-ledger'
import {
  countedSalesToCsv,
  saleSourceLabel,
  type SalesReport,
} from '../../sales-dashboard/counted-sales'
import {
  contactsToCsv,
  contactSearchMatch,
  currentFunnel,
  EMPTY_DIRECTORY_FILTERS,
  eventCommercialTotals,
  filterContacts,
  HISTORICAL_ATTRIBUTION,
  interestSummary,
  isPairOrRelay,
  legacyFunnel,
  matchedCategory,
  matchedTeam,
  pageContacts,
  periodCommercial,
  phoneLooksIncomplete,
  recoverableOrders,
  registrationCountLabel,
  showDeclaredParticipants,
  buildContacts,
  contactMatchesSalesFilters,
  normalizeEmail,
  CURRENT_SOURCE,
  type CommercialContact,
  type CommercialSource,
  type ContactRegistration,
  type DirectoryFilters,
  type FunnelEvent,
  type LegacyRegistration,
} from '../../sales-dashboard/commercial'
import {
  formatMoney,
  formatWhen,
  matchesAttributes,
  productLabel,
  type SalesFilters,
  type SalesOrder,
} from '../../sales-dashboard/model'

const EMPTY_MANUAL_IDS: ReadonlySet<string> = new Set()

export function EventTotal({
  orders,
  legacy,
  eventCode,
  summary,
  manualSaleOrderIds = [],
  overrides = [],
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  summary?: { legacyPaid: number; legacyPending: number; legacyGrossCents: number } | null
  manualSaleOrderIds?: string[]
  overrides?: { legacyId: string; field: 'amount_cents'; valueCents: number; conflict: boolean }[]
}) {
  const computed = eventCommercialTotals(orders, legacy, eventCode)
  const identityKnown = !legacy.some((row) => !row.email && !row.buyerContactId)
  const ledger = buildSourceLedger({
    orders: orders.map((order) => ({
      id: order.id,
      state: order.state,
      totalCents: order.totalCents,
      email: order.buyerEmail,
      productCode: order.lines[0]?.productCode ?? null,
      approvedPaymentIds: order.payments
        .filter((payment) => payment.normalizedState === 'APPROVED')
        .map((payment) => payment.providerPaymentId),
    })),
    legacy: legacy.map((row) => ({
      id: row.id,
      commercialStatus: row.commercialStatus,
      email: row.email,
      productCode: row.categoryCode,
      amountCents: row.amountCents,
      paymentId: row.originalPaymentId ?? null,
      missingSince: row.missingSince ?? null,
    })),
    manualOrderIds: new Set(manualSaleOrderIds),
    overrides,
  })
  const totals = legacy.length === 0 && summary
    ? {
      ...computed,
      legacyPaid: summary.legacyPaid,
      legacyPendingRegistrations: summary.legacyPending,
      legacyGrossCents: summary.legacyGrossCents,
      knownPaid: computed.currentPaid + summary.legacyPaid,
      knownGrossCents: computed.currentGrossCents + summary.legacyGrossCents,
    }
    : {
      ...computed,
      knownPaid: ledger.confirmedSales,
      knownGrossCents: ledger.confirmedCents,
      currentPaid: ledger.currentSales,
      currentGrossCents: ledger.currentCents,
      legacyPaid: ledger.legacySales,
      legacyGrossCents: ledger.legacyCents,
    }
  const samePerson = ledger.review.filter((row) => row.kind === 'same-person-product').length
  return (
    <section className="finance-panel event-total" data-testid="event-total" aria-label="Acumulado del evento, sin filtros">
      <h2>Acumulado del evento, sin filtros</h2>
      <p className="muted">
        Historia comercial conocida de {eventCode}.
        Un mismo id de pago cuenta una sola vez. Persona y producto iguales, sin ese id, siguen en el total y van a revisión.
      </p>
      <div className="kpi-grid">
        <Kpi testId="event-known-paid" label="Inscripciones pagadas" value={String(totals.knownPaid)} hint="Actuales, resueltas a mano y históricas, después del cruce por id de pago." />
        <Kpi testId="event-known-gross" label="Monto comercial conocido" value={formatMoney(totals.knownGrossCents)} hint="Misma regla. No resta las coincidencias de persona y producto." />
        <Kpi testId="event-current-paid" label="Ventas actuales pagadas" value={String(totals.currentPaid)} hint={formatMoney(totals.currentGrossCents)} />
        <Kpi testId="event-manual-paid" label="Resueltas manualmente" value={String(ledger.manualSales)} hint={formatMoney(ledger.manualCents)} />
        <Kpi testId="event-current-people" label="Participantes confirmados actuales" value={String(totals.currentParticipants)} hint="Solo boletos/órdenes actuales. El histórico no se cuenta como personas." />
        <Kpi testId="event-legacy-paid" label="Inscripciones históricas pagadas" value={String(totals.legacyPaid)} hint={`${formatMoney(totals.legacyGrossCents)} reportados, sin los pagos ya contados en Ready2Hybrid`} />
        <Kpi testId="event-legacy-pending" label="Registros históricos pendientes" value={String(totals.legacyPendingRegistrations)} hint={identityKnown ? `${totals.legacyPendingPeople} contactos identificables sin compra conocida` : 'Los contactos identificables se calculan en la lectura OWNER'} />
        <Kpi testId="event-buyers" label="Compradores" value={identityKnown ? String(computed.buyers) : '—'} hint="Una persona por correo, en cualquiera de las dos fuentes. No es el número de inscripciones." />
        <Kpi testId="event-registrations" label="Inscripciones contadas" value={String(totals.currentParticipants + totals.legacyPaid)} hint="Participantes de las órdenes actuales más las inscripciones históricas que sí entraron al total." />
      </div>
      <p className="muted" data-testid="event-cross-review">
        {ledger.excludedLegacyIds.length} pagos históricos omitidos porque ya están en una orden actual.
        {' '}{samePerson} coincidencias de persona y producto a revisión, sin descontar.
      </p>
    </section>
  )
}

export function PeriodPanorama({
  orders,
  legacy,
  eventCode,
  filters,
  now,
  source,
  manualSaleOrderIds = EMPTY_MANUAL_IDS,
  report,
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  filters: SalesFilters
  now: Date
  source: CommercialSource
  manualSaleOrderIds?: ReadonlySet<string>
  report: SalesReport
}) {
  const period = periodCommercial(orders, legacy, eventCode, filters, now, source, manualSaleOrderIds)
  const totals = eventCommercialTotals(orders, legacy, eventCode)
  const identityKnown = !legacy.some((row) => !row.email && !row.buyerContactId)
  if (period.error) return <p role="alert">{period.error}</p>
  return (
    <div data-testid="commercial-panorama">
      <h3>Panorama comercial</h3>
      <p className="muted">
        El ingreso neto conciliado, los costos y el bruto pendiente de conciliar siguen siendo solo de Ready2Hybrid.
      </p>
      <div className="kpi-grid kpi-secondary">
        <Kpi testId="panorama-current-paid" label="Ventas Ready2Hybrid en el filtro" value={String(report.readyCount + report.manualCount)} hint="Fecha de venta dentro del periodo. Incluye las resueltas a mano." />
        <Kpi testId="panorama-legacy-paid" label="Inscripciones legacy en el filtro" value={String(report.legacyCount)} hint="Misma fecha de venta. Sin las que ya están en un pago de Ready2Hybrid." />
        <Kpi testId="panorama-known-paid" label="Ventas contadas en el filtro" value={String(report.count)} />
        <Kpi testId="panorama-current-pending" label="Checkouts actuales pendientes" value={String(period.currentPending)} />
        <Kpi testId="panorama-legacy-pending" label="Registros históricos pendientes" value={String(period.legacyPending)} />
        <Kpi testId="panorama-buyers" label="Compradores únicos" value={identityKnown ? String(totals.buyers) : '—'} hint="Del evento completo, una persona por correo. No cambia con el periodo." />
        <Kpi testId="panorama-opportunities" label="Contactos sin convertir" value={identityKnown ? String(totals.opportunities) : '—'} hint={identityKnown ? 'Del evento completo. No es la cola de recuperación del periodo.' : 'Hace falta la lectura con identidad de contacto'} />
        <Kpi testId="panorama-current-gross" label="Bruto Ready2Hybrid del filtro" value={formatMoney(report.readyCents + report.manualCents)} />
        <Kpi testId="panorama-legacy-gross" label="Bruto legacy del filtro" value={formatMoney(report.legacyCents)} />
        <Kpi testId="panorama-known-gross" label="Bruto contado del filtro" value={formatMoney(report.cents)} />
      </div>
    </div>
  )
}

export function FunnelBlock({
  orders,
  legacy,
  funnel,
  eventCode,
  filters,
  now,
  source,
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  funnel: FunnelEvent[]
  eventCode: string
  filters: SalesFilters
  now: Date
  source: CommercialSource
}) {
  const current = currentFunnel(orders, funnel, eventCode, filters, now)
  const historical = legacyFunnel(legacy, eventCode, filters, now)
  return (
    <div data-testid="commercial-funnel">
      {source !== 'legacy' ? (
        <>
          <h3>Funnel Ready2Hybrid</h3>
          <p className="muted">
            Visitantes distintos por visitor_id. Varias vistas de la misma persona cuentan como una. Órdenes y pagadas son órdenes distintas.
          </p>
          <div className="kpi-grid kpi-secondary">
            <Kpi testId="funnel-visitors" label="Visitantes" value={String(current.visitors)} />
            <Kpi testId="funnel-experience" label="Eligieron experiencia" value={String(current.experiences)} />
            <Kpi testId="funnel-checkout" label="Iniciaron checkout" value={String(current.checkouts)} />
            <Kpi testId="funnel-orders" label="Órdenes" value={String(current.orders)} />
            <Kpi testId="funnel-paid" label="Pagadas" value={String(current.paid)} />
          </div>
        </>
      ) : null}
      {source !== 'current' ? (
        <>
          <h3>Histórico legacy</h3>
          <p className="muted">
            El registro de emergencia no trae visitas ni campañas. Solo hay registros y confirmaciones de pago.
          </p>
          <div className="kpi-grid kpi-secondary">
            <Kpi testId="legacy-funnel-rows" label="Registros históricos" value={String(historical.registrations)} />
            <Kpi testId="legacy-funnel-paid" label="Confirmados históricos" value={String(historical.paid)} />
          </div>
        </>
      ) : null}
    </div>
  )
}

export function CurrentOpportunities({
  orders,
  legacy,
  eventCode,
  filters,
  now,
}: {
  orders: SalesOrder[]
  eventCode: string
  legacy: LegacyRegistration[]
  filters: SalesFilters
  now: Date
}) {
  const period = periodCommercial(orders, legacy, eventCode, filters, now, 'current')
  const pending = period.currentPendingOrders.filter((order) => matchesAttributes(order, filters))
  const recovery = recoverableOrders(pending, legacy, now)
  const expiredIds = new Set(recovery.expired.map((order) => order.id))
  const recoveryRows = [...recovery.open, ...recovery.expired]
  return (
    <div data-testid="current-opportunities">
      <h3>Oportunidades de recuperación</h3>
      <p className="muted">
        Personas que dejaron un checkout y no tienen una compra pagada en ninguna fuente.
        Una reserva vencida no es un pago en curso.
      </p>
      <p className="muted" data-testid="recovery-open">{recovery.open.length} checkouts todavía vigentes.</p>
      <p className="muted" data-testid="recovery-expired">{recovery.expired.length} reservas vencidas, sin compra posterior.</p>
      <div className="table-wrap finance-table">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Producto</th>
              <th>Monto</th>
              <th>Antigüedad</th>
              <th>Situación</th>
              <th>Primer toque</th>
              <th>Último toque</th>
              <th>Community Partner</th>
            </tr>
          </thead>
          <tbody>
            {recoveryRows.map((order) => (
              <tr key={order.id}>
                <td>{order.buyerName || '—'}</td>
                <td>{productLabel(order)}</td>
                <td>{formatMoney(order.totalCents)}</td>
                <td>{ageLabel(order.createdAt, now)}</td>
                <td>{expiredIds.has(order.id) ? 'Reserva vencida' : 'Checkout vigente'}</td>
                <td>{touchLabel(order.firstTouch)}</td>
                <td>{touchLabel(order.lastTouch)}</td>
                <td>{order.affiliateName || order.affiliateCode || 'Venta directa'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="commercial-cards">
        {recoveryRows.map((order) => (
          <article key={order.id} className="order-card">
            <strong>{order.buyerName || '—'}</strong>
            <span>{productLabel(order)}</span>
            <span>{formatMoney(order.totalCents)} · {ageLabel(order.createdAt, now)}</span>
            <span>{order.state}</span>
            <span>{order.affiliateName || order.affiliateCode || 'Venta directa'}</span>
          </article>
        ))}
      </div>
      {recoveryRows.length === 0 ? <p className="muted">No hay personas por recuperar en el periodo.</p> : null}
    </div>
  )
}

function ageLabel(iso: string, now: Date): string {
  const ms = now.getTime() - Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const days = Math.max(0, Math.floor(ms / 86_400_000))
  return days === 0 ? 'hoy' : `${days} días`
}

function touchLabel(touch: SalesOrder['firstTouch']): string {
  if (!touch?.source && !touch?.campaign) return '—'
  if (touch.source && touch.campaign) return `${touch.source} / ${touch.campaign}`
  return touch.source || touch.campaign || '—'
}

export function HistoricalSales({
  orders,
  legacy,
  eventCode,
  filters,
  now,
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  filters: SalesFilters
  now: Date
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const period = periodCommercial([], legacy, eventCode, filters, now, 'legacy')
  const buyers = new Set(
    buildContacts(orders, legacy, eventCode)
      .filter((contact) => contact.buyer)
      .flatMap((contact) => [normalizeEmail(contact.email), contact.key].filter((value): value is string => Boolean(value))),
  )
  const visible = period.error
    ? []
    : [
      ...period.legacyPendingRows,
      ...legacy.filter((row) => inSelected(row, filters, now, 'paid')),
    ]
  const open = visible.find((row) => row.id === openId) ?? null
  return (
    <div data-testid="historical-sales">
      <h3>Ventas históricas</h3>
      <p className="muted" data-testid="historical-note">
        Histórico Legacy. El sistema anterior no registraba atribución ni Community Partner de forma verificable. Cada fila es un registro de origen.
      </p>
      {period.error ? <p role="alert">{period.error}</p> : null}
      <div className="table-wrap finance-table commercial-table">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contacto</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const laterBuyer = row.originalStatus !== 'paid' && knownBuyer(row, buyers)
              return (
                <tr key={row.id} data-testid="historical-row">
                  <td>{formatDay(row.originalStatus === 'paid' ? row.originalUpdatedAt : row.originalCreatedAt)}</td>
                  <td>
                    <button type="button" className="linkish contact-cell" onClick={() => setOpenId(row.id)}>
                      <strong>{row.name ?? 'Sin nombre'}</strong>
                      <span className="contact-meta">{[row.email, row.phone].filter(Boolean).join(' · ') || '—'}</span>
                    </button>
                  </td>
                  <td>{row.categoryName ?? row.categoryCode ?? '—'}</td>
                  <td>
                    {row.originalStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                    {laterBuyer ? <span className="inbox-flag" data-testid="later-buyer">Compró después</span> : null}
                  </td>
                  <td>{row.amountCents == null ? '—' : formatMoney(row.amountCents)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="commercial-cards">
        {visible.map((row) => {
          const laterBuyer = row.originalStatus !== 'paid' && knownBuyer(row, buyers)
          return (
            <button key={row.id} type="button" className="order-card" data-testid="historical-row" onClick={() => setOpenId(row.id)}>
              <strong>{formatDay(row.originalStatus === 'paid' ? row.originalUpdatedAt : row.originalCreatedAt)}</strong>
              <span>{row.name ?? 'Sin nombre'}</span>
              <span className="contact-meta">{[row.email, row.phone].filter(Boolean).join(' · ')}</span>
              <span>{row.categoryName ?? '—'}</span>
              <span>{row.originalStatus === 'paid' ? 'Pagado' : 'Pendiente'}{laterBuyer ? ' · Compró después' : ''}</span>
              <span>{row.amountCents == null ? '—' : formatMoney(row.amountCents)}</span>
            </button>
          )
        })}
      </div>
      {visible.length === 0 ? <p className="muted">No hay registros históricos en el periodo.</p> : null}
      {open ? <LegacyDetail row={open} laterBuyer={open.originalStatus !== 'paid' && knownBuyer(open, buyers)} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function LegacyDetail({
  row,
  laterBuyer,
  onClose,
}: {
  row: LegacyRegistration
  laterBuyer: boolean
  onClose: () => void
}) {
  const paid = row.originalStatus === 'paid' || row.commercialStatus === 'LEGACY_PAID'
  const pair = isPairOrRelay(row.categoryCode, row.categoryName)
  const participants = showDeclaredParticipants(row.categoryCode, row.categoryName, row.participants, row.name)
  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <div className="detail" role="dialog" aria-modal="true" data-testid="legacy-detail" onClick={(event) => event.stopPropagation()}>
        <header className="panel-title">
          <h3>{row.name ?? 'Registro histórico'}</h3>
          <button type="button" className="chip" onClick={onClose}>Cerrar</button>
        </header>
        <dl className="facts">
          <dt>Correo</dt>
          <dd>{row.email ?? '—'}</dd>
          <dt>Teléfono</dt>
          <dd>
            {row.phone ?? '—'}
            {phoneLooksIncomplete(row.phone) ? <span className="inbox-flag">Teléfono incompleto</span> : null}
          </dd>
          <dt>Categoría</dt>
          <dd>{row.categoryName ?? row.categoryCode ?? '—'}</dd>
          <dt>Estado</dt>
          <dd>
            {paid ? 'Pagado' : 'Pendiente'}
            {laterBuyer ? ' · Compró después' : ''}
          </dd>
          <dt>Monto</dt>
          <dd>{row.amountCents == null ? '—' : formatMoney(row.amountCents)}</dd>
          <dt>Fecha de registro</dt>
          <dd>{formatWhen(row.originalCreatedAt)}</dd>
          <dt>Fecha de venta</dt>
          <dd>{paid ? formatWhen(row.originalUpdatedAt) : 'Sin confirmación de pago'}</dd>
          <dt>Fecha de importación</dt>
          <dd>{formatWhen(row.importedAt ?? null)}</dd>
          {pair && row.teamName?.trim() ? (
            <>
              <dt>Equipo</dt>
              <dd>{row.teamName}</dd>
            </>
          ) : null}
          {participants ? (
            <>
              <dt>Participantes declarados</dt>
              <dd>{row.participants}</dd>
            </>
          ) : null}
          {row.notes?.trim() ? (
            <>
              <dt>Notas</dt>
              <dd>{row.notes}</dd>
            </>
          ) : null}
          {row.hasPaymentId ? (
            <>
              <dt>Referencia de pago</dt>
              <dd>Presente en el registro histórico</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  )
}

function knownBuyer(row: LegacyRegistration, buyers: Set<string>): boolean {
  if (row.buyerContactId && buyers.has(row.buyerContactId)) return true
  const email = normalizeEmail(row.email)
  return email != null && buyers.has(email)
}

function inSelected(row: LegacyRegistration, filters: SalesFilters, now: Date, kind: 'paid' | 'pending'): boolean {
  const period = periodCommercial([], [row], row.eventCode, filters, now, 'legacy')
  if (period.error) return false
  return kind === 'paid' ? period.legacyPaid === 1 : period.legacyPending === 1
}

export function CommercialDirectory({
  orders,
  legacy,
  eventCode,
  role,
  salesFilters,
  now,
  manualSaleOrderIds = EMPTY_MANUAL_IDS,
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  role: OperationalRole | null
  salesFilters?: SalesFilters
  now?: Date
  manualSaleOrderIds?: ReadonlySet<string>
}) {
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_DIRECTORY_FILTERS)
  const [page, setPage] = useState(0)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const contacts = useMemo(
    () => buildContacts(orders, legacy, eventCode, manualSaleOrderIds),
    [orders, legacy, eventCode, manualSaleOrderIds],
  )
  const filtered = filterContacts(contacts, filters).filter((contact) => (
    salesFilters && now ? contactMatchesSalesFilters(contact, salesFilters, now) : true
  ))
  const categories = [...new Set(contacts.flatMap((contact) => contact.categories).filter(Boolean))].sort()
  const partners = [...new Set(contacts.map((contact) => contact.partnerLabel).filter(Boolean))].sort()
  const pageSize = 8
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pages - 1)
  const rows = pageContacts(filtered, safePage, pageSize)
  const open = contacts.find((contact) => contact.key === openKey) ?? null
  if (role !== 'OWNER') {
    return (
      <section className="finance-panel" data-testid="commercial-denied">
        <h2>Base comercial</h2>
        <p>El directorio de contactos está reservado a OWNER.</p>
      </section>
    )
  }
  return (
    <section className="finance-panel" data-testid="commercial-directory" aria-label="Base comercial">
      <h2>Base comercial</h2>
      <p className="muted">
        Cada registro de origen se conserva. Esta vista agrupa la actividad por contacto identificable; un correo histórico puede representar más de una persona. El Legacy no registraba consentimiento, atribución ni Community Partner de forma verificable.
      </p>
      <div className="filter-grid">
        <Select label="Audiencia" value={filters.audience} onChange={(audience) => patch({ audience: audience as DirectoryFilters['audience'] })} options={[['all', 'Todos'], ['buyers', 'Compradores'], ['opportunities', 'Oportunidades sin convertir']]} />
        <Select label="Origen" value={filters.origin} onChange={(origin) => patch({ origin: origin as DirectoryFilters['origin'] })} options={[['all', 'Todos'], ['current', 'Ready2Hybrid'], ['legacy', 'Legacy']]} />
        <Select label="Estado" value={filters.status} onChange={(status) => patch({ status: status as DirectoryFilters['status'] })} options={[['all', 'Todos'], ['CURRENT_PAID', 'Comprador actual'], ['LEGACY_PAID', 'Comprador histórico'], ['CURRENT_PENDING', 'Pendiente actual'], ['LEGACY_PENDING', 'Oportunidad histórica']]} />
        <Select label="Consentimiento" value={filters.consent} onChange={(consent) => patch({ consent: consent as DirectoryFilters['consent'] })} options={[['all', 'Todos'], ['recorded', 'Con consentimiento registrado'], ['not-recorded', 'Sin consentimiento registrado']]} />
        <Select label="Categoría / producto" value={filters.productCode} onChange={(productCode) => patch({ productCode })} options={[['', 'Todas'], ...categories.map((category) => [category, category] as [string, string])]} />
        <Select label="Community Partner" value={filters.partner} onChange={(partner) => patch({ partner })} options={[['', 'Todos'], ['historical', 'Sin atribución histórica'], ['direct', 'Venta directa'], ...partners.filter((partner) => partner !== HISTORICAL_ATTRIBUTION && partner !== 'Venta directa').map((partner) => [partner, partner] as [string, string])]} />
        <label>
          Buscar
          <input
            value={filters.search}
            placeholder="Buscar nombre, correo, teléfono, categoría o equipo"
            onChange={(event) => patch({ search: event.target.value })}
          />
        </label>
      </div>
      <div className="chip-row">
        <button type="button" className="chip" onClick={() => download(filtered)}>Exportar filtro</button>
        <span className="muted" data-testid="directory-count">{filtered.length} contactos identificables · {legacy.length} registros históricos</span>
      </div>
      <div className="table-wrap commercial-table">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Estado comercial</th>
              <th>Actividad / interés</th>
              <th>Registros</th>
              <th>Total pagado</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((contact) => (
              <DirectoryRow key={contact.key} contact={contact} query={filters.search} onOpen={() => setOpenKey(contact.key)} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="commercial-cards">
        {rows.map((contact) => (
          <button key={contact.key} type="button" className="order-card" data-testid="directory-card" onClick={() => setOpenKey(contact.key)}>
            <ContactSummary contact={contact} query={filters.search} />
            <span>{statusLabel(contact.status)}</span>
            <Interest contact={contact} query={filters.search} />
            <span>{registrationCountLabel(contact)}</span>
            <span>{contact.paidCents ? formatMoney(contact.paidCents) : contact.buyer ? 'Pago ya contado en Ready2Hybrid' : 'Sin pago confirmado'}</span>
            <span>{formatDay(contact.lastAt)}</span>
          </button>
        ))}
      </div>
      <div className="chip-row">
        <button type="button" className="chip" disabled={safePage === 0} onClick={() => setPage((current) => current - 1)}>Anterior</button>
        <span className="muted">Página {safePage + 1} de {pages}</span>
        <button type="button" className="chip" disabled={safePage >= pages - 1} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
      </div>
      {open ? <Journey contact={open} onClose={() => setOpenKey(null)} /> : null}
    </section>
  )

  function patch(partial: Partial<DirectoryFilters>) {
    setPage(0)
    setFilters((current) => ({ ...current, ...partial }))
  }
}

function DirectoryRow({
  contact,
  query,
  onOpen,
}: {
  contact: CommercialContact
  query: string
  onOpen: () => void
}) {
  return (
    <tr data-testid="directory-row">
      <td>
        <button type="button" className="linkish contact-cell" onClick={onOpen}>
          <ContactSummary contact={contact} query={query} />
        </button>
      </td>
      <td data-testid="directory-status">{statusLabel(contact.status)}</td>
      <td data-testid="directory-interest"><Interest contact={contact} query={query} /></td>
      <td data-testid="directory-records">{registrationCountLabel(contact)}</td>
      <td data-testid="directory-paid">{contact.paidCents ? formatMoney(contact.paidCents) : '—'}</td>
      <td>{formatDay(contact.lastAt)}</td>
    </tr>
  )
}

function ContactSummary({ contact, query }: { contact: CommercialContact; query: string }) {
  const hits = contactSearchMatch(contact, query)
  return (
    <span className="contact-cell">
      <strong><Mark text={contact.name ?? contact.email ?? 'Sin nombre'} query={query} active={hits.includes('name')} /></strong>
      {contact.sharedInbox ? <span className="inbox-flag" data-testid="shared-inbox">Buzón compartido / múltiples nombres</span> : null}
      <span className="contact-meta">
        <span><Mark text={contact.email ?? '—'} query={query} active={hits.includes('email')} /></span>
        {' · '}
        <span><Mark text={contact.phone ?? '—'} query={query} active={hits.includes('phone')} /></span>
      </span>
    </span>
  )
}

function Interest({ contact, query }: { contact: CommercialContact; query: string }) {
  const hits = contactSearchMatch(contact, query)
  const category = matchedCategory(contact, query)
  const team = matchedTeam(contact, query)
  const summary = interestSummary(contact.categories, category)
  return (
    <span>
      <Mark text={summary} query={query} active={hits.includes('category')} />
      {hits.includes('team') && team ? (
        <span className="contact-meta" data-testid="matched-team">
          Equipo: <Mark text={team} query={query} active />
        </span>
      ) : null}
    </span>
  )
}

function Mark({ text, query, active }: { text: string; query: string; active: boolean }) {
  const needle = query.trim()
  if (!active || !needle) return <>{text}</>
  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="search-hit" data-testid="search-hit">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}

function Journey({ contact, onClose }: { contact: CommercialContact; onClose: () => void }) {
  const partner = contact.partnerLabel !== HISTORICAL_ATTRIBUTION ? contact.partnerLabel : null
  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <div className="detail" role="dialog" aria-modal="true" data-testid="contact-journey" onClick={(event) => event.stopPropagation()}>
        <header className="panel-title">
          <h3>{contact.name ?? contact.email ?? 'Contacto'}</h3>
          <button type="button" className="chip" onClick={onClose}>Cerrar</button>
        </header>
        <dl className="facts">
          <dt>Nombres</dt>
          <dd>{contact.names.join(' · ') || '—'}</dd>
          {contact.sharedInbox ? (
            <>
              <dt>Correo</dt>
              <dd>
                {contact.email}
                <span className="inbox-flag">Este correo aparece asociado a varios nombres históricos.</span>
              </dd>
            </>
          ) : (
            <>
              <dt>Correo</dt>
              <dd>{contact.email ?? '—'}</dd>
            </>
          )}
          <dt>Teléfono</dt>
          <dd>
            {contact.phone ?? '—'}
            {phoneLooksIncomplete(contact.phone) ? <span className="inbox-flag">Teléfono incompleto</span> : null}
          </dd>
          <dt>Estado comercial</dt>
          <dd>{statusLabel(contact.status)}</dd>
          <dt>Origen</dt>
          <dd>{originLabel(contact)}</dd>
          {contact.consent === 'recorded' ? (
            <>
              <dt>Consentimiento</dt>
              <dd>Registrado</dd>
            </>
          ) : null}
          {partner ? (
            <>
              <dt>Community Partner</dt>
              <dd>{partner}</dd>
            </>
          ) : null}
          <dt>Total pagado</dt>
          <dd data-testid="journey-paid">{contact.paidCents ? formatMoney(contact.paidCents) : '—'}</dd>
          <dt>Registros</dt>
          <dd>{registrationCountLabel(contact)}</dd>
        </dl>
        <h4>Registros</h4>
        {contact.registrations.map((registration) => (
          <RegistrationCard key={`${registration.source}-${registration.id}`} registration={registration} />
        ))}
      </div>
    </div>
  )
}

function RegistrationCard({ registration }: { registration: ContactRegistration }) {
  const pair = isPairOrRelay(registration.categoryCode, registration.category)
  const participants = showDeclaredParticipants(
    registration.categoryCode,
    registration.category,
    registration.participants,
    registration.name,
  )
  const paid = registration.status === 'CURRENT_PAID' || registration.status === 'LEGACY_PAID'
  return (
    <article className="registration-card" data-testid="registration-card">
      <strong>{formatWhen(registration.at)} · {registration.category}</strong>
      <span>{registration.source === CURRENT_SOURCE ? 'Ready2Hybrid' : 'Legacy'} · {registrationStatus(registration.status)}</span>
      <span>{formatMoney(registration.amountCents)}</span>
      {paid && registration.confirmedAt ? <span>Confirmación: {formatWhen(registration.confirmedAt)}</span> : null}
      {pair && registration.teamName ? <span>Equipo: {registration.teamName}</span> : null}
      {participants ? <span>Participantes declarados: {registration.participants}</span> : null}
      {registration.notes ? <span>Notas: {registration.notes}</span> : null}
      {registration.hasPaymentId ? <span>Referencia de pago histórica: presente</span> : null}
    </article>
  )
}

function download(contacts: CommercialContact[]) {
  const blob = new Blob([contactsToCsv(contacts)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'base-comercial.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Merida',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(ms)
}

function statusLabel(status: CommercialContact['status']): string {
  if (status === 'CURRENT_PAID' || status === 'LEGACY_PAID') return 'Comprador'
  if (status === 'CURRENT_PENDING') return 'Pendiente actual'
  return 'Oportunidad'
}

function registrationStatus(status: CommercialContact['status']): string {
  if (status === 'CURRENT_PAID') return 'Pagado'
  if (status === 'LEGACY_PAID') return 'Pagado histórico'
  if (status === 'CURRENT_PENDING') return 'Pendiente actual'
  return 'Pendiente histórico'
}

function originLabel(contact: CommercialContact): string {
  if (contact.legacyRecordCount && contact.currentRecordCount) return 'Legacy + Ready2Hybrid'
  if (contact.legacyRecordCount) return 'Legacy'
  return 'Ready2Hybrid'
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, text]) => (
          <option key={id} value={id}>{text}</option>
        ))}
      </select>
    </label>
  )
}

export function SalesReportPanel({ report }: { report: SalesReport }) {
  const salesMax = Math.max(1, ...report.series.map((point) => point.sales))
  const revenueMax = Math.max(1, ...report.series.map((point) => point.revenueCents))
  function exportCsv() {
    const blob = new Blob([countedSalesToCsv(report.sales)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ventas-contadas.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="finance-panel" data-testid="counted-sales">
      <div className="panel-title">
        <h2>Ventas contadas</h2>
        <button type="button" onClick={exportCsv} data-testid="export-counted-csv">Exportar CSV</button>
      </div>
      <p className="muted">
        El periodo y el producto recortan estas cifras, la gráfica y el CSV.
        Fecha de venta: pago aprobado en Ready2Hybrid, o confirmación histórica en legacy.
        Fecha de registro: creación de la orden o del registro. Fecha de importación: entrada de la copia legacy.
        Esa importación no mueve el periodo. Community Partner solo existe en Ready2Hybrid; con ese filtro, legacy no entra.
      </p>
      {report.error ? <p role="alert">{report.error}</p> : null}
      {report.series.length === 0 ? (
        <p className="muted">Sin ventas contadas en el filtro.</p>
      ) : (
        <div className="day-charts">
          <div>
            <h3>Ventas por día</h3>
            <p className="muted">Azul Ready2Hybrid, rosa legacy, amarillo resuelta a mano.</p>
            <div className="bars" data-testid="sales-series">
              {report.series.map((point) => (
                <div key={point.day} className="bar-col">
                  <div className="bar-stack" title={`${point.day}: ${point.ready} Ready2Hybrid, ${point.legacy} legacy, ${point.manual} manuales`}>
                    <div className="bar-part ready" style={{ height: Math.round((point.ready / salesMax) * 120) }} />
                    <div className="bar-part legacy" style={{ height: Math.round((point.legacy / salesMax) * 120) }} />
                    <div className="bar-part manual" style={{ height: Math.round((point.manual / salesMax) * 120) }} />
                  </div>
                  <span>{point.sales}</span>
                  <span>{point.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Ingresos por día</h3>
            <p className="muted">MXN, misma regla de cruce</p>
            <div className="bars" data-testid="revenue-series">
              {report.series.map((point) => (
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
      <div className="table-wrap">
        <table>
          <caption>Por producto, dentro del filtro</caption>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Ready2Hybrid</th>
              <th>Legacy</th>
              <th>Manual</th>
              <th>Contadas</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.products.map((row) => (
              <tr key={row.productCode}>
                <td>{row.productName}</td>
                <td>{row.ready}</td>
                <td>{row.legacy}</td>
                <td>{row.manual}</td>
                <td>{row.sales}</td>
                <td>{formatMoney(row.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table>
          <caption>Cada venta contada</caption>
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Fecha de venta</th>
              <th>Fecha de registro</th>
              <th>Fecha de importación</th>
              <th>Producto</th>
              <th>Monto</th>
              <th>Community Partner</th>
            </tr>
          </thead>
          <tbody>
            {report.sales.map((sale) => (
              <tr key={`${sale.source}-${sale.id}`}>
                <td>{saleSourceLabel(sale.source)}</td>
                <td>{formatWhen(sale.saleAt)}</td>
                <td>{formatWhen(sale.registeredAt)}</td>
                <td>{sale.source === 'legacy' ? formatWhen(sale.importedAt) : '—'}</td>
                <td>{sale.productName}</td>
                <td>{formatMoney(sale.amountCents)}</td>
                <td>{sale.partnerName ?? 'Sin atribución'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Kpi({ testId, label, value, hint }: { testId: string; label: string; value: string; hint?: string }) {
  return (
    <article className="kpi" data-testid={testId}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {hint ? <p className="muted">{hint}</p> : null}
    </article>
  )
}
