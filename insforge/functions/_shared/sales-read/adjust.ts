/** Manual processor-cost capture. Writes only payment_finance_adjustments. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type FinanceAdjustmentInput = {
  orderId: string
  paymentId: string
  providerFeeCents: number
  providerFeeTaxCents: number
  otherCostsCents: number
  notes: string | null
}

export type FinanceAdjustmentRow = FinanceAdjustmentInput & {
  id: string
  provider: string
  source: 'MANUAL'
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

type Reject = { ok: false; status: number; code: string }

export function parseFinanceAdjustmentInput(body: unknown):
  | { ok: true; input: FinanceAdjustmentInput }
  | Reject {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  const row = body as Record<string, unknown>
  const orderId = uuid(row.orderId)
  const paymentId = uuid(row.paymentId)
  const providerFeeCents = cents(row.providerFeeCents)
  const providerFeeTaxCents = cents(row.providerFeeTaxCents)
  const otherCostsCents = cents(row.otherCostsCents)
  const notes = notesOf(row.notes)
  if (
    !orderId ||
    !paymentId ||
    providerFeeCents == null ||
    providerFeeTaxCents == null ||
    otherCostsCents == null ||
    notes === undefined
  ) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST' }
  }
  return {
    ok: true,
    input: {
      orderId,
      paymentId,
      providerFeeCents,
      providerFeeTaxCents,
      otherCostsCents,
      notes,
    },
  }
}

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null
  return value
}

function notesOf(value: unknown): string | null | undefined {
  if (value == null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > 2000) return undefined
  return trimmed.length === 0 ? null : trimmed
}

type PaymentRef = { id: string; orderId: string; provider: string }
type ExistingAdjustment = { id: string; createdBy: string; createdAt: string }

export type FinanceAdjustmentStore = {
  findPayment: (paymentId: string) => Promise<PaymentRef | null>
  findOrderState: (orderId: string) => Promise<string | null>
  findAdjustment: (orderId: string) => Promise<ExistingAdjustment | null>
  insertAdjustment: (row: FinanceAdjustmentRow) => Promise<void>
  updateAdjustment: (
    id: string,
    patch: Omit<FinanceAdjustmentRow, 'id' | 'createdBy' | 'createdAt'>,
  ) => Promise<void>
}

export function nextFinanceAdjustment(input: {
  existing: ExistingAdjustment | null
  userId: string
  nowIso: string
  payment: PaymentRef
  amounts: FinanceAdjustmentInput
}): FinanceAdjustmentRow {
  return {
    id: input.existing?.id ?? crypto.randomUUID(),
    orderId: input.payment.orderId,
    paymentId: input.payment.id,
    provider: input.payment.provider,
    providerFeeCents: input.amounts.providerFeeCents,
    providerFeeTaxCents: input.amounts.providerFeeTaxCents,
    otherCostsCents: input.amounts.otherCostsCents,
    notes: input.amounts.notes,
    source: 'MANUAL',
    createdBy: input.existing?.createdBy ?? input.userId,
    createdAt: input.existing?.createdAt ?? input.nowIso,
    updatedBy: input.userId,
    updatedAt: input.nowIso,
  }
}

export async function saveFinanceAdjustment(
  store: FinanceAdjustmentStore,
  userId: string,
  input: FinanceAdjustmentInput,
  nowIso = new Date().toISOString(),
): Promise<{ ok: true } | Reject> {
  const payment = await store.findPayment(input.paymentId)
  if (!payment || payment.orderId !== input.orderId) {
    return { ok: false, status: 404, code: 'PAYMENT_NOT_FOUND' }
  }
  const state = await store.findOrderState(input.orderId)
  if (!state) return { ok: false, status: 404, code: 'ORDER_NOT_FOUND' }
  if (state !== 'PAID') return { ok: false, status: 409, code: 'ORDER_NOT_PAID' }

  const existing = await store.findAdjustment(input.orderId)
  const row = nextFinanceAdjustment({
    existing,
    userId,
    nowIso,
    payment,
    amounts: input,
  })
  if (existing) {
    const { id, createdBy, createdAt, ...patch } = row
    void createdBy
    void createdAt
    await store.updateAdjustment(id, patch)
  } else {
    await store.insertAdjustment(row)
  }
  return { ok: true }
}

type Row = Record<string, unknown>
type QueryResult = { data: unknown; error: { message?: string } | null }
type AdminLike = {
  database: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          limit: (n: number) => Promise<QueryResult>
        }
      }
      insert: (rows: unknown[]) => Promise<QueryResult>
      update: (patch: unknown) => {
        eq: (column: string, value: string) => Promise<QueryResult>
      }
    }
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

async function firstRow(result: QueryResult): Promise<Row | null> {
  if (result.error) throw new Error('ADJUSTMENT_IO')
  const row = Array.isArray(result.data) ? result.data[0] : null
  if (!row || typeof row !== 'object') return null
  return row as Row
}

export function adminFinanceStore(admin: AdminLike): FinanceAdjustmentStore {
  return {
    async findPayment(paymentId) {
      const row = await firstRow(
        await admin.database
          .from('payments')
          .select('id,order_id,provider')
          .eq('id', paymentId)
          .limit(1),
      )
      const id = text(row?.id)
      const orderId = text(row?.order_id)
      const provider = text(row?.provider)
      if (!row || !id || !orderId || !provider) return null
      return { id, orderId, provider }
    },
    async findOrderState(orderId) {
      const row = await firstRow(
        await admin.database
          .from('orders')
          .select('state')
          .eq('id', orderId)
          .limit(1),
      )
      return text(row?.state)
    },
    async findAdjustment(orderId) {
      const row = await firstRow(
        await admin.database
          .from('payment_finance_adjustments')
          .select('id,created_by,created_at')
          .eq('order_id', orderId)
          .limit(1),
      )
      const id = text(row?.id)
      const createdBy = text(row?.created_by)
      const createdAt = text(row?.created_at)
      if (!id || !createdBy || !createdAt) return null
      return { id, createdBy, createdAt }
    },
    async insertAdjustment(row) {
      const result = await admin.database.from('payment_finance_adjustments').insert([
        {
          id: row.id,
          order_id: row.orderId,
          payment_id: row.paymentId,
          provider: row.provider,
          provider_fee_cents: row.providerFeeCents,
          provider_fee_tax_cents: row.providerFeeTaxCents,
          other_costs_cents: row.otherCostsCents,
          notes: row.notes,
          source: row.source,
          created_by: row.createdBy,
          created_at: row.createdAt,
          updated_by: row.updatedBy,
          updated_at: row.updatedAt,
        },
      ])
      if (result.error) throw new Error('ADJUSTMENT_IO')
    },
    async updateAdjustment(id, patch) {
      const result = await admin.database
        .from('payment_finance_adjustments')
        .update({
          order_id: patch.orderId,
          payment_id: patch.paymentId,
          provider: patch.provider,
          provider_fee_cents: patch.providerFeeCents,
          provider_fee_tax_cents: patch.providerFeeTaxCents,
          other_costs_cents: patch.otherCostsCents,
          notes: patch.notes,
          source: patch.source,
          updated_by: patch.updatedBy,
          updated_at: patch.updatedAt,
        })
        .eq('id', id)
      if (result.error) throw new Error('ADJUSTMENT_IO')
    },
  }
}
