/**
 * Local rehearsal of 0046 against the function captured from 4bg9ufz2.
 * Disposable PGlite. Never connects to InsForge.
 *
 * Schema: the tables and columns webhook_apply_payment_tx reads and writes,
 * same surface as tests/integration/local-db/card-rejection-retry.mjs.
 * It is not a dump of production.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(pathToFileURL('C:/Users/algor/AppData/Local/Temp/r2h-pglite/package.json'))
const { PGlite } = require('@electric-sql/pglite')

const schemaSource = readFileSync(
  resolve(root, 'tests/integration/local-db/card-rejection-retry.mjs'),
  'utf8',
)
const schemaMatch = schemaSource.match(/const schema = `([\s\S]*?)`\n/)
if (!schemaMatch) throw new Error('could not read the local payment schema')

const liveFn = readFileSync(resolve(root, 'docs/openpay/live-webhook-apply-payment-tx.sql'), 'utf8')
const migration = readFileSync(
  resolve(root, 'insforge/migrations/0046_dual-provider-payment-core.sql'),
  'utf8',
)
const rollback = readFileSync(
  resolve(root, 'docs/openpay/0046-rollback-webhook-apply.sql'),
  'utf8',
)

const failures = []
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}: ${detail}`)
  else console.log(`ok ${name}`)
}

function payload(orderId, paymentId, state, notificationId) {
  return {
    provider_notification_id: notificationId,
    provider_payment_id: paymentId,
    normalized_state: state,
    external_state: state.toLowerCase(),
    amount_cents: 250000,
    currency: 'MXN',
    external_reference: orderId,
    merchant_ownership_ok: true,
    external_reference_ok: true,
    amount_ok: true,
    currency_ok: true,
  }
}

const db = new PGlite()
await db.exec(schemaMatch[1])
await db.exec('ALTER TABLE payments ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()')
await db.exec(liveFn)

async function seed(opts = {}) {
  const inserted = await db.query(
    'INSERT INTO orders (state, total_cents) VALUES ($1, 250000) RETURNING id',
    [opts.state ?? 'PAYMENT_PENDING'],
  )
  const id = inserted.rows[0].id
  await db.query('UPDATE orders SET external_reference = id::text WHERE id = $1', [id])
  await db.query(
    'INSERT INTO capacity_holds (order_id, state, expires_at) VALUES ($1, $2, $3)',
    [id, opts.holdState ?? 'ACTIVE', opts.expiresAt ?? new Date(Date.now() + 20 * 60 * 1000).toISOString()],
  )
  await db.query('INSERT INTO registrations (order_id, state) VALUES ($1, $2)', [
    id,
    opts.regState ?? 'PENDING_PAYMENT',
  ])
  await db.query(
    'INSERT INTO teams (order_id, roster_state, payment_state) VALUES ($1, $2, $3)',
    [id, opts.roster ?? 'PAYMENT_PENDING', opts.teamPay ?? 'PENDING'],
  )
  return id
}

async function apply(orderId, paymentId, state, notificationId) {
  const res = await db.query('SELECT public.webhook_apply_payment_tx($1::jsonb) AS result', [
    JSON.stringify(payload(orderId, paymentId, state, notificationId)),
  ])
  return res.rows[0].result
}

async function snap(orderId) {
  const res = await db.query(
    `SELECT o.state AS order_state,
            h.state AS hold_state,
            (SELECT count(*)::int FROM tickets tk
              JOIN registrations rr ON rr.id = tk.registration_id
              WHERE rr.order_id = o.id) AS tickets
     FROM orders o
     JOIN capacity_holds h ON h.order_id = o.id
     WHERE o.id = $1`,
    [orderId],
  )
  return res.rows[0]
}

async function cases(label) {
  const paid = await seed()
  const approved = await apply(paid, `${label}-ok`, 'APPROVED', `${label}-note-ok`)
  const afterPaid = await snap(paid)
  check(`${label} approved is PAID`, approved.outcome === 'PAID' && afterPaid.order_state === 'PAID', JSON.stringify({ approved, afterPaid }))
  check(`${label} approved issues a ticket`, afterPaid.tickets === 1, JSON.stringify(afterPaid))

  const open = await seed()
  const rejected = await apply(open, `${label}-reject`, 'REJECTED', `${label}-note-reject`)
  const afterReject = await snap(open)
  check(
    `${label} retryable rejection keeps the hold`,
    rejected.outcome === 'REJECTED_RETRYABLE' && afterReject.order_state === 'PAYMENT_PENDING' && afterReject.hold_state === 'ACTIVE' && afterReject.tickets === 0,
    JSON.stringify({ rejected, afterReject }),
  )

  const expired = await seed({
    state: 'EXPIRED',
    holdState: 'EXPIRED',
    regState: 'CANCELLED',
    roster: 'CANCELLED',
    teamPay: 'CANCELLED',
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
  })
  const revive = await apply(expired, `${label}-stale`, 'REJECTED', `${label}-note-stale`)
  const afterExpired = await snap(expired)
  check(
    `${label} EXPIRED order stays EXPIRED`,
    afterExpired.order_state === 'EXPIRED' && afterExpired.hold_state === 'EXPIRED',
    JSON.stringify({ revive, afterExpired }),
  )

  const downgrade = await apply(paid, `${label}-second`, 'REJECTED', `${label}-note-second`)
  const afterDowngrade = await snap(paid)
  check(
    `${label} PAID does not move down`,
    afterDowngrade.order_state === 'PAID' && afterDowngrade.tickets === 1,
    JSON.stringify({ downgrade, afterDowngrade }),
  )
}

try {
  await cases('live')
  await db.exec(migration)
  await cases('0046')
  await db.exec(rollback)
  await cases('rollback')
} catch (error) {
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error))
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('openpay 0046 rehearsal passed')
