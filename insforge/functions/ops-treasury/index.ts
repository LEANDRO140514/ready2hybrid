import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import {
  classifyTreasuryIntent,
  planTreasuryWrite,
  roleMayUseTreasury,
} from '../_shared/treasury/write.ts'
import type { TreasuryBooks, TreasuryMovement } from '../../../src/treasury/books.ts'
import {
  gateRequestOrigin,
  originNotAllowedResponse,
  readConfiguredOrigin,
} from '../_shared/http/origin-guard.ts'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

const ALLOW_METHODS = 'POST, OPTIONS'
const ALLOW_HEADERS = 'Content-Type, Authorization'

function gateOrigin(req: Request) {
  const allowedOrigin = readConfiguredOrigin(env, 'OPS_DASHBOARD_CORS_ORIGIN', 'CHECKOUT_CORS_ORIGIN')
  return gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function integer(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

async function resolveActor(
  baseUrl: string,
  header: string | null,
): Promise<{ id: string; label: string } | null> {
  const match = /^Bearer\s+(\S+)/i.exec(header ?? '')
  if (!match?.[1]) return null
  const response = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${match[1]}` },
  })
  if (!response.ok) return null
  const body = (await response.json()) as { user?: { id?: unknown; email?: unknown } }
  const id = text(body.user?.id)
  if (!id) return null
  const email = text(body.user?.email).trim()
  return { id, label: email || id }
}

function toBooks(
  accounts: Record<string, unknown>[],
  categories: Record<string, unknown>[],
  movements: Record<string, unknown>[],
): TreasuryBooks {
  return {
    accounts: accounts.map((row) => ({
      id: text(row.id),
      name: text(row.name),
      active: row.active !== false,
      openingBalanceCents: integer(row.opening_balance_cents),
      openingDate: text(row.opening_date).slice(0, 10),
    })),
    categories: categories.map((row) => ({
      id: text(row.id),
      name: text(row.name),
      kind: row.kind === 'income' ? 'income' : 'expense',
      active: row.active !== false,
    })),
    movements: movements.map((row) => ({
      id: text(row.id),
      type: text(row.type) as TreasuryMovement['type'],
      status: text(row.status) as TreasuryMovement['status'],
      accountId: text(row.account_id),
      destinationAccountId: text(row.destination_account_id) || null,
      categoryId: text(row.category_id) || null,
      paymentMethod: (text(row.payment_method) || null) as TreasuryMovement['paymentMethod'],
      amountCents: integer(row.amount_cents),
      occurredOn: text(row.occurred_on).slice(0, 10),
      concept: text(row.concept),
      counterparty: text(row.counterparty) || null,
      notes: text(row.notes) || null,
      cancelReason: text(row.cancel_reason) || null,
      createdBy: text(row.created_by),
      createdAt: text(row.created_at),
      updatedBy: text(row.updated_by),
      updatedAt: text(row.updated_at),
    })),
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    const gate = gateOrigin(req)
    if (!gate.ok) {
      if (gate.kind === 'MISSING_CONFIG') {
        return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
      }
      return originNotAllowedResponse()
    }
    const { 'Content-Type': _type, 'Cache-Control': _cache, ...preflight } = gate.headers
    return new Response(null, { status: 204, headers: preflight })
  }

  const gate = gateOrigin(req)
  if (!gate.ok) {
    if (gate.kind === 'MISSING_CONFIG') {
      return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
    }
    return originNotAllowedResponse()
  }
  if (req.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, gate.headers)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'INVALID_REQUEST' }, gate.headers)
  }
  const intent = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { intent?: unknown }).intent
    : undefined
  const classified = classifyTreasuryIntent(intent)
  if (!classified.ok) return json(classified.status, { ok: false, error: classified.code }, gate.headers)

  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, gate.headers)

  const actor = await resolveActor(baseUrl, req.headers.get('authorization'))
  if (!actor) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)

  const admin = createAdminClient({ baseUrl, apiKey })
  const { data: readers, error: roleError } = await admin.database
    .from('dashboard_readers')
    .select('role')
    .eq('auth_user_id', actor.id)
    .limit(1)
  if (roleError) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  const role = Array.isArray(readers) ? (readers[0] as { role?: unknown } | undefined)?.role : null
  if (!roleMayUseTreasury(role)) return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)

  const [accountRows, categoryRows, movementRows] = await Promise.all([
    admin.database.from('treasury_accounts').select('*').limit(1000),
    admin.database.from('treasury_categories').select('*').limit(1000),
    admin.database.from('treasury_movements').select('*').limit(5000),
  ])
  if (accountRows.error || categoryRows.error || movementRows.error) {
    return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  }
  const books = toBooks(
    (accountRows.data ?? []) as Record<string, unknown>[],
    (categoryRows.data ?? []) as Record<string, unknown>[],
    (movementRows.data ?? []) as Record<string, unknown>[],
  )
  if (classified.intent === 'snapshot') {
    return json(200, { ok: true, books }, gate.headers)
  }

  const planned = planTreasuryWrite(books, { ...(body as object), intent: classified.intent }, actor.label)
  if (!planned.ok) return json(planned.status, { ok: false, error: planned.code }, gate.headers)
  const query = admin.database.from(planned.table)
  const result = planned.op === 'insert'
    ? await query.insert([planned.row])
    : await query.update(planned.row).eq('id', planned.id ?? '')
  if (result.error) return json(409, { ok: false, error: 'REJECTED' }, gate.headers)
  return json(200, { ok: true }, gate.headers)
}
