/**
 * Disposable Postgres check for 0038.
 * Never targets InsForge production or the linked sandbox.
 */
import EmbeddedPostgres from 'embedded-postgres'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg
const root = path.resolve(import.meta.dirname, '../../..')
const migration = fs.readFileSync(
  path.join(root, 'insforge/migrations/0038_card-rejection-keeps-open-checkout.sql'),
  'utf8',
)
const failures = []
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}: ${detail}`)
  else console.log(`ok ${name}`)
}

const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2h-0038-'))
const port = 57000 + Math.floor(Math.random() * 1000)
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE capacity_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  state text NOT NULL,
  expires_at timestamptz,
  converted_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  state text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teams (
  order_id uuid PRIMARY KEY REFERENCES orders(id),
  roster_state text NOT NULL,
  payment_state text NOT NULL
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  order_id uuid NOT NULL,
  external_state text,
  normalized_state text NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL,
  external_reference text,
  provider_created_at timestamptz,
  provider_updated_at timestamptz,
  last_verified_at timestamptz,
  sanitized_evidence_ref text,
  reconciliation_state text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_notification_id text NOT NULL,
  notification_type text,
  signature_result text,
  canonical_input_hash text,
  sanitized_headers jsonb,
  processing_state text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  result text,
  received_at timestamptz,
  processed_at timestamptz,
  payment_id uuid,
  sanitized_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  order_id uuid NOT NULL,
  sanitized_provider_evidence_ref text,
  merchant_ownership_ok boolean,
  external_reference_ok boolean,
  amount_ok boolean,
  currency_ok boolean,
  normalized_result text,
  verified_at timestamptz,
  correlation_id text,
  reconciliation_state text
);
CREATE TABLE outbox_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_type text,
  template text,
  destination_ref text,
  domain_event_ref text,
  minimal_payload jsonb,
  state text
);
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_ref text,
  named_action text,
  entity_type text,
  entity_ref text,
  result text,
  failure_class text,
  correlation_id text,
  sanitized_metadata jsonb
);
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL,
  state text NOT NULL
);
CREATE TABLE ticket_credential_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  state text NOT NULL
);

CREATE FUNCTION public.team_apply_payment_outcome(p_order_id uuid, p_outcome text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_outcome IN ('PAID', 'ALREADY_PAID') THEN
    UPDATE teams
    SET roster_state = 'ELIGIBLE', payment_state = 'PAID'
    WHERE order_id = p_order_id;
  ELSIF p_outcome IN ('REJECTED', 'CANCELLED') THEN
    UPDATE teams
    SET roster_state = 'CANCELLED', payment_state = p_outcome
    WHERE order_id = p_order_id
      AND roster_state IN ('PROVISIONAL', 'PAYMENT_PENDING', 'PAID_ROSTER_INCOMPLETE');
  END IF;
END $$;

CREATE TABLE issue_control (fail boolean NOT NULL);
INSERT INTO issue_control VALUES (false);

CREATE FUNCTION public.ticket_issue_after_payment(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  n int;
  v_ticket uuid;
BEGIN
  IF (SELECT fail FROM issue_control) THEN
    RAISE EXCEPTION 'issue failed';
  END IF;
  SELECT count(*)::int INTO n
  FROM tickets t
  JOIN registrations r ON r.id = t.registration_id
  WHERE r.order_id = p_order_id;
  IF n > 0 THEN
    RETURN jsonb_build_object('ok', true, 'replay', true);
  END IF;
  INSERT INTO tickets (registration_id, state)
  SELECT id, 'ACTIVE' FROM registrations WHERE order_id = p_order_id
  RETURNING id INTO v_ticket;
  INSERT INTO outbox_delivery_jobs (
    communication_type, template, destination_ref, domain_event_ref, state
  ) VALUES (
    'TICKET_READY', 'TICKET_READY', 'deferred:email', 'ticket:' || v_ticket::text, 'PENDING'
  );
  RETURN jsonb_build_object('ok', true, 'replay', false);
END $$;
`

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

try {
  await embedded.initialise()
  await embedded.start()
  const client = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  })
  await client.connect()
  await client.query(schema)
  await client.query(migration)

  async function seed(opts) {
    const inserted = await client.query(
      `INSERT INTO orders (state, total_cents) VALUES ($1, 250000) RETURNING id`,
      [opts.state ?? 'PAYMENT_PENDING'],
    )
    const id = inserted.rows[0].id
    await client.query(`UPDATE orders SET external_reference = id::text WHERE id = $1`, [id])
    await client.query(
      `INSERT INTO capacity_holds (order_id, state, expires_at) VALUES ($1, $2, $3)`,
      [id, opts.holdState ?? 'ACTIVE', opts.expiresAt ?? new Date(Date.now() + 20 * 60 * 1000)],
    )
    await client.query(`INSERT INTO registrations (order_id, state) VALUES ($1, $2)`, [
      id,
      opts.regState ?? 'PENDING_PAYMENT',
    ])
    await client.query(
      `INSERT INTO teams (order_id, roster_state, payment_state) VALUES ($1, $2, $3)`,
      [id, opts.roster ?? 'PAYMENT_PENDING', opts.teamPay ?? 'PENDING'],
    )
    return id
  }

  async function apply(orderId, paymentId, state, notificationId) {
    const res = await client.query(
      `SELECT public.webhook_apply_payment_tx($1::jsonb) AS result`,
      [JSON.stringify(payload(orderId, paymentId, state, notificationId))],
    )
    return res.rows[0].result
  }

  async function snap(orderId) {
    const res = await client.query(
      `SELECT o.state AS order_state,
              h.state AS hold_state,
              h.expires_at,
              h.released_at,
              h.converted_at,
              r.state AS reg_state,
              t.roster_state,
              t.payment_state AS team_pay,
              (SELECT count(*)::int FROM tickets tk
                JOIN registrations rr ON rr.id = tk.registration_id
                WHERE rr.order_id = o.id) AS tickets,
              (SELECT count(*)::int FROM payments p WHERE p.order_id = o.id) AS payments,
              (SELECT count(*)::int FROM payments p
                WHERE p.order_id = o.id AND p.normalized_state = 'APPROVED') AS approved
       FROM orders o
       JOIN capacity_holds h ON h.order_id = o.id
       JOIN registrations r ON r.order_id = o.id
       JOIN teams t ON t.order_id = o.id
       WHERE o.id = $1`,
      [orderId],
    )
    return res.rows[0]
  }

  const open = await seed({})
  const before = await snap(open)
  const rejected = await apply(open, 'card-rejected', 'REJECTED', 'note-rejected')
  const afterReject = await snap(open)
  check('rejection stays open', rejected.outcome === 'REJECTED_RETRYABLE', JSON.stringify(rejected))
  check(
    'rejection keeps checkout',
    afterReject.order_state === 'PAYMENT_PENDING' &&
      afterReject.hold_state === 'ACTIVE' &&
      afterReject.released_at === null &&
      new Date(afterReject.expires_at).getTime() === new Date(before.expires_at).getTime() &&
      afterReject.reg_state === 'PENDING_PAYMENT' &&
      afterReject.roster_state === 'PAYMENT_PENDING' &&
      afterReject.tickets === 0 &&
      afterReject.payments === 1,
    JSON.stringify(afterReject),
  )

  const paid = await apply(open, 'card-approved', 'APPROVED', 'note-approved')
  const afterPaid = await snap(open)
  check('approval after rejection pays once', paid.outcome === 'PAID', JSON.stringify(paid))
  check(
    'one ticket and one approved payment',
    afterPaid.order_state === 'PAID' &&
      afterPaid.hold_state === 'CONVERTED' &&
      afterPaid.converted_at !== null &&
      afterPaid.reg_state === 'PAYMENT_CONFIRMED' &&
      afterPaid.roster_state === 'ELIGIBLE' &&
      afterPaid.tickets === 1 &&
      afterPaid.payments === 2 &&
      afterPaid.approved === 1,
    JSON.stringify(afterPaid),
  )

  const duplicate = await apply(open, 'card-approved', 'APPROVED', 'note-approved')
  const afterDup = await snap(open)
  check('same notification is duplicate', duplicate.outcome === 'DUPLICATE' && duplicate.replay === true, JSON.stringify(duplicate))
  check('duplicate adds nothing', afterDup.tickets === 1 && afterDup.payments === 2 && afterDup.approved === 1, JSON.stringify(afterDup))

  const again = await apply(open, 'card-approved', 'APPROVED', 'note-approved-again')
  const afterAgain = await snap(open)
  check('second approval is already paid', again.outcome === 'ALREADY_PAID', JSON.stringify(again))
  check(
    'second approval does not duplicate',
    afterAgain.tickets === 1 && afterAgain.payments === 2 && afterAgain.approved === 1 && afterAgain.order_state === 'PAID',
    JSON.stringify(afterAgain),
  )

  const cancelled = await seed({})
  const cancelResult = await apply(cancelled, 'buyer-cancelled', 'CANCELLED', 'note-cancelled')
  const afterCancel = await snap(cancelled)
  check('cancellation stays definitive', cancelResult.outcome === 'CANCELLED', JSON.stringify(cancelResult))
  check(
    'cancellation closes checkout',
    afterCancel.order_state === 'CANCELLED' &&
      afterCancel.hold_state === 'RELEASED' &&
      afterCancel.reg_state === 'CANCELLED' &&
      afterCancel.roster_state === 'CANCELLED' &&
      afterCancel.tickets === 0,
    JSON.stringify(afterCancel),
  )

  const expired = await seed({ expiresAt: new Date(Date.now() - 60 * 1000) })
  const lateReject = await apply(expired, 'late-reject', 'REJECTED', 'note-late-reject')
  const afterLate = await snap(expired)
  check('expired rejection closes', lateReject.outcome === 'REJECTED', JSON.stringify(lateReject))
  check(
    'expired hold is released',
    afterLate.order_state === 'REJECTED' &&
      afterLate.hold_state === 'RELEASED' &&
      afterLate.reg_state === 'CANCELLED' &&
      afterLate.roster_state === 'CANCELLED' &&
      afterLate.tickets === 0,
    JSON.stringify(afterLate),
  )
  const lateApprove = await apply(expired, 'late-approve', 'APPROVED', 'note-late-approve')
  const afterLateApprove = await snap(expired)
  check('approval after expiry needs review', lateApprove.outcome === 'REQUIRES_REVIEW', JSON.stringify(lateApprove))
  check(
    'late approval issues no ticket',
    afterLateApprove.order_state === 'REQUIRES_REVIEW' &&
      afterLateApprove.hold_state === 'CONFLICT' &&
      afterLateApprove.tickets === 0 &&
      afterLateApprove.approved === 1,
    JSON.stringify(afterLateApprove),
  )

  const closed = await seed({ state: 'EXPIRED', holdState: 'EXPIRED', regState: 'CANCELLED', roster: 'CANCELLED', teamPay: 'CANCELLED' })
  const revive = await apply(closed, 'stale-reject', 'REJECTED', 'note-stale-reject')
  const afterRevive = await snap(closed)
  check('expired order is not revived', revive.outcome === 'REJECTED', JSON.stringify(revive))
  check(
    'expired order stays expired',
    afterRevive.order_state === 'EXPIRED' &&
      afterRevive.hold_state === 'EXPIRED' &&
      afterRevive.tickets === 0,
    JSON.stringify(afterRevive),
  )

  const pendingMail = await client.query(
    `SELECT count(*)::int AS n
     FROM outbox_delivery_jobs
     WHERE communication_type = 'TICKET_READY' AND state = 'PENDING'`,
  )
  check('issued ticket leaves the email pending', pendingMail.rows[0].n === 1, String(pendingMail.rows[0].n))

  const stale = await apply(open, 'card-approved', 'REJECTED', 'note-stale-after-paid')
  const afterStale = await snap(open)
  check('older rejection does not replace the approval', stale.outcome === 'ALREADY_PAID', JSON.stringify(stale))
  check(
    'older rejection keeps the single ticket',
    afterStale.order_state === 'PAID' && afterStale.tickets === 1 && afterStale.approved === 1 && afterStale.payments === 2,
    JSON.stringify(afterStale),
  )

  const extraReject = await apply(open, 'later-reject', 'REJECTED', 'note-later-reject')
  const afterExtra = await snap(open)
  check('later rejection does not cancel a paid order', extraReject.outcome === 'REJECTED', JSON.stringify(extraReject))
  check(
    'later rejection leaves the paid ticket',
    afterExtra.order_state === 'PAID' &&
      afterExtra.tickets === 1 &&
      afterExtra.approved === 1 &&
      afterExtra.roster_state === 'ELIGIBLE',
    JSON.stringify(afterExtra),
  )

  await client.query(`UPDATE issue_control SET fail = true`)
  const broken = await seed({})
  let issueError = ''
  try {
    await apply(broken, 'fail-approve', 'APPROVED', 'note-fail-approve')
  } catch (error) {
    issueError = error.message
  }
  const afterFail = await snap(broken)
  check(
    'issuance failure rolls back the payment apply',
    issueError.includes('issue failed') &&
      afterFail.order_state === 'PAYMENT_PENDING' &&
      afterFail.tickets === 0 &&
      afterFail.payments === 0 &&
      afterFail.hold_state === 'ACTIVE',
    `${issueError} ${JSON.stringify(afterFail)}`,
  )
  await client.query(`UPDATE issue_control SET fail = false`)

  const race = await seed({})
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    max: 2,
  })
  const raced = await Promise.all([
    pool.query(`SELECT public.webhook_apply_payment_tx($1::jsonb) AS result`, [
      JSON.stringify(payload(race, 'race-a', 'APPROVED', 'race-note-a')),
    ]),
    pool.query(`SELECT public.webhook_apply_payment_tx($1::jsonb) AS result`, [
      JSON.stringify(payload(race, 'race-b', 'APPROVED', 'race-note-b')),
    ]),
  ])
  await pool.end()
  const afterRace = await snap(race)
  const raceOutcomes = raced.map((row) => row.rows[0].result.outcome).sort()
  const raceAlerts = await client.query(
    `SELECT count(*)::int AS n
     FROM outbox_delivery_jobs
     WHERE communication_type = 'INTERNAL_ALERT'
       AND domain_event_ref = $1`,
    [`order:${race}`],
  )
  check(
    'concurrent approvals keep both charges and alert the second',
    afterRace.tickets === 1 && afterRace.approved === 2 && afterRace.order_state === 'PAID' && raceOutcomes.join(',') === 'ALREADY_PAID,PAID' && raceAlerts.rows[0].n === 1,
    `${raceOutcomes.join(',')} alerts=${raceAlerts.rows[0].n} ${JSON.stringify(afterRace)}`,
  )

  const replay = await seed({})
  await apply(replay, 'same-pay', 'APPROVED', 'same-note-1')
  const replayed = await apply(replay, 'same-pay', 'APPROVED', 'same-note-2')
  const replayAlerts = await client.query(
    `SELECT count(*)::int AS n
     FROM outbox_delivery_jobs
     WHERE communication_type = 'INTERNAL_ALERT'
       AND domain_event_ref = $1`,
    [`order:${replay}`],
  )
  const replaySnap = await snap(replay)
  check(
    'replaying the same payment does not alert a second charge',
    replayed.outcome === 'ALREADY_PAID' && replaySnap.approved === 1 && replaySnap.tickets === 1 && replayAlerts.rows[0].n === 0,
    JSON.stringify({ replayed, replaySnap, alerts: replayAlerts.rows[0].n }),
  )

  await client.query(`ALTER TABLE orders ADD COLUMN paid_payment_id uuid`)
  let guardMessage = ''
  try {
    await client.query(migration)
  } catch (error) {
    guardMessage = error.message
  }
  const still = await client.query(
    `SELECT position('REJECTED_RETRYABLE' in pg_get_functiondef('public.webhook_apply_payment_tx(jsonb)'::regprocedure)) > 0 AS kept`,
  )
  check(
    'paid_payment_id aborts the replace',
    guardMessage.includes('0038 aborted') && still.rows[0].kept === true,
    guardMessage,
  )

  await client.end()
} finally {
  await embedded.stop()
  fs.rmSync(databaseDir, { recursive: true, force: true })
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('card rejection retry checks passed')
