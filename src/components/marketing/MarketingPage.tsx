import { useEffect, useMemo, useState } from 'react'

import {
  EMPTY_MARKETING_FILTERS,
  MARKETING_STATUS_LABEL,
  filterMarketingContacts,
  marketingContactsToCsv,
  marketingCounts,
  type MarketingFilters,
  type MarketingPayload,
  type MarketingStatus,
} from '../../sales-dashboard/marketing'
import { useSalesPort } from '../../sales-dashboard/port'

const PAGE_SIZE = 25

function formatDay(iso: string | null): string {
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

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100)
}

export function MarketingPage() {
  const port = useSalesPort()
  const [payload, setPayload] = useState<MarketingPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MarketingFilters>(EMPTY_MARKETING_FILTERS)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!port.loadContacts) {
      setError('La lista de contactos no está disponible en este entorno.')
      return
    }
    port
      .loadContacts()
      .then((next) => {
        if (!cancelled) setPayload(next)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'No se pudo leer la lista de contactos.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [port])

  const contacts = useMemo(() => payload?.contacts ?? [], [payload])
  const counts = useMemo(() => marketingCounts(contacts), [contacts])
  const filtered = useMemo(() => filterMarketingContacts(contacts, filters), [contacts, filters])

  if (error) {
    return <p role="alert" data-testid="marketing-error">{error}</p>
  }
  if (!payload) {
    return <p data-testid="marketing-loading">Cargando contactos…</p>
  }

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const anonymous = Math.max(0, payload.visitors - payload.identifiedVisitors)

  function patch(partial: Partial<MarketingFilters>) {
    setPage(0)
    setFilters((current) => ({ ...current, ...partial }))
  }

  function download() {
    const blob = new Blob([marketingContactsToCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contactos-marketing.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const statuses: MarketingStatus[] = ['PAID', 'PENDING', 'LEAD']

  return (
    <section className="finance-panel" data-testid="marketing-contacts" aria-label="Contactos para marketing">
      <p className="muted">
        {statuses.map((status) => `${counts[status]} ${MARKETING_STATUS_LABEL[status].toLowerCase()}`).join(' · ')}
      </p>
      <p className="muted" data-testid="marketing-visitors">
        {payload.visitors} visitantes en la landing. {anonymous} no dejaron datos de contacto y no pueden exportarse
        como lista; para ellos usa las audiencias del píxel. El consentimiento solo se registra en las órdenes
        nuevas: el histórico no lo tiene.
      </p>
      <div className="filter-grid">
        <label>
          Estado
          <select
            value={filters.status}
            onChange={(event) => patch({ status: event.target.value as MarketingFilters['status'] })}
          >
            <option value="all">Todos</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{MARKETING_STATUS_LABEL[status]}</option>
            ))}
          </select>
        </label>
        <label>
          Consentimiento
          <select
            value={filters.consent}
            onChange={(event) => patch({ consent: event.target.value as MarketingFilters['consent'] })}
          >
            <option value="all">Todos</option>
            <option value="recorded">Con consentimiento registrado</option>
            <option value="not-recorded">Sin consentimiento registrado</option>
          </select>
        </label>
        <label>
          Buscar
          <input
            value={filters.search}
            placeholder="Nombre, correo, teléfono o categoría"
            onChange={(event) => patch({ search: event.target.value })}
          />
        </label>
      </div>
      <div className="chip-row">
        <button type="button" className="chip" data-testid="marketing-export" onClick={download}>
          Exportar CSV
        </button>
        <span className="muted" data-testid="marketing-count">{filtered.length} contactos</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Categoría</th>
              <th>Pagado</th>
              <th>Última actividad</th>
              <th>Consentimiento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((contact) => (
              <tr key={contact.key} data-testid="marketing-row">
                <td>
                  {contact.name ?? 'Sin nombre'}
                  <br />
                  <span className="muted">{[contact.email, contact.phone].filter(Boolean).join(' · ')}</span>
                </td>
                <td>{MARKETING_STATUS_LABEL[contact.status]}</td>
                <td>{contact.categories.join(' · ') || '—'}</td>
                <td>{contact.paidCents ? formatMoney(contact.paidCents) : '—'}</td>
                <td>{formatDay(contact.lastAt)}</td>
                <td>{contact.consent === 'recorded' ? 'Registrado' : 'No registrado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chip-row">
        <button type="button" className="chip" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
          Anterior
        </button>
        <span className="muted">Página {safePage + 1} de {pages}</span>
        <button type="button" className="chip" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
          Siguiente
        </button>
      </div>
    </section>
  )
}
