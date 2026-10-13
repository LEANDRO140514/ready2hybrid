type Row = Record<string, unknown>

export type SalesReadBundle = {
  orders: Row[]
  buyers: Row[]
  items: Row[]
  products: Row[]
  payments: Row[]
  registrations: Row[]
  tickets: Row[]
  outbox: Row[]
  verifications: Row[]
  activity: Row[]
  webhooks: Row[]
  affiliates: Row[]
  members: Row[]
  participants: Row[]
  adjustments: Row[]
  actors?: { id: string; label: string }[]
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requiredText(value: unknown, fallback = ''): string {
  return text(value) ?? fallback
}

function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function mapAdjustment(row: Row | undefined, labels: Map<string, string>) {
  if (!row) return null
  const id = text(row.id)
  const orderId = text(row.order_id)
  const paymentId = text(row.payment_id)
  const provider = text(row.provider)
  const source = text(row.source)
  const createdBy = text(row.created_by)
  const createdAt = text(row.created_at)
  const updatedBy = text(row.updated_by)
  const updatedAt = text(row.updated_at)
  const providerFeeCents = integer(row.provider_fee_cents)
  const providerFeeTaxCents = integer(row.provider_fee_tax_cents)
  const otherCostsCents = integer(row.other_costs_cents)
  if (
    !id ||
    !orderId ||
    !paymentId ||
    !provider ||
    (source !== 'MANUAL' && source !== 'PROVIDER') ||
    !createdBy ||
    !createdAt ||
    !updatedBy ||
    !updatedAt ||
    providerFeeCents == null ||
    providerFeeTaxCents == null ||
    otherCostsCents == null
  ) {
    return null
  }
  return {
    id,
    orderId,
    paymentId,
    provider,
    providerFeeCents,
    providerFeeTaxCents,
    otherCostsCents,
    notes: text(row.notes),
    source,
    createdBy,
    createdAt,
    updatedBy,
    updatedAt,
    createdByLabel: labels.get(createdBy) ?? null,
    updatedByLabel: labels.get(updatedBy) ?? null,
  }
}

function stageOf(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  return text((snapshot as Row).commercial_stage)
}

function indexBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const id = key(row)
    if (!id) continue
    const list = map.get(id) ?? []
    list.push(row)
    map.set(id, list)
  }
  return map
}

export function assembleSalesSnapshot(bundle: SalesReadBundle, generatedAt: string) {
  const buyers = new Map(
    bundle.buyers.map((row) => [requiredText(row.id), row]),
  )
  const products = new Map(
    bundle.products.map((row) => [requiredText(row.code), row]),
  )
  const affiliates = new Map(
    bundle.affiliates.map((row) => [requiredText(row.code), row]),
  )
  const participants = new Map(
    bundle.participants.map((row) => [requiredText(row.id), row]),
  )
  const itemsByOrder = indexBy(bundle.items, (row) => text(row.order_id))
  const paymentsByOrder = indexBy(bundle.payments, (row) => text(row.order_id))
  const regsByOrder = indexBy(bundle.registrations, (row) => text(row.order_id))
  const ticketsByReg = indexBy(bundle.tickets, (row) => text(row.registration_id))
  const outboxByTicket = new Map<string, Row>()
  for (const row of bundle.outbox) {
    const ref = text(row.domain_event_ref)
    const match = ref ? /^ticket:(.+)$/.exec(ref) : null
    if (match?.[1]) outboxByTicket.set(match[1], row)
  }
  const verificationsByOrder = indexBy(bundle.verifications, (row) => text(row.order_id))
  const membersByTeam = indexBy(bundle.members, (row) => text(row.team_id))
  const paymentIdToOrder = new Map<string, string>()
  const providerPaymentToOrder = new Map<string, string>()
  for (const row of bundle.payments) {
    const orderId = text(row.order_id)
    const paymentId = text(row.id)
    const providerPaymentId = text(row.provider_payment_id)
    if (orderId && paymentId) paymentIdToOrder.set(paymentId, orderId)
    if (orderId && providerPaymentId) providerPaymentToOrder.set(providerPaymentId, orderId)
  }
  const activityByOrder = indexBy(bundle.activity, (row) => {
    const ref = text(row.entity_ref)
    if (!ref) return null
    return paymentIdToOrder.get(ref) ?? providerPaymentToOrder.get(ref) ?? ref
  })
  const actorLabels = new Map(
    (bundle.actors ?? [])
      .filter((actor) => actor.id && actor.label)
      .map((actor) => [actor.id, actor.label] as const),
  )
  const adjustmentsByOrder = indexBy(bundle.adjustments, (row) => text(row.order_id))
  const webhooksByOrder = indexBy(bundle.webhooks, (row) => {
    const paymentId = text(row.payment_id)
    return paymentId ? paymentIdToOrder.get(paymentId) ?? null : null
  })

  const orders = bundle.orders.map((order) => {
    const id = requiredText(order.id)
    const buyer = buyers.get(requiredText(order.buyer_contact_id))
    const affiliateCode = text(order.affiliate_code)
    const affiliate = affiliateCode ? affiliates.get(affiliateCode) : undefined
    const lines = (itemsByOrder.get(id) ?? []).map((item) => {
      const code = requiredText(item.product_code)
      const product = products.get(code)
      return {
        productCode: code,
        productName: requiredText(product?.name, code),
        block: requiredText(product?.block, '—'),
        kind: requiredText(product?.kind, '—'),
        saleState: text(product?.sale_state),
        teamSize: integer(product?.team_size) ?? 1,
        quantity: integer(item.quantity) ?? 1,
      }
    })
    const regs = regsByOrder.get(id) ?? []
    const tickets = regs.flatMap((reg) => {
      const regId = requiredText(reg.id)
      return (ticketsByReg.get(regId) ?? []).map((ticket) => {
        const ticketId = requiredText(ticket.id)
        const job = outboxByTicket.get(ticketId)
        return {
          id: ticketId,
          state: requiredText(ticket.state, 'UNKNOWN'),
          issuedAt: text(ticket.issued_at),
          folio: text(ticket.folio),
          emailState: text(job?.state),
          emailResult: text(job?.result),
          emailUpdatedAt: text(job?.updated_at),
        }
      })
    })
    const roster = regs.flatMap((reg) => {
      const teamId = text(reg.team_id)
      if (teamId) {
        return (membersByTeam.get(teamId) ?? [])
          .slice()
          .sort((a, b) => (integer(a.position) ?? 0) - (integer(b.position) ?? 0))
          .map((member) => {
            const person = participants.get(requiredText(member.participant_id))
            return {
              name: text(person?.name),
              role: text(member.role),
              position: integer(member.position),
            }
          })
      }
      const person = participants.get(requiredText(reg.participant_id))
      if (!person) return []
      return [{ name: text(person.name), role: null, position: null }]
    })
    return {
      id,
      trackingRef: requiredText(order.tracking_ref, id),
      state: requiredText(order.state, 'UNKNOWN'),
      currency: requiredText(order.currency, 'MXN'),
      totalCents: integer(order.total_cents) ?? 0,
      createdAt: requiredText(order.created_at),
      updatedAt: text(order.updated_at),
      expiresAt: text(order.expires_at),
      affiliateCode,
      affiliateName: text(affiliate?.name),
      commercialStage: stageOf(order.commercial_snapshot),
      buyerName: text(buyer?.name),
      buyerEmail: text(buyer?.email),
      buyerPhone: text(buyer?.phone),
      lines,
      payments: (paymentsByOrder.get(id) ?? []).map((payment) => ({
        id: requiredText(payment.id),
        provider: requiredText(payment.provider, 'UNKNOWN'),
        providerPaymentId: requiredText(payment.provider_payment_id),
        normalizedState: requiredText(payment.normalized_state, 'UNKNOWN'),
        amountCents: integer(payment.amount_cents),
        providerUpdatedAt: text(payment.provider_updated_at),
        createdAt: text(payment.created_at),
      })),
      tickets,
      roster,
      activity: (activityByOrder.get(id) ?? []).flatMap((row) => {
        const at = text(row.created_at)
        const action = text(row.named_action)
        if (!at || !action) return []
        const meta = row.sanitized_metadata
        const paymentRef =
          meta && typeof meta === 'object' && !Array.isArray(meta)
            ? text((meta as Record<string, unknown>).provider_payment_id)
            : null
        return [{ at, action, result: text(row.result), paymentRef }]
      }),
      webhooks: (webhooksByOrder.get(id) ?? []).map((row) => ({
        receivedAt: text(row.received_at),
        processedAt: text(row.processed_at),
        signatureResult: text(row.signature_result),
        processingState: text(row.processing_state),
        result: text(row.result),
      })),
      verifications: (verificationsByOrder.get(id) ?? []).map((row) => ({
        verifiedAt: text(row.verified_at),
        merchantOk: bool(row.merchant_ownership_ok),
        referenceOk: bool(row.external_reference_ok),
        amountOk: bool(row.amount_ok),
        currencyOk: bool(row.currency_ok),
        normalizedResult: text(row.normalized_result),
      })),
      adjustment: mapAdjustment((adjustmentsByOrder.get(id) ?? [])[0], actorLabels),
    }
  })

  return { generatedAt, orders }
}
