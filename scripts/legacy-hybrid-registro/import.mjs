import { readFileSync } from 'node:fs'
import { planImport, parseCsv } from './classify.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const csvFlag = args.indexOf('--csv')
const csvPath = csvFlag >= 0 ? args[csvFlag + 1] : ''
if (!csvPath) {
  console.error('missing-csv')
  process.exit(1)
}

const cfg = JSON.parse(readFileSync('.insforge/project.json', 'utf8'))
if (cfg.project_name !== 'ready2hybrid' || cfg.appkey !== '4bg9ufz2') {
  console.error('wrong-project')
  process.exit(1)
}

async function rawsql(query) {
  const response = await fetch(`${cfg.oss_host}/api/database/advance/rawsql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await response.text()
  if (!response.ok) {
    console.error(`sql-http-${response.status}`)
    process.exit(1)
  }
  return JSON.parse(text)
}

function quote(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function rowsOf(payload) {
  return payload.rows ?? payload.result?.rows ?? []
}

const sourceRows = parseCsv(readFileSync(csvPath, 'utf8'))
const products = rowsOf(await rawsql(`SELECT code FROM public.products WHERE event_code = 'HEX-2026'`))
const contacts = rowsOf(await rawsql(`
  SELECT id::text AS id, lower(btrim(email)) AS email
  FROM public.buyer_contacts
  WHERE email IS NOT NULL AND btrim(email) <> ''
`))
let already = []
const existing = await rawsql(`
  SELECT to_regclass('public.legacy_registrations') AS present
`)
if (rowsOf(existing)[0]?.present) {
  already = rowsOf(await rawsql(`
    SELECT original_record_id
    FROM public.legacy_registrations
    WHERE source_system = 'LEGACY_HYBRID_REGISTRO'
  `)).map((row) => row.original_record_id)
}

const contactsByEmail = new Map()
for (const contact of contacts) {
  const list = contactsByEmail.get(contact.email) ?? []
  list.push(contact.id)
  contactsByEmail.set(contact.email, list)
}

const plan = planImport(sourceRows, {
  catalogCodes: new Set(products.map((row) => row.code)),
  contactsByEmail,
  alreadyImported: new Set(already),
})

const paid = sourceRows.filter((row) => String(row.status).trim() === 'paid').length
const pending = sourceRows.filter((row) => String(row.status).trim() === 'pending').length
const other = sourceRows.length - paid - pending
const unmapped = [...new Set(plan.rows.filter((row) => !row.normalizedProductCode && row.disposition !== 'REJECTED_WITH_REASON').map((row) => row.categoryCodeRaw))]
const summary = {
  mode: apply ? 'apply' : 'dry-run',
  total: plan.total,
  paid,
  pending,
  other,
  imported: plan.imported,
  reviewRequired: plan.reviewRequired,
  duplicates: plan.duplicates,
  rejected: plan.rejected,
  contactMatches: plan.rows.filter((row) => row.buyerContactId && row.disposition !== 'DUPLICATE' && row.disposition !== 'REJECTED_WITH_REASON').length,
  newContacts: 0,
  mappedCategories: plan.rows.filter((row) => row.normalizedProductCode).length,
  unmappedCategories: unmapped,
  paymentIdsPreserved: plan.rows.filter((row) => row.commercialStatus === 'LEGACY_PAID' && row.originalPaymentId && row.disposition !== 'DUPLICATE').length,
  paidMissingPaymentId: plan.rows.filter((row) => row.commercialStatus === 'LEGACY_PAID' && !row.originalPaymentId && row.disposition !== 'DUPLICATE').length,
  reconciled: plan.imported + plan.reviewRequired + plan.duplicates + plan.rejected === plan.total,
}

if (!summary.reconciled || plan.total !== sourceRows.length) {
  console.log(JSON.stringify(summary))
  console.error('reconcile-failed')
  process.exit(1)
}

if (!apply) {
  console.log(JSON.stringify(summary))
  process.exit(0)
}

const writable = plan.rows.filter((row) => row.disposition === 'IMPORTED' || row.disposition === 'REVIEW_REQUIRED')
const valueSql = (row) => `(
  ${quote(row.originalRecordId)},
  ${quote(row.originalStatus)},
  ${quote(row.commercialStatus)},
  ${quote(row.disposition)},
  ${quote(row.reviewReason)},
  ${quote(row.originalCreatedAt)},
  ${quote(row.originalUpdatedAt)},
  ${quote(row.buyerContactId)},
  ${quote(row.originalName)},
  ${quote(row.originalEmail)},
  ${quote(row.originalPhone)},
  ${quote(row.categoryCodeRaw)},
  ${quote(row.categoryNameRaw)},
  ${quote(row.categoryBlockRaw)},
  ${quote(row.teamNameRaw)},
  ${quote(row.participantsRaw)},
  ${quote(row.normalizedProductCode)},
  ${row.amountCents == null ? 'NULL' : quote(String(row.amountCents))},
  ${quote(row.currency)},
  ${quote(row.originalPaymentId)},
  ${quote(row.notesRaw)},
  ${quote(JSON.stringify({
    id: row.originalRecordId,
    category_code: row.categoryCodeRaw,
    category_name: row.categoryNameRaw,
    category_bloque: row.categoryBlockRaw,
    team_name: row.teamNameRaw,
    participants: row.participantsRaw,
    contact_name: row.originalName,
    contact_email: row.originalEmail,
    contact_phone: row.originalPhone,
    amount: row.amountCents == null ? null : row.amountCents / 100,
    currency: row.currency,
    status: row.originalStatus,
    created_at: row.originalCreatedAt,
    updated_at: row.originalUpdatedAt,
    mp_payment_id: row.originalPaymentId,
    notes: row.notesRaw,
  }))}::jsonb
)`

const outcomeSql = plan.rows.map((row) => `(
  ${quote(row.originalRecordId)},
  ${quote(row.disposition === 'REJECTED_WITH_REASON' ? 'REJECTED_WITH_REASON' : row.disposition)},
  ${quote(row.reviewReason)}
)`).join(',\n')

const registrationSql = writable.length
  ? writable.map(valueSql).join(',\n')
  : null

const write = `
WITH batch AS (
  INSERT INTO public.legacy_import_batches (
    source_system, source_reference, total_source_rows, inserted_count,
    matched_existing_count, skipped_duplicate_count, review_required_count, failed_count
  ) VALUES (
    'LEGACY_HYBRID_REGISTRO',
    ${quote(csvPath.split(/[\\/]/).pop())},
    ${plan.total},
    ${plan.imported},
    ${summary.contactMatches},
    ${plan.duplicates},
    ${plan.reviewRequired},
    ${plan.rejected}
  )
  RETURNING id
),
${registrationSql ? `written AS (
  INSERT INTO public.legacy_registrations (
    event_id, event_code, source_system, original_record_id, original_status,
    commercial_status, import_disposition, review_reason, original_created_at,
    original_updated_at, buyer_contact_id, original_name, original_email,
    original_phone, category_code_raw, category_name_raw, category_block_raw,
    team_name_raw, participants_raw, normalized_product_code, amount_cents,
    currency, original_payment_id, notes_raw, raw_source_snapshot, import_batch_id
  )
  SELECT event.id, 'HEX-2026', 'LEGACY_HYBRID_REGISTRO', v.original_record_id,
    v.original_status, v.commercial_status, v.import_disposition, v.review_reason,
    v.original_created_at::timestamptz, v.original_updated_at::timestamptz,
    v.buyer_contact_id::uuid, v.original_name, v.original_email, v.original_phone,
    v.category_code_raw, v.category_name_raw, v.category_block_raw, v.team_name_raw,
    v.participants_raw, v.normalized_product_code, v.amount_cents::bigint, v.currency,
    v.original_payment_id, v.notes_raw, v.raw_source_snapshot::jsonb, batch.id
  FROM batch
  JOIN public.events event ON event.code = 'HEX-2026'
  JOIN (VALUES
    ${registrationSql}
  ) AS v(
    original_record_id, original_status, commercial_status, import_disposition,
    review_reason, original_created_at, original_updated_at, buyer_contact_id,
    original_name, original_email, original_phone, category_code_raw,
    category_name_raw, category_block_raw, team_name_raw, participants_raw,
    normalized_product_code, amount_cents, currency, original_payment_id,
    notes_raw, raw_source_snapshot
  ) ON true
  ON CONFLICT (source_system, original_record_id) DO NOTHING
  RETURNING original_record_id
),` : ''}
outcomes AS (
  INSERT INTO public.legacy_import_outcomes (
    import_batch_id, original_record_id, disposition, reason
  )
  SELECT batch.id, o.original_record_id,
    CASE
      WHEN o.disposition IN ('IMPORTED', 'REVIEW_REQUIRED')
        ${registrationSql ? 'AND written.original_record_id IS NULL' : ''}
      THEN 'DUPLICATE'
      ELSE o.disposition
    END,
    o.reason
  FROM batch
  JOIN (VALUES
    ${outcomeSql}
  ) AS o(original_record_id, disposition, reason) ON true
  ${registrationSql ? 'LEFT JOIN written ON written.original_record_id = o.original_record_id' : ''}
  RETURNING disposition
)
SELECT
  (SELECT id::text FROM batch) AS batch_id,
  count(*) FILTER (WHERE disposition = 'IMPORTED') AS imported,
  count(*) FILTER (WHERE disposition = 'REVIEW_REQUIRED') AS review_required,
  count(*) FILTER (WHERE disposition = 'DUPLICATE') AS duplicates,
  count(*) FILTER (WHERE disposition = 'REJECTED_WITH_REASON') AS rejected,
  count(*) AS total
FROM outcomes
`

if (/insert\s+into\s+public\.(orders|payments|tickets|participants|registrations|capacity_holds|outbox_delivery_jobs)\b/i.test(write)) {
  console.error('refusing-operational-write')
  process.exit(1)
}

const written = rowsOf(await rawsql(write))
console.log(JSON.stringify({ ...summary, writeResult: written[0] ?? null }))
