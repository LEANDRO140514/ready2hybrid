import { useEffect, useMemo, useState } from 'react'

import {
  EMPTY_MARKETING_FILTERS,
  MARKETING_STATUS_LABEL,
  csvWithBom,
  filterMarketingContacts,
  buildMarketingBoard,
  buildMarketingSegments,
  marketingContactsToCsv,
  marketingCounts,
  marketingFileName,
  marketingSegmentCsv,
  type MarketingFilters,
  type MarketingPayload,
  type MarketingStatus,
} from '../../sales-dashboard/marketing'
import { useSalesPort } from '../../sales-dashboard/port'
import { meridaFileStamp } from '../../treasury/books'

const PAGE_SIZE = 25

function formatStamp(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Merida',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatPct(value: number): string {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`
}

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

export function MarketingPage({ example }: { example?: MarketingPayload } = {}) {
  const port = useSalesPort()
  const [payload, setPayload] = useState<MarketingPayload | null>(example ?? null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MarketingFilters>(EMPTY_MARKETING_FILTERS)
  const [page, setPage] = useState(0)
  const [loadedAt, setLoadedAt] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    if (example) return
    if (!port.loadContacts) {
      setError('La lista de contactos no está disponible en este entorno.')
      return
    }
    port
      .loadContacts()
      .then((next) => {
        if (cancelled) return
        setPayload(next)
        setLoadedAt(new Date())
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'No se pudo leer la lista de contactos.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [example, port])

  const contacts = useMemo(() => payload?.contacts ?? [], [payload])
  const counts = useMemo(() => marketingCounts(contacts), [contacts])
  const filtered = useMemo(() => filterMarketingContacts(contacts, filters), [contacts, filters])
  const segments = useMemo(() => buildMarketingSegments(contacts), [contacts])
  const board = useMemo(() => buildMarketingBoard(segments), [segments])

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

  function download(filename: string, csv: string) {
    const blob = new Blob([csvWithBom(csv)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const statuses: MarketingStatus[] = ['PAID', 'PENDING', 'LEAD']

  return (
    <section className="finance-panel" data-testid="marketing-contacts" aria-label="Contactos para marketing">
      <div data-testid="marketing-board" aria-label="Tablero de segmentos">
        <p className="muted" data-testid="marketing-updated">
          Actualizado al {formatStamp(loadedAt)} (hora de Mérida).
        </p>
        <p className="muted" data-testid="marketing-conversion">
          Conversión de leads a compradores: {formatPct(board.conversionPct)} ({board.buyers} compradores de{' '}
          {board.totalContacts} contactos que dejaron datos).
        </p>
        <div className="kpi-grid">
          {board.cards.map((card) => (
            <article key={card.key} className="kpi" data-testid={`segment-${card.key}`}>
              <h3 className="kpi-label">{card.label}</h3>
              <p className="kpi-value">
                <span data-testid={`segment-${card.key}-rows`}>{card.rows}</span> contactos
              </p>
              <p className="muted">
                {formatPct(card.pctEmail)} con correo · {formatPct(card.pctPhone)} con teléfono válido
              </p>
              <p className="muted">{card.use}</p>
              <button
                type="button"
                className="chip"
                data-testid={`download-${card.key}`}
                onClick={() =>
                  download(marketingFileName(card.key, new Date()), marketingSegmentCsv(card.key, segments))
                }
              >
                Descargar {card.label}
              </button>
            </article>
          ))}
        </div>
        <p className="muted" data-testid="marketing-overlap">
          Compradores ∩ Retargeting: {board.overlap} (por correo o teléfono; debe ser 0).
        </p>
        <details data-testid="marketing-suspicious">
          <summary>
            Teléfonos sospechosos: {board.suspiciousPhones} (11 dígitos que empiezan en 1 con lada mexicana; no se
            exportan)
          </summary>
          {segments.suspiciousPhones.length === 0 ? (
            <p className="muted">Ninguno.</p>
          ) : (
            <ul>
              {segments.suspiciousPhones.map((entry) => (
                <li key={entry.contact.key}>
                  {entry.contact.name ?? 'Sin nombre'} · {entry.contact.email ?? 'sin correo'} · {entry.contact.phone}
                </li>
              ))}
            </ul>
          )}
        </details>
        <p className="muted">
          Los archivos Meta incluyen email, phone, fn, ln, country, ct y st (ct y st quedan vacíos porque no se
          conocen). Excluyen cortesías, pruebas, reembolsos y contracargos, y se deduplican por correo. La
          compatibilidad de estos archivos con Meta está pendiente de una comprobación oficial o de una importación.
        </p>
      </div>
      <p className="muted">
        {statuses.map((status) => `${counts[status]} ${MARKETING_STATUS_LABEL[status].toLowerCase()}`).join(' · ')}
      </p>
      <p className="muted" data-testid="marketing-visitors">
        {payload.visitors} visitantes en la landing. {anonymous} no dejaron datos de contacto y no pueden exportarse
        como lista. Quien compró es PAID; quien no, es pendiente o dejó sus datos. La fecha de venta filtra a quien
        compró. Quien no compró se filtra por la fecha de registro. Legacy no tiene Community Partner ni consentimiento.
        Los filtros de abajo solo afectan la tabla y la descarga de la vista filtrada; los archivos del tablero
        siempre salen completos.
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
          Producto
          <input
            value={filters.product}
            placeholder="Categoría o producto"
            onChange={(event) => patch({ product: event.target.value })}
          />
        </label>
        <label>
          Venta desde
          <input type="date" value={filters.saleFrom} onChange={(event) => patch({ saleFrom: event.target.value })} />
        </label>
        <label>
          Venta hasta
          <input type="date" value={filters.saleTo} onChange={(event) => patch({ saleTo: event.target.value })} />
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
        <button
          type="button"
          className="chip"
          data-testid="export-base-general"
          onClick={() => download(`hex2026_vista-filtrada_${meridaFileStamp(new Date())}.csv`, marketingContactsToCsv(filtered))}
        >
          Descargar vista filtrada (base general)
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
              <th>Compras</th>
              <th>Productos comprados</th>
              <th>Pagado</th>
              <th>Fecha de venta</th>
              <th>Fecha de registro</th>
              <th>Fecha de importación</th>
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
                <td>{MARKETING_STATUS_LABEL[contact.status]}{contact.paymentCountedOnCurrent ? ' · pago ya contado' : ''}</td>
                <td>{contact.categories.join(' · ') || '—'}</td>
                <td>{contact.purchaseCount}</td>
                <td>{contact.purchasedProducts.join(' · ') || '—'}</td>
                <td>{contact.paidCents ? formatMoney(contact.paidCents) : '—'}</td>
                <td>{formatDay(contact.saleAt)}</td>
                <td>{formatDay(contact.registeredAt)}</td>
                <td>{formatDay(contact.importedAt)}</td>
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
