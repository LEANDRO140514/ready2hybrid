import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'

import { buildDryRunReport, type DryRunContext, type DryRunMirrorRow } from '../../../src/legacy-sync/dry-run.ts'
import {
  collectSourcePages,
  planLegacySync,
  sourceCountQuery,
  sourcePageQuery,
  type MirrorRegistration,
  type SourceRegistration,
} from '../../../src/legacy-sync/plan.ts'

function env(key: string): string | undefined {
  return Deno.env.get(key) ?? undefined
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function secretsEqual(expected: string, actual: string): boolean {
  const left = new TextEncoder().encode(expected)
  const right = new TextEncoder().encode(actual)
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index]! ^ right[index]!
  return mismatch === 0
}

type SqlClient = {
  query: (sql: string) => Promise<Record<string, unknown>[]>
}

function assertReadQuery(query: string) {
  if (!query.startsWith('SELECT ') || /\b(insert|update|delete|drop|alter)\b/i.test(query)) {
    throw new Error('SOURCE_QUERY_REJECTED')
  }
}

async function readSql(baseUrl: string, apiKey: string, query: string): Promise<Record<string, unknown>[]> {
  assertReadQuery(query)
  const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`)
  const body = await response.json() as { rows?: Record<string, unknown>[]; result?: { rows?: Record<string, unknown>[] } }
  const rows = body.rows ?? body.result?.rows
  if (!Array.isArray(rows)) throw new Error('SOURCE_SHAPE')
  return rows
}

async function readSource(baseUrl: string, apiKey: string): Promise<SourceRegistration[]> {
  const counted = await readSql(baseUrl, apiKey, sourceCountQuery())
  const rawTotal = counted[0]?.total
  const total = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal)
  if (!Number.isInteger(total) || total < 0) throw new Error('SOURCE_COUNT_INVALID')
  const pages: SourceRegistration[][] = []
  let offset = 0
  while (offset < total) {
    const page = await readSql(baseUrl, apiKey, sourcePageQuery(offset)) as SourceRegistration[]
    pages.push(page)
    if (page.length === 0) break
    offset += page.length
  }
  return collectSourcePages(total, pages)
}

async function dryRunContext(sql: SqlClient): Promise<DryRunContext> {
  const [mirrorRows, reconciled, tickets, orders] = await Promise.all([
    sql.query(`SELECT id, original_record_id, commercial_status, original_payment_id, amount_cents, normalized_product_code, lower(original_email) AS email, missing_since FROM public.legacy_registrations WHERE source_system = 'LEGACY_HYBRID_REGISTRO'`),
    sql.query(`SELECT legacy_registration_id FROM public.legacy_reconciliations`),
    sql.query(`SELECT DISTINCT lower(bc.email) AS email FROM public.buyer_contacts bc JOIN public.orders o ON o.buyer_contact_id = bc.id JOIN public.registrations r ON r.order_id = o.id JOIN public.tickets t ON t.registration_id = r.id WHERE t.state IN ('ISSUED','REISSUED','USED')`),
    sql.query(`SELECT DISTINCT lower(bc.email) AS email FROM public.buyer_contacts bc JOIN public.orders o ON o.buyer_contact_id = bc.id WHERE o.state = 'PAID'`),
  ])
  const mirror: DryRunMirrorRow[] = mirrorRows.map((row) => ({
    id: String(row.id),
    recordId: String(row.original_record_id),
    commercialStatus: row.commercial_status == null ? null : row.commercial_status as DryRunMirrorRow['commercialStatus'],
    paymentId: row.original_payment_id == null || row.original_payment_id === '' ? null : String(row.original_payment_id),
    amountCents: row.amount_cents == null ? null : Number(row.amount_cents),
    productCode: row.normalized_product_code == null ? null : String(row.normalized_product_code),
    email: row.email == null ? null : String(row.email),
    missing: row.missing_since != null,
  }))
  return {
    mirror,
    reconciledIds: new Set(reconciled.map((row) => String(row.legacy_registration_id))),
    ticketEmails: new Set(tickets.map((row) => String(row.email))),
    paidOrderEmails: new Set(orders.map((row) => String(row.email))),
  }
}

export async function runLegacySync(
  sql: SqlClient,
  source: SourceRegistration[],
  catalogCodes: ReadonlySet<string>,
  options: { dryRun?: boolean } = {},
): Promise<unknown> {
  const [mirrorRows, overrideRows] = await Promise.all([
    sql.query(`SELECT original_record_id, source_hash, missing_since, commercial_status, import_disposition, review_reason FROM public.legacy_registrations WHERE source_system = 'LEGACY_HYBRID_REGISTRO'`),
    sql.query(`SELECT registration.original_record_id, override.field_name, override.source_value_at_override FROM public.legacy_field_overrides AS override JOIN public.legacy_registrations AS registration ON registration.id = override.legacy_registration_id`),
  ])
  const mirror: MirrorRegistration[] = mirrorRows.map((row) => ({
    originalRecordId: String(row.original_record_id),
    sourceHash: row.source_hash == null ? null : String(row.source_hash),
    missingSince: row.missing_since == null ? null : String(row.missing_since),
    commercialStatus: row.commercial_status == null ? null : row.commercial_status as MirrorRegistration['commercialStatus'],
    importDisposition: String(row.import_disposition),
    reviewReason: row.review_reason == null ? null : String(row.review_reason),
  }))
  const plan = planLegacySync({
    source,
    mirror,
    overrides: overrideRows.map((row) => ({
      originalRecordId: String(row.original_record_id),
      field: String(row.field_name) as 'amount_cents',
      sourceValueAtOverride: String(row.source_value_at_override),
    })),
    catalogCodes,
  })
  if (options.dryRun) return buildDryRunReport(plan, source.length, await dryRunContext(sql))
  const payload = JSON.stringify({ sourceCount: source.length, actions: plan.actions }).replaceAll("'", "''")
  const applied = await sql.query(`SELECT public.legacy_sync_apply('${payload}'::jsonb) AS result`)
  return applied[0]?.result ?? null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' })
  const secret = env('LEGACY_SYNC_SECRET')
  const enformaUrl = env('ENFORMA_API_BASE_URL')
  const enformaKey = env('ENFORMA_READ_API_KEY')
  const baseUrl = env('INSFORGE_BASE_URL')
  const apiKey = env('API_KEY')
  if (!secret || !enformaUrl || !enformaKey || !baseUrl || !apiKey) {
    return json(503, { ok: false, error: 'CONFIGURATION_ERROR' })
  }
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)/i.exec(header)
  if (!match?.[1] || !secretsEqual(secret, match[1])) return json(401, { ok: false, error: 'UNAUTHORIZED' })

  // Only an explicit boolean true turns on dry run, and dry run never writes.
  const body = await req.json().catch(() => null) as { dryRun?: unknown } | null
  const dryRun = body?.dryRun === true

  const admin = createAdminClient({ baseUrl, apiKey })
  const sql: SqlClient = {
    async query(query: string) {
      const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!response.ok) throw new Error('LOCAL_SQL_FAILED')
      const body = await response.json() as { rows?: Record<string, unknown>[]; result?: { rows?: Record<string, unknown>[] } }
      return body.rows ?? body.result?.rows ?? []
    },
  }
  try {
    const products = await admin.database.from('products').select('code').eq('event_code', 'HEX-2026')
    if (products.error) throw new Error('CATALOG_READ_FAILED')
    const catalogCodes = new Set(
      (Array.isArray(products.data) ? products.data : [])
        .map((row) => (row as { code?: unknown }).code)
        .filter((code): code is string => typeof code === 'string'),
    )
    const source = await readSource(enformaUrl.replace(/\/$/, ''), enformaKey)
    const result = await runLegacySync(sql, source, catalogCodes, { dryRun })
    return json(200, { ok: true, result })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'SYNC_FAILED'
    const safe = message.replaceAll("'", "''").slice(0, 300)
    if (dryRun) return json(503, { ok: false, error: 'SYNC_FAILED', dryRun: true, detail: safe })
    await sql.query(`SELECT public.legacy_sync_apply('{"error":"${safe}"}'::jsonb)`).catch(() => undefined)
    return json(503, { ok: false, error: 'SYNC_FAILED' })
  }
}
