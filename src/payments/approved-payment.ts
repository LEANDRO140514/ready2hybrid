/**
 * Who produced the valid PAID transition, and the anomalies that follow.
 * Moved unchanged from the sales dashboard so payment tests do not import that UI model.
 */

export type ApprovedPaymentRow = {
  id: string
  provider: string
  providerPaymentId: string
  normalizedState: string
  amountCents: number | null
  providerUpdatedAt: string | null
  createdAt: string | null
}

export type ApprovedActivity = {
  at: string
  action: string
  result: string | null
  paymentRef?: string | null
}

export type ApprovedTicket = {
  issuedAt: string | null
  emailState: string | null
}

export type ApprovedVerification = {
  verifiedAt: string | null
  merchantOk: boolean | null
  referenceOk: boolean | null
  amountOk: boolean | null
  currencyOk: boolean | null
}

export type ApprovedOrder = {
  id: string
  state: string
  totalCents: number
  createdAt: string
  updatedAt: string | null
  expiresAt: string | null
  buyerName: string | null
  trackingRef: string
  paidPaymentId?: string | null
  payments: ApprovedPaymentRow[]
  activity: ApprovedActivity[]
  tickets: ApprovedTicket[]
  verifications: ApprovedVerification[]
}

export type Anomaly = {
  id: string
  orderId: string
  type: string
  buyer: string
  amountCents: number
  at: string | null
}

function isSale(order: ApprovedOrder): boolean {
  return order.state === 'PAID'
}

function buyerSummary(order: ApprovedOrder): string {
  const name = order.buyerName?.trim()
  if (name) return name
  return order.trackingRef || order.id.slice(0, 8)
}

/**
 * The payment that produced the valid PAID transition.
 * paid_payment_id wins. Otherwise the earliest WEBHOOK_PAYMENT_APPLIED / PAID
 * reference. A single APPROVED payment covers rows written before that
 * evidence. Several APPROVED payments without evidence are not guessed.
 */
export function approvedPayment(order: ApprovedOrder): ApprovedPaymentRow | null {
  if (order.paidPaymentId) {
    return order.payments.find((row) => row.id === order.paidPaymentId) ?? null
  }
  const winningRef = order.activity
    .filter((row) => row.action === 'WEBHOOK_PAYMENT_APPLIED' && row.result === 'PAID' && row.paymentRef)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]?.paymentRef
  if (winningRef) {
    return (
      order.payments.find((row) => row.providerPaymentId === winningRef) ?? null
    )
  }
  const approved = order.payments.filter((row) => row.normalizedState === 'APPROVED')
  if (approved.length === 1) return approved[0] ?? null
  return null
}

/** Reporting date. provider_updated_at, then WEBHOOK_PAYMENT_APPLIED / PAID. */
export function approvedAt(order: ApprovedOrder): string | null {
  const payment = approvedPayment(order)
  if (payment?.providerUpdatedAt) return payment.providerUpdatedAt
  const applied = order.activity
    .filter(
      (row) =>
        row.action === 'WEBHOOK_PAYMENT_APPLIED' && row.result === 'PAID',
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return applied.at(-1)?.at ?? null
}

export function anomaliesFor(order: ApprovedOrder, nowMs: number): Anomaly[] {
  const found: Anomaly[] = []
  const push = (type: string, at: string | null) => {
    found.push({
      id: `${order.id}:${type}`,
      orderId: order.id,
      type,
      buyer: buyerSummary(order),
      amountCents: order.totalCents,
      at,
    })
  }

  if (
    order.state === 'PAYMENT_PENDING' &&
    order.expiresAt &&
    Date.parse(order.expiresAt) < nowMs
  ) {
    push('Checkout vencido sigue en PAYMENT_PENDING', order.expiresAt)
  }

  const approved = approvedPayment(order)
  const approvedCount = order.payments.filter((row) => row.normalizedState === 'APPROVED').length
  if (approved && order.state !== 'PAID') {
    push('Pago APPROVED y la orden no está PAID', approved.providerUpdatedAt ?? approved.createdAt)
  }
  if (order.state === 'PAID' && approvedCount > 1 && !approved) {
    push('Proveedor ganador no determinado', order.updatedAt)
  }

  if (isSale(order) && !order.tickets.some((ticket) => ticket.issuedAt)) {
    push('Orden PAID sin boleto', approvedAt(order))
  }

  for (const ticket of order.tickets) {
    if (ticket.issuedAt && ticket.emailState !== 'SENT') {
      push('Boleto generado sin correo SENT', ticket.issuedAt)
    }
  }

  for (const payment of order.payments) {
    if (payment.amountCents != null && payment.amountCents !== order.totalCents) {
      push('Monto de la orden distinto al pago', payment.providerUpdatedAt ?? payment.createdAt)
      break
    }
  }

  const verificationFailed = order.verifications.some(
    (row) =>
      row.merchantOk === false ||
      row.referenceOk === false ||
      row.amountOk === false ||
      row.currencyOk === false,
  )
  const verificationActivity = order.activity.some(
    (row) => row.action === 'WEBHOOK_VERIFICATION_REJECTED',
  )
  if (verificationFailed || verificationActivity) {
    const at =
      order.verifications.find((row) => row.verifiedAt)?.verifiedAt ??
      order.activity.find((row) => row.action === 'WEBHOOK_VERIFICATION_REJECTED')?.at ??
      null
    push('Verificación de pago rechazada', at)
  }

  if (order.state === 'REQUIRES_REVIEW') {
    push('Orden en REQUIRES_REVIEW', order.updatedAt ?? order.createdAt)
  }

  if (isSale(order) && !approvedAt(order)) {
    push('Venta PAID sin fecha de aprobación', order.createdAt)
  }

  return found
}
