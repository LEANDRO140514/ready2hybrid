import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import {
  runMetaCapiSync,
  type CapiRepo,
  type ClaimedRow,
  type DeliveryMode,
} from '../_shared/meta-capi/orchestrate'
import type { PurchaseContext, Touch } from '../_shared/meta-capi/event'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

type Admin = ReturnType<typeof createAdminClient>

function asRows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : []
}

function touchWithClickId(...touches: unknown[]): Touch | null {
  for (const touch of touches) {
    if (touch && typeof touch === 'object') {
      const record = touch as Record<string, unknown>
      if (typeof record.fbclid === 'string' && record.fbclid.trim()) {
        return {
          fbclid: record.fbclid,
          capturedAt: typeof record.capturedAt === 'string' ? record.capturedAt : undefined,
        }
      }
    }
  }
  return null
}

function createRepo(admin: Admin): CapiRepo {
  const table = () => admin.database.from('meta_capi_outbox')

  async function finish(id: string, fields: Record<string, unknown>): Promise<void> {
    const { error } = await table()
      .update({ ...fields, claimed_until: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error('OUTBOX_UPDATE_FAILED')
  }

  return {
    async enqueue(input: { since: string; mode: DeliveryMode }) {
      const { data, error } = await admin.database.rpc('meta_capi_enqueue_tx', { p: input })
      if (error || !data || typeof data !== 'object') throw new Error('ENQUEUE_FAILED')
      return Number((data as { enqueued?: unknown }).enqueued ?? 0)
    },

    async claim(input: { limit: number; mode: DeliveryMode }) {
      const { data, error } = await admin.database.rpc('meta_capi_claim_batch_tx', { p: input })
      if (error || !Array.isArray(data)) throw new Error('CLAIM_FAILED')
      return asRows(data).map(
        (row): ClaimedRow => ({
          id: String(row.id),
          orderId: String(row.order_id),
          eventId: String(row.event_id),
          attempts: Number(row.attempts ?? 1),
          approvedAt: typeof row.approved_at === 'string' ? row.approved_at : null,
        }),
      )
    },

    async loadContexts(orderIds: string[]) {
      const orders = await admin.database
        .from('orders')
        .select('id,tracking_ref,total_cents,buyer_contact_id')
        .in('id', orderIds)
      if (orders.error) throw new Error('READ_FAILED')
      const orderRows = asRows(orders.data)
      const buyerIds = [...new Set(orderRows.map((row) => String(row.buyer_contact_id)))]

      const [items, contacts, snapshots] = await Promise.all([
        admin.database.from('order_items').select('order_id,product_code').in('order_id', orderIds),
        admin.database.from('buyer_contacts').select('id,email,phone,contact_consent_at').in('id', buyerIds),
        admin.database.from('order_attribution_snapshots').select('order_id,first_touch,last_touch').in('order_id', orderIds),
      ])
      if (items.error || contacts.error || snapshots.error) throw new Error('READ_FAILED')

      const codesByOrder = new Map<string, string[]>()
      for (const row of asRows(items.data)) {
        const list = codesByOrder.get(String(row.order_id)) ?? []
        if (typeof row.product_code === 'string') list.push(row.product_code)
        codesByOrder.set(String(row.order_id), list)
      }
      const contactById = new Map(asRows(contacts.data).map((row) => [String(row.id), row]))
      const snapshotByOrder = new Map(asRows(snapshots.data).map((row) => [String(row.order_id), row]))

      const result = new Map<string, Omit<PurchaseContext, 'approvedAt'>>()
      for (const order of orderRows) {
        const orderId = String(order.id)
        const contact = contactById.get(String(order.buyer_contact_id))
        const snapshot = snapshotByOrder.get(orderId)
        result.set(orderId, {
          orderId,
          trackingRef: String(order.tracking_ref ?? ''),
          totalCents: Number(order.total_cents ?? 0),
          productCodes: codesByOrder.get(orderId) ?? [],
          buyerContactId: String(order.buyer_contact_id),
          contact: contact
            ? {
                email: typeof contact.email === 'string' ? contact.email : null,
                phone: typeof contact.phone === 'string' ? contact.phone : null,
                consent: contact.contact_consent_at != null,
              }
            : null,
          touch: touchWithClickId(snapshot?.last_touch, snapshot?.first_touch),
        })
      }
      return result
    },

    markSent: (id, fbtraceId) =>
      finish(id, { status: 'SENT', sent_at: new Date().toISOString(), fbtrace_id: fbtraceId, last_error: null }),
    markRetry: (id, nextAttempt, error) =>
      finish(id, { status: 'RETRY', next_attempt_at: nextAttempt.toISOString(), last_error: error }),
    markFailed: (id, error) => finish(id, { status: 'FAILED', last_error: error }),
    markSkipped: (id, reason) => finish(id, { status: 'SKIPPED', skip_reason: reason }),
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { status: 'error', code: 'METHOD_NOT_ALLOWED' })
  try {
    const baseUrl = env('INSFORGE_BASE_URL')
    const apiKey = env('API_KEY')
    if (!baseUrl || !apiKey) return jsonResponse(503, { status: 'error', code: 'BACKEND_NOT_CONFIGURED' })
    const result = await runMetaCapiSync(req, {
      env,
      repo: createRepo(createAdminClient({ baseUrl, apiKey })),
      fetch,
      now: () => new Date(),
      // Counts and opaque ids only: no tokens, emails or phones ever reach logs.
      log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
    })
    return jsonResponse(result.status, result.body)
  } catch {
    return jsonResponse(500, { status: 'error', code: 'INTERNAL_ERROR' })
  }
}
