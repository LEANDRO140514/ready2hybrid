import { useEffect, useState, type FormEvent } from 'react'

import { useSalesPort } from '../../sales-dashboard/port'
import {
  formatMoney,
  formatWhen,
  participantCount,
  productLabel,
  stateLabel,
  type SalesOrder,
} from '../../sales-dashboard/model'
import type { CommunityPartner, PartnerProfile } from '../../partners/contract'
import { suggestPartnerCode } from '../../partners/contract'
import { partnerLandingUrl } from '../../partners/link'
import { metricsForPartner, ordersForPartner } from '../../partners/metrics'
import { usePartnersPort } from '../../partners/port'
import { downloadPartnerQrPng, drawPartnerQr } from '../../partners/qr'

type Editor = PartnerProfile & { code: string }

const EMPTY_EDITOR: Editor = {
  studioName: '',
  contactName: '',
  phone: '',
  email: '',
  code: '',
}

function toEditor(partner: CommunityPartner): Editor {
  return {
    studioName: partner.studioName,
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    code: partner.code,
  }
}

function profileFrom(editor: Editor): PartnerProfile {
  return {
    studioName: editor.studioName,
    contactName: editor.contactName,
    phone: editor.phone,
    email: editor.email,
  }
}

export function PartnersPage() {
  const partnersPort = usePartnersPort()
  const salesPort = useSalesPort()
  const [partners, setPartners] = useState<CommunityPartner[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editor, setEditor] = useState<Editor>(EMPTY_EDITOR)
  const [qrCode, setQrCode] = useState<string | null>(null)

  async function reload() {
    const [nextPartners, snapshot] = await Promise.all([
      partnersPort.list(),
      salesPort.loadSnapshot().catch(() => null),
    ])
    setPartners(nextPartners)
    setOrders(snapshot?.orders ?? [])
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reload()
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'No se pudo cargar Community Partners.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [partnersPort, salesPort])

  const selected = partners.find((partner) => partner.code === selectedCode) ?? null

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const created = await partnersPort.create(profileFrom(editor), editor.code)
      setPartners((current) => [created, ...current.filter((row) => row.code !== created.code)])
      setCreating(false)
      setSelectedCode(created.code)
      setNotice('Partner creado. El código queda fijo para el QR.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el partner.')
    }
  }

  async function onUpdate(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setError(null)
    try {
      const updated = await partnersPort.update(selected.code, profileFrom(editor))
      setPartners((current) => current.map((row) => (row.code === updated.code ? updated : row)))
      setEditing(false)
      setNotice('Datos del estudio actualizados. El código no cambió.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el partner.')
    }
  }

  async function toggleActive(partner: CommunityPartner) {
    setError(null)
    try {
      const updated = await partnersPort.setActive(partner.code, !partner.active)
      setPartners((current) => current.map((row) => (row.code === updated.code ? updated : row)))
      setNotice(updated.active
        ? 'Partner activo para nuevos checkouts.'
        : 'Partner inactivo. Las ventas ya atribuidas se conservan.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cambiar el estado.')
    }
  }

  async function copyLink(code: string) {
    const url = partnerLandingUrl(code)
    await navigator.clipboard.writeText(url)
    setNotice('Enlace copiado.')
  }

  return (
    <div className="finance" data-testid="partners-admin">
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}
      {loading ? <p>Cargando estudios…</p> : null}

      {!selected && !creating ? (
        <section className="finance-panel">
          <div className="panel-title">
            <h2>Community Partners</h2>
            <button
              type="button"
              className="partner-action"
              onClick={() => {
                setEditor(EMPTY_EDITOR)
                setCreating(true)
                setError(null)
              }}
            >
              Nuevo partner
            </button>
          </div>
          <PartnerTable
            partners={partners}
            orders={orders}
            onOpen={(code) => setSelectedCode(code)}
            onQr={setQrCode}
            onCopy={(code) => void copyLink(code)}
            onDownload={(code) => downloadPartnerQrPng(partnerLandingUrl(code), `${code}.png`)}
            onToggle={(partner) => void toggleActive(partner)}
          />
        </section>
      ) : null}

      {creating ? (
        <PartnerForm
          title="Nuevo partner"
          editor={editor}
          codeEditable
          onChange={setEditor}
          onSubmit={(event) => void onCreate(event)}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {selected && !creating ? (
        <PartnerDetail
          partner={selected}
          orders={ordersForPartner(orders, selected.code)}
          editing={editing}
          editor={editor}
          onEdit={() => {
            setEditor(toEditor(selected))
            setEditing(true)
          }}
          onCancelEdit={() => setEditing(false)}
          onChange={setEditor}
          onSubmit={(event) => void onUpdate(event)}
          onBack={() => {
            setSelectedCode(null)
            setEditing(false)
          }}
          onQr={() => setQrCode(selected.code)}
          onCopy={() => void copyLink(selected.code)}
          onDownload={() => downloadPartnerQrPng(partnerLandingUrl(selected.code), `${selected.code}.png`)}
          onToggle={() => void toggleActive(selected)}
        />
      ) : null}

      {qrCode ? (
        <QrDialog code={qrCode} onClose={() => setQrCode(null)} onCopy={() => void copyLink(qrCode)} />
      ) : null}
    </div>
  )
}

function PartnerTable({
  partners,
  orders,
  onOpen,
  onQr,
  onCopy,
  onDownload,
  onToggle,
}: {
  partners: CommunityPartner[]
  orders: SalesOrder[]
  onOpen: (code: string) => void
  onQr: (code: string) => void
  onCopy: (code: string) => void
  onDownload: (code: string) => void
  onToggle: (partner: CommunityPartner) => void
}) {
  if (partners.length === 0) return <p className="muted">Todavía no hay estudios registrados.</p>
  return (
    <>
      <div className="table-wrap partner-table">
        <table>
          <thead>
            <tr>
              <th>Estudio</th>
              <th>Código</th>
              <th>Estado</th>
              <th>Ventas PAID</th>
              <th>Participantes</th>
              <th>Ingreso atribuido</th>
              <th>Última venta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => {
              const metrics = metricsForPartner(orders, partner.code)
              return (
                <tr key={partner.code}>
                  <td>{partner.studioName}</td>
                  <td>{partner.code}</td>
                  <td>{partner.active ? 'Activo' : 'Inactivo'}</td>
                  <td>{metrics.paidSales}</td>
                  <td>{metrics.participants}</td>
                  <td>{formatMoney(metrics.revenueCents)}</td>
                  <td>{metrics.lastSaleAt ? formatWhen(metrics.lastSaleAt) : '—'}</td>
                  <td>
                    <PartnerActions
                      partner={partner}
                      onOpen={onOpen}
                      onQr={onQr}
                      onCopy={onCopy}
                      onDownload={onDownload}
                      onToggle={onToggle}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="partner-cards">
        {partners.map((partner) => {
          const metrics = metricsForPartner(orders, partner.code)
          return (
            <article key={partner.code} className="partner-card">
              <h3>{partner.studioName}</h3>
              <p>{partner.code} · {partner.active ? 'Activo' : 'Inactivo'}</p>
              <p>
                {metrics.paidSales} ventas PAID · {metrics.participants} participantes · {formatMoney(metrics.revenueCents)}
              </p>
              <p>Última venta: {metrics.lastSaleAt ? formatWhen(metrics.lastSaleAt) : '—'}</p>
              <PartnerActions
                partner={partner}
                onOpen={onOpen}
                onQr={onQr}
                onCopy={onCopy}
                onDownload={onDownload}
                onToggle={onToggle}
              />
            </article>
          )
        })}
      </div>
    </>
  )
}

function PartnerActions({
  partner,
  onOpen,
  onQr,
  onCopy,
  onDownload,
  onToggle,
}: {
  partner: CommunityPartner
  onOpen: (code: string) => void
  onQr: (code: string) => void
  onCopy: (code: string) => void
  onDownload: (code: string) => void
  onToggle: (partner: CommunityPartner) => void
}) {
  return (
    <div className="partner-actions">
      <button type="button" className="partner-action" onClick={() => onOpen(partner.code)}>Ver</button>
      <button type="button" className="partner-action" onClick={() => onQr(partner.code)}>Ver QR</button>
      <button type="button" className="partner-action" onClick={() => onCopy(partner.code)}>Copiar enlace</button>
      <button type="button" className="partner-action" onClick={() => onDownload(partner.code)}>Descargar QR</button>
      <button type="button" className="partner-action" onClick={() => onToggle(partner)}>
        {partner.active ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  )
}

function PartnerForm({
  title,
  editor,
  codeEditable,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string
  editor: Editor
  codeEditable: boolean
  onChange: (editor: Editor) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}) {
  function patch(partial: Partial<Editor>) {
    onChange({ ...editor, ...partial })
  }
  return (
    <section className="finance-panel">
      <h2>{title}</h2>
      <form className="partner-form" onSubmit={onSubmit}>
        <label>
          Nombre del estudio
          <input value={editor.studioName} required maxLength={120} onChange={(event) => patch({ studioName: event.target.value })} />
        </label>
        <label>
          Responsable
          <input value={editor.contactName} required maxLength={120} onChange={(event) => patch({ contactName: event.target.value })} />
        </label>
        <label>
          Teléfono / WhatsApp
          <input value={editor.phone} required maxLength={32} onChange={(event) => patch({ phone: event.target.value })} />
        </label>
        <label>
          Email
          <input type="email" value={editor.email} required maxLength={160} onChange={(event) => patch({ email: event.target.value })} />
        </label>
        <label>
          Código
          <input
            value={editor.code}
            required
            readOnly={!codeEditable}
            maxLength={12}
            onChange={(event) => patch({ code: event.target.value.toUpperCase() })}
          />
        </label>
        {codeEditable ? (
          <button
            type="button"
            className="partner-action"
            onClick={() => {
              const suggested = suggestPartnerCode(editor.studioName)
              if (suggested) patch({ code: suggested })
            }}
          >
            Sugerir código
          </button>
        ) : (
          <p className="muted">El código publicado no se edita. Un código nuevo es un partner nuevo.</p>
        )}
        <div className="partner-actions">
          <button type="submit" className="partner-action">Guardar</button>
          <button type="button" className="partner-action" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </section>
  )
}

function PartnerDetail({
  partner,
  orders,
  editing,
  editor,
  onEdit,
  onCancelEdit,
  onChange,
  onSubmit,
  onBack,
  onQr,
  onCopy,
  onDownload,
  onToggle,
}: {
  partner: CommunityPartner
  orders: SalesOrder[]
  editing: boolean
  editor: Editor
  onEdit: () => void
  onCancelEdit: () => void
  onChange: (editor: Editor) => void
  onSubmit: (event: FormEvent) => void
  onBack: () => void
  onQr: () => void
  onCopy: () => void
  onDownload: () => void
  onToggle: () => void
}) {
  const metrics = metricsForPartner(orders, partner.code)
  const url = partnerLandingUrl(partner.code)
  return (
    <div className="partner-detail" data-testid="partner-detail">
      <div className="partner-actions">
        <button type="button" className="partner-action" onClick={onBack}>Volver</button>
        <button type="button" className="partner-action" onClick={onQr}>Ver QR</button>
        <button type="button" className="partner-action" onClick={onCopy}>Copiar enlace</button>
        <button type="button" className="partner-action" onClick={onDownload}>Descargar QR</button>
      </div>
      {editing ? (
        <PartnerForm
          title="Editar estudio"
          editor={editor}
          codeEditable={false}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onCancelEdit}
        />
      ) : (
        <section className="finance-panel">
          <div className="panel-title">
            <h2>Datos del estudio</h2>
            <button type="button" className="partner-action" onClick={onEdit}>Editar</button>
          </div>
          <dl className="facts">
            <dt>Estudio</dt>
            <dd>{partner.studioName}</dd>
            <dt>Responsable</dt>
            <dd>{partner.contactName || '—'}</dd>
            <dt>Teléfono / WhatsApp</dt>
            <dd>{partner.phone || '—'}</dd>
            <dt>Email</dt>
            <dd>{partner.email || '—'}</dd>
            <dt>Código</dt>
            <dd>{partner.code}</dd>
            <dt>Estado</dt>
            <dd>{partner.active ? 'Activo' : 'Inactivo'}</dd>
            <dt>Fecha de alta</dt>
            <dd>{formatWhen(partner.createdAt)}</dd>
          </dl>
          <button type="button" className="partner-action" onClick={onToggle}>
            {partner.active ? 'Desactivar' : 'Activar'}
          </button>
        </section>
      )}
      <section className="finance-panel">
        <h2>QR</h2>
        <QrCanvas url={url} />
        <p className="partner-link">{url}</p>
      </section>
      <section className="finance-panel">
        <h2>Contabilidad</h2>
        <dl className="facts">
          <dt>Ventas PAID</dt>
          <dd>{metrics.paidSales}</dd>
          <dt>Participantes</dt>
          <dd>{metrics.participants}</dd>
          <dt>Ingreso bruto atribuido</dt>
          <dd>{formatMoney(metrics.revenueCents)}</dd>
          <dt>Última venta</dt>
          <dd>{metrics.lastSaleAt ? formatWhen(metrics.lastSaleAt) : '—'}</dd>
        </dl>
      </section>
      <section className="finance-panel">
        <h2>Ventas atribuidas</h2>
        <div className="table-wrap partner-table">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Comprador</th>
                <th>Categoría</th>
                <th>Participantes</th>
                <th>Total real</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.trackingRef}</td>
                  <td>{order.buyerName || '—'}</td>
                  <td>{productLabel(order)}</td>
                  <td>{participantCount(order)}</td>
                  <td>{formatMoney(order.totalCents)}</td>
                  <td>{stateLabel(order.state)}</td>
                  <td>{formatWhen(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="partner-cards">
          {orders.map((order) => (
            <article key={order.id} className="partner-card">
              <h3>{order.trackingRef}</h3>
              <p>{order.buyerName || '—'} · {productLabel(order)}</p>
              <p>{participantCount(order)} participantes · {formatMoney(order.totalCents)}</p>
              <p>{stateLabel(order.state)} · {formatWhen(order.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function QrCanvas({ url }: { url: string }) {
  const [node, setNode] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (node) drawPartnerQr(node, url, 8)
  }, [node, url])
  return <canvas ref={setNode} className="partner-qr" aria-label="QR del estudio" />
}

function QrDialog({
  code,
  onClose,
  onCopy,
}: {
  code: string
  onClose: () => void
  onCopy: () => void
}) {
  const url = partnerLandingUrl(code)
  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <article
        className="detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-qr-title"
        data-testid="partner-qr"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="partner-qr-title">QR {code}</h2>
        <QrCanvas url={url} />
        <p className="partner-link">{url}</p>
        <div className="partner-actions">
          <button type="button" className="partner-action" onClick={onCopy}>Copiar enlace</button>
          <button type="button" className="partner-action" onClick={() => downloadPartnerQrPng(url, `${code}.png`)}>
            Descargar QR
          </button>
          <button type="button" className="partner-action" onClick={onClose}>Cerrar</button>
        </div>
      </article>
    </div>
  )
}
