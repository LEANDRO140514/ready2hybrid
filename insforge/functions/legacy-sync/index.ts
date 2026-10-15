import { createAdminClient } from 'npm:@insforge/sdk@1.5.0'

import { planLegacySync, SOURCE_SELECT, type MirrorRegistration, type SourceRegistration } from '../../../src/legacy-sync/plan.ts'

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

async function readSource(baseUrl: string, apiKey: string): Promise<SourceRegistration[]> {
  if (!SOURCE_SELECT.startsWith('SELECT ') || /\b(insert|update|delete|drop|alter)\b/i.test(SOURCE_SELECT)) {
    throw new Error('SOURCE_QUERY_REJECTED')
  }
  const response = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SOURCE_SELECT }),
  })
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`)
  const body = await response.json() as { rows?: SourceRegistration[]; result?: { rows?: SourceRegistration[] } }
  const rows = body.rows ?? body.result?.rows
  if (!Array.isArray(rows)) throw new Error('SOURCE_SHAPE')
  return rows
}

export async function runLegacySync(sql: SqlClient, source: SourceRegistration[], catalogCodes: ReadonlySet<string>): Promise<unknown> {
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
    const result = await runLegacySync(sql, source, catalogCodes)
    return json(200, { ok: true, result })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'SYNC_FAILED'
    const safe = message.replaceAll("'", "''").slice(0, 300)
    await sql.query(`SELECT public.legacy_sync_apply('{"error":"${safe}"}'::jsonb)`).catch(() => undefined)
    return json(503, { ok: false, error: 'SYNC_FAILED' })
  }
}
