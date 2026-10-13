import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'
import {
  classifyLegacyReconcileRequest,
  hasCourtesyTag,
  legacyRowReconcilable,
  parseLegacyReconcileInput,
  roleMayReconcileLegacy,
} from '../_shared/legacy-reconcile/input.ts'
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
const ACTIVE_EVENT_CODE = 'HEX-2026'

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

type Row = Record<string, unknown>

function rows(data: unknown): Row[] {
  return Array.isArray(data)
    ? data.filter((item): item is Row => !!item && typeof item === 'object')
    : []
}

export default async function handler(req: Request): Promise<Response> {
  const allowedOrigin = readConfiguredOrigin(env, 'OPS_DASHBOARD_CORS_ORIGIN', 'CHECKOUT_CORS_ORIGIN')
  const gate = gateRequestOrigin({
    req,
    allowedOrigin,
    allowMethods: ALLOW_METHODS,
    allowHeaders: ALLOW_HEADERS,
    extraHeaders: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
  if (req.method === 'OPTIONS') {
    if (!gate.ok) {
      return gate.kind === 'MISSING_CONFIG'
        ? json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, { 'Content-Type': 'application/json' })
        : originNotAllowedResponse()
    }
    const { 'Content-Type': _type, 'Cache-Control': _cache, ...preflight } = gate.headers
    return new Response(null, { status: 204, headers: preflight })
  }
  if (!gate.ok) {
    return gate.kind === 'MISSING_CONFIG'
      ? json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, { 'Content-Type': 'application/json' })
      : originNotAllowedResponse()
  }
  if (req.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, gate.headers)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'INVALID_REQUEST' }, gate.headers)
  }
  const view =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { view?: unknown }).view
      : undefined
  const classified = classifyLegacyReconcileRequest(view)
  if (!classified.ok) {
    return json(classified.status, { ok: false, error: classified.code }, gate.headers)
  }

  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!baseUrl || !apiKey) return json(503, { ok: false, error: 'CONFIGURATION_ERROR' }, gate.headers)

  const match = /^Bearer\s+(\S+)/i.exec(req.headers.get('authorization') ?? '')
  if (!match?.[1]) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)

  try {
    const session = await fetch(`${baseUrl}/api/auth/sessions/current`, {
      headers: { Authorization: `Bearer ${match[1]}` },
    })
    if (!session.ok) return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)
    const sessionBody = (await session.json()) as { user?: { id?: unknown } }
    const userId = sessionBody.user?.id
    if (typeof userId !== 'string' || !userId) {
      return json(401, { ok: false, error: 'UNAUTHORIZED' }, gate.headers)
    }

    const admin = createAdminClient({ baseUrl, apiKey })
    const reader = await admin.database
      .from('dashboard_readers')
      .select('role')
      .eq('auth_user_id', userId)
      .limit(1)
    if (reader.error) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
    const role = Array.isArray(reader.data)
      ? (reader.data[0] as { role?: unknown } | undefined)?.role
      : null
    if (!roleMayReconcileLegacy(role)) return json(403, { ok: false, error: 'FORBIDDEN' }, gate.headers)

    if (classified.view === 'list') {
      const [legacy, done] = await Promise.all([
        admin.database
          .from('legacy_registrations')
          .select(
            'id,original_record_id,original_payment_id,category_name_raw,original_updated_at,amount_cents,notes_raw',
          )
          .eq('event_code', ACTIVE_EVENT_CODE)
          .eq('commercial_status', 'LEGACY_PAID'),
        admin.database
          .from('legacy_reconciliations')
          .select(
            'legacy_registration_id,provider,bank_reference,deposited_cents,provider_fee_cents,reconciled_at,updated_at',
          ),
      ])
      if (legacy.error || done.error) {
        return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
      }
      const byRegistration = new Map<string, Row>()
      for (const row of rows(done.data)) {
        if (typeof row.legacy_registration_id === 'string') {
          byRegistration.set(row.legacy_registration_id, row)
        }
      }
      // Free-text notes and contact data never leave this function.
      const out = rows(legacy.data).map((row) => {
        const found = byRegistration.get(String(row.id))
        return {
          id: row.id,
          recordRef: row.original_record_id,
          operationKey:
            typeof row.original_payment_id === 'string' && row.original_payment_id.trim()
              ? row.original_payment_id.trim()
              : null,
          categoryName: row.category_name_raw ?? null,
          paidAt: row.original_updated_at ?? null,
          grossCents: typeof row.amount_cents === 'number' ? row.amount_cents : null,
          courtesyTag: hasCourtesyTag(row.notes_raw),
          reconciliation: found
            ? {
              provider: found.provider,
              bankReference: found.bank_reference ?? null,
              depositedCents: found.deposited_cents,
              feeCents: found.provider_fee_cents,
              reconciledAt: found.reconciled_at,
              updatedAt: found.updated_at,
            }
            : null,
        }
      })
      return json(200, { ok: true, eventCode: ACTIVE_EVENT_CODE, rows: out }, gate.headers)
    }

    const parsed = parseLegacyReconcileInput(body)
    if (!parsed.ok) return json(parsed.status, { ok: false, error: parsed.code }, gate.headers)
    const input = parsed.input

    const registration = await admin.database
      .from('legacy_registrations')
      .select('id,commercial_status,amount_cents')
      .eq('id', input.legacyRegistrationId)
      .limit(1)
    if (registration.error) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
    const source = rows(registration.data)[0]
    if (!source) return json(404, { ok: false, error: 'REGISTRATION_NOT_FOUND' }, gate.headers)
    const reconcilable = legacyRowReconcilable({
      commercialStatus: source.commercial_status,
      amountCents: source.amount_cents,
    })
    if (!reconcilable.ok) {
      return json(reconcilable.status, { ok: false, error: reconcilable.code }, gate.headers)
    }
    if (input.depositedCents > reconcilable.grossCents) {
      return json(422, { ok: false, error: 'DEPOSIT_EXCEEDS_GROSS' }, gate.headers)
    }

    const existing = await admin.database
      .from('legacy_reconciliations')
      .select('id')
      .eq('legacy_registration_id', input.legacyRegistrationId)
      .limit(1)
    if (existing.error) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
    const existingId = rows(existing.data)[0]?.id
    const nowIso = new Date().toISOString()

    const write = typeof existingId === 'string'
      ? await admin.database
        .from('legacy_reconciliations')
        .update({
          provider: input.provider,
          bank_reference: input.bankReference,
          deposited_cents: input.depositedCents,
          notes: input.notes,
          updated_by: userId,
          updated_at: nowIso,
        })
        .eq('id', existingId)
      : await admin.database.from('legacy_reconciliations').insert([{
        legacy_registration_id: input.legacyRegistrationId,
        provider: input.provider,
        bank_reference: input.bankReference,
        gross_cents: reconcilable.grossCents,
        deposited_cents: input.depositedCents,
        notes: input.notes,
        reconciled_by: userId,
        reconciled_at: nowIso,
        updated_by: userId,
        updated_at: nowIso,
      }])
    if (write.error) return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
    return json(200, { ok: true }, gate.headers)
  } catch {
    return json(503, { ok: false, error: 'SERVICE_UNAVAILABLE' }, gate.headers)
  }
}
