import {
  type AccessLegacyInput,
  type AccessOrderInput,
} from './list'

type Row = Record<string, unknown>

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is Row => Boolean(row) && typeof row === 'object')
}

export type AccessTableInput = {
  orders: unknown
  payments: unknown
  manuals: unknown
  registrations: unknown
  participants: unknown
  members: unknown
  teams: unknown
  contacts: unknown
  tickets: unknown
  products: unknown
  legacy: unknown
}

export function accessInputsFromTables(tables: AccessTableInput): {
  orders: AccessOrderInput[]
  legacy: AccessLegacyInput[]
} {
  const contacts = new Map<string, Row>()
  for (const row of rows(tables.contacts)) {
    const id = text(row.id)
    if (id) contacts.set(id, row)
  }
  const participants = new Map<string, string>()
  for (const row of rows(tables.participants)) {
    const id = text(row.id)
    const name = text(row.name)
    if (id && name) participants.set(id, name)
  }
  const products = new Map<string, string>()
  for (const row of rows(tables.products)) {
    const code = text(row.code)
    const name = text(row.name)
    if (code && name) products.set(code, name)
  }
  const teams = new Map<string, Row>()
  for (const row of rows(tables.teams)) {
    const id = text(row.id)
    if (id) teams.set(id, row)
  }
  const manuals = new Set(rows(tables.manuals).map((row) => text(row.order_id)).filter((id): id is string => Boolean(id)))
  const paymentsByOrder = new Map<string, string[]>()
  for (const row of rows(tables.payments)) {
    if (row.normalized_state !== 'APPROVED') continue
    const orderId = text(row.order_id)
    const paymentId = text(row.provider_payment_id)
    if (!orderId || !paymentId) continue
    const list = paymentsByOrder.get(orderId) ?? []
    list.push(paymentId)
    paymentsByOrder.set(orderId, list)
  }
  const regsByOrder = new Map<string, Row[]>()
  for (const row of rows(tables.registrations)) {
    const orderId = text(row.order_id)
    if (!orderId) continue
    const list = regsByOrder.get(orderId) ?? []
    list.push(row)
    regsByOrder.set(orderId, list)
  }
  const membersByTeam = new Map<string, string[]>()
  for (const row of rows(tables.members)) {
    if (row.state === 'REMOVED' || row.state === 'REPLACED') continue
    const teamId = text(row.team_id)
    const participantId = text(row.participant_id)
    const name = participantId ? participants.get(participantId) : null
    if (!teamId || !name) continue
    const list = membersByTeam.get(teamId) ?? []
    list.push(name)
    membersByTeam.set(teamId, list)
  }
  const ticketsByReg = new Map<string, Row[]>()
  for (const row of rows(tables.tickets)) {
    const registrationId = text(row.registration_id)
    if (!registrationId) continue
    const list = ticketsByReg.get(registrationId) ?? []
    list.push(row)
    ticketsByReg.set(registrationId, list)
  }

  const orders: AccessOrderInput[] = []
  for (const row of rows(tables.orders)) {
    const id = text(row.id)
    const state = text(row.state)
    if (!id || !state) continue
    const contact = contacts.get(text(row.buyer_contact_id) ?? '')
    const regs = (regsByOrder.get(id) ?? []).filter((reg) =>
      state === 'PAID' ? reg.state !== 'CANCELLED' : true,
    )
    const groups = regs.length > 0 ? regs : [null]
    for (const reg of groups) {
      const productCode = reg ? text(reg.product_code) : null
      const teamId = reg ? text(reg.team_id) : null
      const team = teamId ? teams.get(teamId) : undefined
      const memberNames = teamId ? membersByTeam.get(teamId) ?? [] : []
      const soloId = reg ? text(reg.participant_id) : null
      const solo = soloId ? participants.get(soloId) : null
      const people = memberNames.length > 0 ? memberNames : solo ? [solo] : []
      const ticket = reg
        ? (ticketsByReg.get(text(reg.id) ?? '') ?? []).find((item) =>
          item.state === 'ISSUED' || item.state === 'REISSUED',
        )
        : undefined
      orders.push({
        id,
        state,
        manual: manuals.has(id),
        productCode,
        productName: productCode ? products.get(productCode) ?? null : null,
        team: text(team?.name),
        buyerName: text(contact?.name),
        buyerEmail: text(contact?.email),
        buyerPhone: text(contact?.phone),
        approvedPaymentIds: paymentsByOrder.get(id) ?? [],
        reference: text(ticket?.folio) ?? text(ticket?.id),
        people,
      })
    }
  }

  const legacy: AccessLegacyInput[] = rows(tables.legacy).map((row) => ({
    recordId: text(row.original_record_id) ?? text(row.id) ?? '',
    commercialStatus: text(row.commercial_status),
    courtesy: row.courtesy === true,
    name: text(row.original_name),
    email: text(row.original_email),
    phone: text(row.original_phone),
    categoryCode: text(row.normalized_product_code) ?? text(row.category_code_raw),
    categoryName: text(row.category_name_raw),
    teamName: text(row.team_name_raw),
    participants: text(row.participants_raw),
    paymentId: text(row.original_payment_id),
  })).filter((row) => row.recordId !== '')

  return { orders, legacy }
}
