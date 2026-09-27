import { useMemo, useState } from 'react'

import type { OperationalRole } from '../../auth/types'
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
  registrationCountLabel,
  showDeclaredParticipants,
  buildContacts,
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
  productLabel,
  type SalesFilters,
  type SalesOrder,
} from '../../sales-dashboard/model'

export function EventTotal({
  orders,
  legacy,
  eventCode,
  summary,
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  summary?: { legacyPaid: number; legacyPending: number; legacyGrossCents: number } | null
}) {
  const computed = eventCommercialTotals(orders, legacy, eventCode)
  const identityKnown = !legacy.some((row) => !row.email && !row.buyerContactId)
  const totals = legacy.length === 0 && summary
    ? {
      ...computed,
      legacyPaid: summary.legacyPaid,
      legacyPendingRegistrations: summary.legacyPending,
      legacyGrossCents: summary.legacyGrossCents,
      knownPaid: computed.currentPaid + summary.legacyPaid,
      knownGrossCents: computed.currentGrossCents + summary.legacyGrossCents,
    }
    : computed
  return (
    <section className="finance-panel event-total" data-testid="event-total" aria-label="Total del evento">
      <h2>Total del evento</h2>
      <p className="muted">
        Historia comercial conocida de {eventCode}. No cambia con Hoy, 7 días, 30 días ni el rango.
      </p>
      <div className="kpi-grid">
        <Kpi testId="event-known-paid" label="Inscripciones pagadas" value={String(totals.knownPaid)} hint="Registros pagados actuales + históricos. No es el número de compradores." />
        <Kpi testId="event-known-gross" label="Monto comercial conocido" value={formatMoney(totals.knownGrossCents)} hint="Bruto actual + bruto histórico reportado" />
        <Kpi testId="event-current-paid" label="Ventas actuales pagadas" value={String(totals.currentPaid)} hint={formatMoney(totals.currentGrossCents)} />
        <Kpi testId="event-current-people" label="Participantes confirmados actuales" value={String(totals.currentParticipants)} hint="Solo boletos/órdenes actuales. El histórico no se cuenta como personas." />
        <Kpi testId="event-legacy-paid" label="Inscripciones históricas pagadas" value={String(totals.legacyPaid)} hint={`${formatMoney(totals.legacyGrossCents)} reportados`} />
        <Kpi testId="event-legacy-pending" label="Registros históricos pendientes" value={String(totals.legacyPendingRegistrations)} hint={identityKnown ? `${totals.legacyPendingPeople} contactos identificables sin compra conocida` : 'Los contactos identificables se calculan en la lectura OWNER'} />
      </div>
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
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  filters: SalesFilters
  now: Date
  source: CommercialSource
}) {
  const period = periodCommercial(orders, legacy, eventCode, filters, now, source)
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
        <Kpi testId="panorama-current-paid" label="Ventas actuales pagadas en el periodo" value={String(period.currentPaid)} />
        <Kpi testId="panorama-legacy-paid" label="Inscripciones históricas pagadas en el periodo" value={String(period.legacyPaid)} />
        <Kpi testId="panorama-known-paid" label="Inscripciones pagadas en el periodo" value={String(period.knownPaid)} />
        <Kpi testId="panorama-current-pending" label="Checkouts actuales pendientes" value={String(period.currentPending)} />
        <Kpi testId="panorama-legacy-pending" label="Registros históricos pendientes" value={String(period.legacyPending)} />
        <Kpi testId="panorama-buyers" label="Compradores únicos" value={identityKnown ? String(totals.buyers) : '—'} hint="Contactos identificables. No depende del rango ni del conteo de registros." />
        <Kpi testId="panorama-opportunities" label="Contactos sin convertir" value={identityKnown ? String(totals.opportunities) : '—'} hint={identityKnown ? 'Journeys comerciales, no registros repetidos' : 'Hace falta la lectura con identidad de contacto'} />
        <Kpi testId="panorama-current-gross" label="Bruto actual del periodo" value={formatMoney(period.currentGrossCents)} />
        <Kpi testId="panorama-legacy-gross" label="Bruto histórico reportado" value={formatMoney(period.legacyGrossCents)} />
        <Kpi testId="panorama-known-gross" label="Bruto comercial conocido del periodo" value={formatMoney(period.knownGrossCents)} />
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
  eventCode,
  filters,
  now,
}: {
  orders: SalesOrder[]
  eventCode: string
  filters: SalesFilters
  now: Date
}) {
  const period = periodCommercial(orders, [], eventCode, filters, now, 'current')
  const rows = period.currentPendingOrders
  return (
    <div data-testid="current-opportunities">
      <h3>Oportunidades actuales</h3>
      <p className="muted">
        Checkouts pendientes del periodo. Siguen en su estado. No se reactivan ni se marcan como pagados.
      </p>
      <div className="table-wrap finance-table">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Producto</th>
              <th>Monto</th>
              <th>Antigüedad</th>
              <th>Estado</th>
              <th>Primer toque</th>
              <th>Último toque</th>
              <th>Community Partner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id}>
                <td>{order.buyerName || '—'}</td>
                <td>{productLabel(order)}</td>
                <td>{formatMoney(order.totalCents)}</td>
                <td>{ageLabel(order.createdAt, now)}</td>
                <td>{order.state}</td>
                <td>{touchLabel(order.firstTouch)}</td>
                <td>{touchLabel(order.lastTouch)}</td>
                <td>{order.affiliateName || order.affiliateCode || 'Venta directa'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="commercial-cards">
        {rows.map((order) => (
          <article key={order.id} className="order-card">
            <strong>{order.buyerName || '—'}</strong>
            <span>{productLabel(order)}</span>
            <span>{formatMoney(order.totalCents)} · {ageLabel(order.createdAt, now)}</span>
            <span>{order.state}</span>
            <span>{order.affiliateName || order.affiliateCode || 'Venta directa'}</span>
          </article>
        ))}
      </div>
      {rows.length === 0 ? <p className="muted">No hay checkouts pendientes en el periodo.</p> : null}
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
          <dt>Creado</dt>
          <dd>{formatWhen(row.originalCreatedAt)}</dd>
          {paid ? (
            <>
              <dt>Confirmación histórica</dt>
              <dd>{formatWhen(row.originalUpdatedAt)}</dd>
            </>
          ) : null}
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
}: {
  orders: SalesOrder[]
  legacy: LegacyRegistration[]
  eventCode: string
  role: OperationalRole | null
}) {
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_DIRECTORY_FILTERS)
  const [page, setPage] = useState(0)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const contacts = useMemo(
    () => buildContacts(orders, legacy, eventCode),
    [orders, legacy, eventCode],
  )
  const filtered = filterContacts(contacts, filters)
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
            <span>{contact.paidCents ? formatMoney(contact.paidCents) : 'Sin pago confirmado'}</span>
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

function Kpi({ testId, label, value, hint }: { testId: string; label: string; value: string; hint?: string }) {
  return (
    <article className="kpi" data-testid={testId}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {hint ? <p className="muted">{hint}</p> : null}
    </article>
  )
}
