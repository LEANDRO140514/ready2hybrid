import EmbeddedPostgres from 'embedded-postgres'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg
const root = path.resolve(import.meta.dirname, '../../..')
const migration = fs.readFileSync(
  path.join(root, 'insforge/migrations/0032_dual-provider-payment-core.sql'),
  'utf8',
)
const failures = []
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}: ${detail}`)
  else console.log(`ok ${name}`)
}

const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2h-p0-'))
const port = 56000 + Math.floor(Math.random() * 1000)
const embedded = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: false,
})

const schema = `
DO $$ BEGIN CREATE ROLE project_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  total_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  external_reference text,
  commercial_snapshot jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_payment_id text,
  order_id uuid,
  external_state text,
  normalized_state text NOT NULL DEFAULT 'PENDING',
  amount_cents bigint,
  currency text,
  external_reference text,
  provider_created_at timestamptz,
  provider_updated_at timestamptz,
  last_verified_at timestamptz,
  sanitized_evidence_ref text,
  reconciliation_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE capacity_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  state text NOT NULL,
  expires_at timestamptz,
  converted_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_notification_id text,
  notification_type text,
  signature_result text,
  canonical_input_hash text,
  sanitized_headers jsonb,
  payment_id uuid,
  processing_state text NOT NULL DEFAULT 'RECEIVED',
  attempts integer NOT NULL DEFAULT 0,
  result text,
  sanitized_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid, order_id uuid,
  sanitized_provider_evidence_ref text,
  merchant_ownership_ok boolean, external_reference_ok boolean,
  amount_ok boolean, currency_ok boolean,
  normalized_result text, verified_at timestamptz,
  correlation_id text, reconciliation_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_ref text, named_action text, entity_type text, entity_ref text,
  result text, failure_class text, correlation_id text,
  sanitized_metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid, state text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ticket_credential_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid, state text
);
CREATE TABLE outbox_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_type text, template text, destination_ref text,
  domain_event_ref text, minimal_payload jsonb, state text
);
CREATE TABLE email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid
);
CREATE TABLE apply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid, outcome text
);
CREATE FUNCTION team_apply_payment_outcome(p_order uuid, p_outcome text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO apply_log (order_id, outcome) VALUES (p_order, p_outcome);
END $$;
CREATE FUNCTION ticket_issue_after_payment(p_order uuid) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE v_reg uuid;
BEGIN
  SELECT id INTO v_reg FROM registrations WHERE order_id = p_order LIMIT 1;
  IF v_reg IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM tickets t WHERE t.registration_id = v_reg) THEN
    INSERT INTO tickets (registration_id) VALUES (v_reg);
    INSERT INTO email_sends (order_id) VALUES (p_order);
  END IF;
  RETURN '{}'::jsonb;
END $$;
`

let client
try {
  await embedded.initialise()
  await embedded.start()
  client = new Client({
    host: '127.0.0.1', port, user: 'postgres', password: 'postgres', database: 'postgres',
  })
  await client.connect()
  const version = (await client.query('SHOW server_version')).rows[0].server_version
  console.log(`server ${version} port ${port}`)
  await client.query(schema)

  const clear = await client.query(`
    INSERT INTO orders (state, total_cents, external_reference)
    VALUES ('PAID', 25000, 'clear') RETURNING id`)
  const clearId = clear.rows[0].id
  const clearPay = await client.query(`
    INSERT INTO payments (provider, order_id, normalized_state, amount_cents, currency, provider_payment_id)
    VALUES ('MERCADOPAGO', $1, 'APPROVED', 25000, 'MXN', 'hist-1') RETURNING id`, [clearId])
  const ambiguous = await client.query(`
    INSERT INTO orders (state, total_cents, external_reference)
    VALUES ('PAID', 25000, 'amb') RETURNING id`)
  const ambId = ambiguous.rows[0].id
  await client.query(`
    INSERT INTO payments (provider, order_id, normalized_state, amount_cents, currency, provider_payment_id)
    VALUES ('MERCADOPAGO', $1, 'APPROVED', 25000, 'MXN', 'amb-1'),
           ('OPENPAY', $1, 'APPROVED', 25000, 'MXN', 'amb-2')`, [ambId])

  const notices = []
  client.on('notice', (msg) => notices.push(msg.message ?? ''))
  await client.query(migration)

  const column = await client.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paid_payment_id'`)
  const fk = await client.query(`SELECT confrelid::regclass::text AS target FROM pg_constraint WHERE conname = 'fk_orders_paid_payment'`)
  const trigger = await client.query(`SELECT tgname FROM pg_trigger WHERE tgname = 'trg_orders_paid_payment_guard'`)
  const index = await client.query(`SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_payments_one_open_attempt'`)
  const fns = await client.query(`SELECT proname FROM pg_proc WHERE proname IN ('claim_payment_attempt', 'webhook_apply_payment_tx')`)
  check('migration objects', column.rowCount === 1 && fk.rows[0]?.target === 'payments' && trigger.rowCount === 1 && index.rowCount === 1 && fns.rowCount === 2, JSON.stringify({ column: column.rows, fk: fk.rows, fns: fns.rows }))

  const winner = await client.query(`SELECT paid_payment_id FROM orders WHERE id = $1`, [clearId])
  check('backfill unambiguous', winner.rows[0].paid_payment_id === clearPay.rows[0].id, winner.rows[0].paid_payment_id)
  const amb = await client.query(`SELECT paid_payment_id FROM orders WHERE id = $1`, [ambId])
  check('backfill ambiguous stays null', amb.rows[0].paid_payment_id == null, String(amb.rows[0].paid_payment_id))
  check('ambiguous notice', notices.some((line) => line.includes(ambId)), notices.join(' | '))

  async function seed(label) {
    const order = await client.query(`
      INSERT INTO orders (state, total_cents, external_reference, commercial_snapshot)
      VALUES ('PAYMENT_PENDING', 30000, $1, '{"stage":"REGULAR"}'::jsonb) RETURNING id`, [label])
    const id = order.rows[0].id
    await client.query(`
      INSERT INTO capacity_holds (order_id, state, expires_at)
      VALUES ($1, 'ACTIVE', now() + interval '20 minutes')`, [id])
    await client.query(`INSERT INTO registrations (order_id, state) VALUES ($1, 'PENDING_PAYMENT')`, [id])
    return id
  }
  async function claim(orderId, provider) {
    const row = await client.query(`SELECT public.claim_payment_attempt($1::jsonb) AS result`, [JSON.stringify({ order_id: orderId, provider })])
    return row.rows[0].result
  }
  async function apply(body) {
    const row = await client.query(`SELECT public.webhook_apply_payment_tx($1::jsonb) AS result`, [JSON.stringify(body)])
    return row.rows[0].result
  }
  function verified(orderId, provider, paymentId, state, note) {
    return {
      provider, provider_notification_id: note, provider_payment_id: paymentId,
      normalized_state: state, external_state: state, amount_cents: 30000, currency: 'MXN',
      external_reference: orderId, merchant_ownership_ok: true, external_reference_ok: true,
      amount_ok: true, currency_ok: true,
    }
  }

  async function race(orderId, providers) {
    const pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'postgres', database: 'postgres', max: providers.length })
    try {
      return await Promise.all(providers.map((provider) => pool.query(
        `SELECT public.claim_payment_attempt($1::jsonb) AS result`,
        [JSON.stringify({ order_id: orderId, provider })],
      ).then((res) => res.rows[0].result)))
    } finally {
      await pool.end()
    }
  }

  const openpayRace = await seed('race-op')
  const openpayResults = await race(openpayRace, Array.from({ length: 20 }, () => 'OPENPAY'))
  const openpayIds = [...new Set(openpayResults.filter((row) => row.ok).map((row) => row.attempt_id))]
  const openpayOpen = await client.query(`SELECT count(*)::int AS n FROM payments WHERE order_id = $1 AND normalized_state IN ('UNKNOWN','PENDING')`, [openpayRace])
  check('same-provider OPENPAY', openpayOpen.rows[0].n === 1 && openpayIds.length === 1, `open=${openpayOpen.rows[0].n} ids=${openpayIds.join(',')}`)

  const mpRace = await seed('race-mp')
  const mpResults = await race(mpRace, Array.from({ length: 20 }, () => 'MERCADOPAGO'))
  const mpIds = [...new Set(mpResults.filter((row) => row.ok).map((row) => row.attempt_id))]
  const mpOpen = await client.query(`SELECT count(*)::int AS n FROM payments WHERE order_id = $1 AND normalized_state IN ('UNKNOWN','PENDING')`, [mpRace])
  check('same-provider MERCADOPAGO', mpOpen.rows[0].n === 1 && mpIds.length === 1, `open=${mpOpen.rows[0].n} ids=${mpIds.join(',')}`)

  const cross = await seed('race-cross')
  const crossResults = await race(cross, [
    ...Array.from({ length: 10 }, () => 'MERCADOPAGO'),
    ...Array.from({ length: 10 }, () => 'OPENPAY'),
  ])
  const crossOpen = await client.query(`SELECT id, provider, normalized_state FROM payments WHERE order_id = $1 AND normalized_state IN ('UNKNOWN','PENDING')`, [cross])
  const losers = crossResults.filter((row) => !row.ok)
  check('cross-provider one open', crossOpen.rowCount === 1 && losers.every((row) => row.error_code === 'ATTEMPT_OPEN'), `rows=${JSON.stringify(crossOpen.rows)} losers=${losers.map((row) => row.error_code).join(',')}`)
  console.log(`cross winner ${crossOpen.rows[0]?.id} ${crossOpen.rows[0]?.provider}`)

  async function secondInsertBlocked(firstState, secondState) {
    const id = await seed(`idx-${firstState}-${secondState}`)
    await client.query(`INSERT INTO payments (provider, order_id, normalized_state) VALUES ('MERCADOPAGO', $1, $2)`, [id, firstState])
    let blocked = false
    try {
      await client.query(`INSERT INTO payments (provider, order_id, normalized_state) VALUES ('OPENPAY', $1, $2)`, [id, secondState])
    } catch (error) {
      blocked = error.code === '23505'
    }
    const n = await client.query(`SELECT count(*)::int AS n FROM payments WHERE order_id = $1 AND normalized_state IN ('UNKNOWN','PENDING')`, [id])
    check(`index ${firstState}+${secondState}`, blocked && n.rows[0].n === 1, `blocked=${blocked} open=${n.rows[0].n}`)
  }
  await secondInsertBlocked('PENDING', 'PENDING')
  await secondInsertBlocked('UNKNOWN', 'PENDING')
  await secondInsertBlocked('UNKNOWN', 'UNKNOWN')

  const afterTerminal = await seed('idx-after-terminal')
  await client.query(`INSERT INTO payments (provider, order_id, normalized_state) VALUES ('MERCADOPAGO', $1, 'REJECTED')`, [afterTerminal])
  await client.query(`INSERT INTO payments (provider, order_id, normalized_state) VALUES ('OPENPAY', $1, 'PENDING')`, [afterTerminal])
  const cancelled = await seed('idx-after-cancelled')
  await client.query(`INSERT INTO payments (provider, order_id, normalized_state) VALUES ('OPENPAY', $1, 'CANCELLED')`, [cancelled])
  await client.query(`INSERT INTO payments (provider, order_id, normalized_state) VALUES ('MERCADOPAGO', $1, 'PENDING')`, [cancelled])
  check('terminal then pending allowed', true)

  const unknownOrder = await seed('unknown')
  const unknownPay = await client.query(`
    INSERT INTO payments (provider, order_id, normalized_state) VALUES ('OPENPAY', $1, 'UNKNOWN') RETURNING id`, [unknownOrder])
  const blockedMp = await claim(unknownOrder, 'MERCADOPAGO')
  const reused = await claim(unknownOrder, 'OPENPAY')
  const unknownCount = await client.query(`SELECT count(*)::int AS n FROM payments WHERE order_id = $1`, [unknownOrder])
  check('UNKNOWN blocks other provider', blockedMp.error_code === 'ATTEMPT_OPEN' && unknownCount.rows[0].n === 1, JSON.stringify(blockedMp))
  check('UNKNOWN retry reuses', reused.ok === true && reused.reused === true && reused.attempt_id === unknownPay.rows[0].id, JSON.stringify(reused))

  async function sideCounts(orderId) {
    const tickets = await client.query(`SELECT count(*)::int AS n FROM tickets t JOIN registrations r ON r.id = t.registration_id WHERE r.order_id = $1`, [orderId])
    const emails = await client.query(`SELECT count(*)::int AS n FROM email_sends WHERE order_id = $1`, [orderId])
    const order = await client.query(`SELECT state, paid_payment_id, total_cents, commercial_snapshot FROM orders WHERE id = $1`, [orderId])
    const hold = await client.query(`SELECT state, expires_at FROM capacity_holds WHERE order_id = $1`, [orderId])
    return { tickets: tickets.rows[0].n, emails: emails.rows[0].n, order: order.rows[0], hold: hold.rows[0] }
  }

  const toOpenpay = await seed('mp-to-op')
  const beforeExpiry = (await client.query(`SELECT expires_at FROM capacity_holds WHERE order_id = $1`, [toOpenpay])).rows[0].expires_at
  const mpClaim = await claim(toOpenpay, 'MERCADOPAGO')
  const mpRejected = await apply(verified(toOpenpay, 'MERCADOPAGO', 'mp-rej', 'REJECTED', 'note-mp-rej'))
  const afterReject = await sideCounts(toOpenpay)
  const opClaim = await claim(toOpenpay, 'OPENPAY')
  const opPaid = await apply(verified(toOpenpay, 'OPENPAY', 'op-ok', 'APPROVED', 'note-op-ok'))
  const afterPaid = await sideCounts(toOpenpay)
  const repeat = await apply(verified(toOpenpay, 'OPENPAY', 'op-ok', 'APPROVED', 'note-op-ok-2'))
  const afterRepeat = await sideCounts(toOpenpay)
  check('MP rejected keeps chargeable order', mpRejected.outcome === 'REJECTED' && afterReject.order.state === 'PAYMENT_PENDING' && afterReject.hold.state === 'ACTIVE' && String(afterReject.hold.expires_at) === String(beforeExpiry), JSON.stringify(afterReject))
  check('MP to Openpay switch', opClaim.ok === true && opPaid.outcome === 'PAID' && afterPaid.order.paid_payment_id === opClaim.attempt_id && afterPaid.tickets === 1 && afterPaid.emails === 1, JSON.stringify({ opClaim, opPaid, afterPaid }))
  check('repeat does not move winner', repeat.outcome === 'ALREADY_PAID' && afterRepeat.order.paid_payment_id === afterPaid.order.paid_payment_id && afterRepeat.tickets === 1 && afterRepeat.emails === 1, JSON.stringify(repeat))
  console.log(`mp claim ${mpClaim.attempt_id}`)

  const toMp = await seed('op-to-mp')
  const opFirst = await claim(toMp, 'OPENPAY')
  await apply(verified(toMp, 'OPENPAY', 'op-rej', 'REJECTED', 'note-op-rej'))
  const mpSecond = await claim(toMp, 'MERCADOPAGO')
  const mpPaid = await apply(verified(toMp, 'MERCADOPAGO', 'mp-ok', 'APPROVED', 'note-mp-ok'))
  const mpDone = await sideCounts(toMp)
  check('Openpay to MP switch', opFirst.ok && mpSecond.ok && mpPaid.outcome === 'PAID' && mpDone.order.state === 'PAID' && mpDone.order.paid_payment_id === mpSecond.attempt_id && mpDone.tickets === 1 && mpDone.emails === 1, JSON.stringify({ mpPaid, mpDone }))

  const cancelledOrder = await seed('cancelled')
  const cancelledClaim = await claim(cancelledOrder, 'OPENPAY')
  await apply(verified(cancelledOrder, 'OPENPAY', 'op-can', 'CANCELLED', 'note-can'))
  const cancelledState = await sideCounts(cancelledOrder)
  const afterCancel = await claim(cancelledOrder, 'MERCADOPAGO')
  check('CANCELLED stays chargeable', cancelledState.order.state === 'PAYMENT_PENDING' && cancelledState.hold.state === 'ACTIVE' && afterCancel.ok === true, JSON.stringify({ cancelledState, afterCancel, cancelledClaim }))

  const expired = await seed('expired-hold')
  await client.query(`UPDATE capacity_holds SET expires_at = now() - interval '1 minute' WHERE order_id = $1`, [expired])
  const stamp = (await client.query(`SELECT expires_at, state FROM capacity_holds WHERE order_id = $1`, [expired])).rows[0]
  const snap = (await client.query(`SELECT commercial_snapshot, total_cents, state FROM orders WHERE id = $1`, [expired])).rows[0]
  const denied = await claim(expired, 'OPENPAY')
  const stampAfter = (await client.query(`SELECT expires_at, state FROM capacity_holds WHERE order_id = $1`, [expired])).rows[0]
  const snapAfter = (await client.query(`SELECT commercial_snapshot, total_cents, state FROM orders WHERE id = $1`, [expired])).rows[0]
  check('expired hold denies claim', denied.error_code === 'HOLD_EXPIRED' && String(stampAfter.expires_at) === String(stamp.expires_at) && stampAfter.state === 'ACTIVE' && snapAfter.total_cents === snap.total_cents && JSON.stringify(snapAfter.commercial_snapshot) === JSON.stringify(snap.commercial_snapshot) && snapAfter.state === 'PAYMENT_PENDING', JSON.stringify(denied))

  const expiredOrder = await seed('expired-order')
  await client.query(`UPDATE orders SET state = 'EXPIRED' WHERE id = $1`, [expiredOrder])
  await apply(verified(expiredOrder, 'MERCADOPAGO', 'late-rej', 'REJECTED', 'note-exp-rej'))
  const stillExpired = await client.query(`SELECT state FROM orders WHERE id = $1`, [expiredOrder])
  check('EXPIRED order is not revived', stillExpired.rows[0].state === 'EXPIRED', stillExpired.rows[0].state)

  const late = await seed('late')
  await client.query(`UPDATE capacity_holds SET expires_at = now() - interval '1 minute' WHERE order_id = $1`, [late])
  const lateResult = await apply(verified(late, 'MERCADOPAGO', 'late-ok', 'APPROVED', 'note-late'))
  const lateOrder = await sideCounts(late)
  const lateOutbox = await client.query(`SELECT template FROM outbox_delivery_jobs WHERE domain_event_ref = $1`, [`order:${late}`])
  check('late APPROVED reviews', lateResult.outcome === 'REQUIRES_REVIEW' && lateOrder.order.state === 'REQUIRES_REVIEW' && lateOrder.hold.state === 'CONFLICT' && lateOutbox.rows[0]?.template === 'PAYMENT_REQUIRES_REVIEW' && lateOrder.tickets === 0, JSON.stringify({ lateResult, lateOrder, lateOutbox: lateOutbox.rows }))

  let otherOrderRejected = false
  try {
    await client.query(`UPDATE orders SET paid_payment_id = $1 WHERE id = $2`, [clearPay.rows[0].id, toOpenpay])
  } catch (error) {
    otherOrderRejected = /APPROVED payment of this order|cannot change/.test(error.message)
  }
  check('other order payment rejected', otherOrderRejected)

  const pendingOrder = await client.query(`INSERT INTO orders (state, total_cents) VALUES ('PAID', 30000) RETURNING id`)
  const pendingPay = await client.query(`
    INSERT INTO payments (provider, order_id, normalized_state, amount_cents, currency)
    VALUES ('OPENPAY', $1, 'PENDING', 30000, 'MXN') RETURNING id`, [pendingOrder.rows[0].id])
  let pendingRejected = false
  try {
    await client.query(`UPDATE orders SET paid_payment_id = $1 WHERE id = $2`, [pendingPay.rows[0].id, pendingOrder.rows[0].id])
  } catch (error) {
    pendingRejected = error.message.includes('APPROVED payment of this order')
  }
  check('pending payment cannot be winner', pendingRejected)

  let changed = false
  try {
    await client.query(`UPDATE orders SET paid_payment_id = $1 WHERE id = $2`, [mpClaim.attempt_id, toOpenpay])
  } catch (error) {
    changed = error.message.includes('cannot change')
  }
  check('winner is immutable', changed)
  const still = await client.query(`SELECT paid_payment_id FROM orders WHERE id = $1`, [toOpenpay])
  check('winner unchanged after rejected rewrite', still.rows[0].paid_payment_id === opClaim.attempt_id, still.rows[0].paid_payment_id)

  const legacy = await seed('legacy')
  const legacyResult = await apply({
    provider_notification_id: 'legacy-1', provider_payment_id: 'legacy-pay',
    normalized_state: 'APPROVED', amount_cents: 30000, currency: 'MXN',
    external_reference: legacy, merchant_ownership_ok: true, external_reference_ok: true,
    amount_ok: true, currency_ok: true,
  })
  const legacyProvider = await client.query(`SELECT provider FROM payments WHERE order_id = $1 AND normalized_state = 'APPROVED'`, [legacy])
  check('missing provider is Mercado Pago', legacyResult.outcome === 'PAID' && legacyProvider.rows[0]?.provider === 'MERCADOPAGO', JSON.stringify({ legacyResult, legacyProvider: legacyProvider.rows }))

  const beforeUnknown = await client.query(`SELECT count(*)::int AS n FROM webhook_events`)
  const unknownProvider = await apply({
    provider: 'CLIP', provider_notification_id: 'bad', provider_payment_id: 'bad',
    normalized_state: 'APPROVED', amount_cents: 30000, currency: 'MXN',
    external_reference: legacy, merchant_ownership_ok: true, external_reference_ok: true,
    amount_ok: true, currency_ok: true,
  })
  const afterUnknown = await client.query(`SELECT count(*)::int AS n FROM webhook_events`)
  check('unknown provider writes nothing', unknownProvider.error_code === 'UNKNOWN_PROVIDER' && afterUnknown.rows[0].n === beforeUnknown.rows[0].n, JSON.stringify(unknownProvider))

  const teamMp = await client.query(`SELECT count(*)::int AS n FROM apply_log WHERE order_id = $1`, [toMp])
  const teamOp = await client.query(`SELECT count(*)::int AS n FROM apply_log WHERE order_id = $1`, [toOpenpay])
  const activity = await client.query(`SELECT count(*)::int AS n FROM activity_log WHERE named_action = 'WEBHOOK_PAYMENT_APPLIED' AND entity_ref IN ($1, $2)`, [toMp, toOpenpay])
  check('both providers share apply effects', teamMp.rows[0].n > 0 && teamOp.rows[0].n > 0 && activity.rows[0].n > 0, JSON.stringify({ teamMp: teamMp.rows[0], teamOp: teamOp.rows[0], activity: activity.rows[0] }))

  const refundOrder = await seed('refund')
  await claim(refundOrder, 'MERCADOPAGO')
  await apply(verified(refundOrder, 'MERCADOPAGO', 'rf-ok', 'APPROVED', 'note-rf'))
  const refunded = await apply(verified(refundOrder, 'MERCADOPAGO', 'rf-ok', 'REFUNDED', 'note-rf-2'))
  const refundState = await client.query(`SELECT state FROM orders WHERE id = $1`, [refundOrder])
  const refundBox = await client.query(`SELECT template FROM outbox_delivery_jobs WHERE domain_event_ref = $1`, [`order:${refundOrder}`])
  check('refund uses the shared path', refunded.outcome === 'REFUNDED' && refundState.rows[0].state === 'REFUNDED' && refundBox.rows[0]?.template === 'PAYMENT_CORRECTIVE_STATE', JSON.stringify({ refunded, refundBox: refundBox.rows }))

  console.log(failures.length === 0 ? 'P0_DB_GATE_PASS' : 'P0_DB_GATE_FAIL')
  if (failures.length) {
    console.log(failures.join('\n'))
    process.exitCode = 1
  }
} finally {
  if (client) await client.end().catch(() => undefined)
  await embedded.stop().catch(() => undefined)
  fs.rmSync(databaseDir, { recursive: true, force: true })
}
