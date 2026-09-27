import EmbeddedPostgres from 'embedded-postgres'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg
const root = path.resolve(import.meta.dirname, '../../..')
const migration = fs.readFileSync(
  path.join(root, 'insforge/migrations/0035_ticket-issuance-without-digital-waiver.sql'),
  'utf8',
)
const start = migration.indexOf(
  'CREATE OR REPLACE FUNCTION public.ticket_issue_one_registration(p_registration_id uuid)',
)
const end = migration.indexOf('\n$$;', start)
if (start < 0 || end < 0) throw new Error('ticket function not found in 0035')
const ticketFn = migration.slice(start, end + 4)

const failures = []
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}: ${detail}`)
  else console.log(`ok ${name}`)
}

const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2h-ticket-'))
const port = 57000 + Math.floor(Math.random() * 1000)
const embedded = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: false,
})

const schema = `
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text, kind text, day date, team_size integer, session text
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL
);
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_state text
);
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text,
  waiver_acceptance_id uuid
);
CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid, state text, product_id uuid, team_id uuid,
  team_member_id uuid, participant_id uuid, access_holder_id uuid
);
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid, access_holder_id uuid, participant_id uuid,
  product_id uuid, product_code text, folio_namespace text, folio text,
  state text, issued_at timestamptz, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX uq_tickets_registration ON tickets (registration_id);
CREATE TABLE ticket_credential_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL, generation integer NOT NULL, token_hash text NOT NULL,
  state text NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE access_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL, entitlement_date date, session text, state text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE capability_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text, token_hash text, least_scope text, subject_ref text,
  resource_ref text, ticket_id uuid, order_id uuid, state text, generation integer
);
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_ref text, named_action text, entity_type text, entity_ref text,
  result text, sanitized_metadata jsonb, created_at timestamptz DEFAULT now()
);
CREATE TABLE outbox_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_type text NOT NULL, template text, destination_ref text,
  domain_event_ref text, minimal_payload jsonb, state text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE waiver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE TABLE waiver_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid
);
CREATE FUNCTION public.ticket_new_opaque_token(p_prefix text) RETURNS text
LANGUAGE sql AS $$ SELECT p_prefix || '-opaque' $$;
CREATE FUNCTION public.ticket_hash_token(p_raw text) RETURNS text
LANGUAGE sql AS $$ SELECT 'hash:' || p_raw $$;
`

let client
try {
  await embedded.initialise()
  await embedded.start()
  client = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  })
  await client.connect()
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await client.query(schema)
  await client.query(ticketFn)

  async function seed({ kind, teamSize, orderState, regState, roster, member, code, day }) {
    const product = await client.query(
      `INSERT INTO products (code, kind, day, team_size) VALUES ($1,$2,$3,$4) RETURNING id`,
      [code, kind, day ?? '2026-11-13', teamSize],
    )
    const order = await client.query(
      `INSERT INTO orders (state) VALUES ($1) RETURNING id`,
      [orderState],
    )
    const person = crypto.randomUUID()
    let teamId = null
    let memberId = null
    if (teamSize > 1) {
      const team = await client.query(
        `INSERT INTO teams (roster_state) VALUES ($1) RETURNING id`,
        [roster],
      )
      teamId = team.rows[0].id
      const memberRow = await client.query(
        `INSERT INTO team_members (state) VALUES ($1) RETURNING id`,
        [member],
      )
      memberId = memberRow.rows[0].id
    }
    const reg = await client.query(
      `INSERT INTO registrations (
         order_id, state, product_id, team_id, team_member_id, participant_id, access_holder_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
      [order.rows[0].id, regState, product.rows[0].id, teamId, memberId, person],
    )
    return reg.rows[0].id
  }

  async function issue(id) {
    const result = await client.query(
      `SELECT public.ticket_issue_one_registration($1::uuid) AS result`,
      [id],
    )
    return result.rows[0].result
  }

  async function counts(id) {
    const tickets = await client.query(
      `SELECT count(*)::int AS n FROM tickets WHERE registration_id = $1`,
      [id],
    )
    const jobs = await client.query(
      `SELECT count(*)::int AS n FROM outbox_delivery_jobs WHERE domain_event_ref = $1`,
      [`ticket:${(await client.query(`SELECT id FROM tickets WHERE registration_id = $1`, [id])).rows[0]?.id ?? ''}`],
    )
    const waivers = await client.query(`SELECT count(*)::int AS n FROM waiver_acceptances`)
    const docs = await client.query(`SELECT count(*)::int AS n FROM waiver_documents`)
    return {
      tickets: tickets.rows[0].n,
      jobs: jobs.rows[0].n,
      waivers: waivers.rows[0].n,
      docs: docs.rows[0].n,
    }
  }

  const j1 = await seed({
    kind: 'competitor', teamSize: 1, orderState: 'PAID', regState: 'PAYMENT_CONFIRMED',
    code: 'IND',
  })
  const j1Result = await issue(j1)
  const j1Counts = await counts(j1)
  check(
    'J1 paid without waiver issues one ticket',
    j1Result.ok === true && j1Result.replay === false && j1Counts.tickets === 1 && j1Counts.waivers === 0 && j1Counts.docs === 0,
    JSON.stringify({ j1Result, j1Counts }),
  )
  const j1Again = await issue(j1)
  const j1Replay = await counts(j1)
  check(
    'J1 replay does not duplicate ticket or outbox',
    j1Again.ok === true && j1Again.replay === true && j1Replay.tickets === 1 && j1Replay.jobs === 1 && j1Replay.waivers === 0,
    JSON.stringify({ j1Again, j1Replay }),
  )
  const j1Job = await client.query(
    `SELECT communication_type, template, state, minimal_payload FROM outbox_delivery_jobs`,
  )
  check(
    'J1 outbox is TICKET_READY and contains no raw token',
    j1Job.rows.length === 1
      && j1Job.rows[0].communication_type === 'TICKET_READY'
      && j1Job.rows[0].template === 'TICKET_READY'
      && j1Job.rows[0].state === 'PENDING'
      && !JSON.stringify(j1Job.rows[0].minimal_payload).includes('raw_token'),
    JSON.stringify(j1Job.rows),
  )

  const j2 = await seed({
    kind: 'competitor', teamSize: 2, orderState: 'PAID', regState: 'PAYMENT_CONFIRMED',
    roster: 'ELIGIBLE', member: 'COMPLETE', code: 'DOB',
  })
  const j2Result = await issue(j2)
  const j2Counts = await counts(j2)
  check(
    'J2 eligible team issues without a waiver row',
    j2Result.ok === true && j2Counts.tickets === 1 && j2Counts.waivers === 0,
    JSON.stringify({ j2Result, j2Counts }),
  )

  const j3 = await seed({
    kind: 'competitor', teamSize: 4, orderState: 'PAID', regState: 'PAYMENT_CONFIRMED',
    roster: 'ELIGIBLE', member: 'COMPLETE', code: 'REL',
  })
  const j3Result = await issue(j3)
  const j3Counts = await counts(j3)
  check(
    'J3 eligible relay issues without a waiver row',
    j3Result.ok === true && j3Counts.tickets === 1 && j3Counts.waivers === 0,
    JSON.stringify({ j3Result, j3Counts }),
  )

  const unpaid = await seed({
    kind: 'competitor', teamSize: 1, orderState: 'PAYMENT_PENDING', regState: 'PAYMENT_CONFIRMED',
    code: 'IND-UNPAID',
  })
  const unpaidResult = await issue(unpaid)
  const unpaidTickets = await client.query(`SELECT count(*)::int AS n FROM tickets WHERE registration_id = $1`, [unpaid])
  check(
    'unpaid order cannot get a ticket',
    unpaidResult.ok === false && unpaidResult.error_code === 'ORDER_NOT_PAID' && unpaidTickets.rows[0].n === 0,
    JSON.stringify(unpaidResult),
  )

  const rejected = await seed({
    kind: 'competitor', teamSize: 1, orderState: 'REJECTED', regState: 'PAYMENT_CONFIRMED',
    code: 'IND-REJECTED',
  })
  const rejectedResult = await issue(rejected)
  check(
    'rejected payment cannot get a ticket',
    rejectedResult.ok === false && rejectedResult.error_code === 'ORDER_NOT_PAID',
    JSON.stringify(rejectedResult),
  )

  const cancelled = await seed({
    kind: 'competitor', teamSize: 1, orderState: 'CANCELLED', regState: 'PAYMENT_CONFIRMED',
    code: 'IND-CANCELLED',
  })
  const cancelledResult = await issue(cancelled)
  check(
    'cancelled payment cannot get a ticket',
    cancelledResult.ok === false && cancelledResult.error_code === 'ORDER_NOT_PAID',
    JSON.stringify(cancelledResult),
  )

  const spectator = await seed({
    kind: 'spectator', teamSize: null, orderState: 'PAID', regState: 'PAYMENT_CONFIRMED',
    code: 'PUB-VIE',
  })
  const spectatorResult = await issue(spectator)
  check(
    'spectator still issues without a waiver',
    spectatorResult.ok === true && spectatorResult.replay === false,
    JSON.stringify(spectatorResult),
  )

  const blockedTeam = await seed({
    kind: 'competitor', teamSize: 2, orderState: 'PAID', regState: 'PAYMENT_CONFIRMED',
    roster: 'PAYMENT_PENDING', member: 'STARTED', code: 'DOB-BLOCK',
  })
  const blockedResult = await issue(blockedTeam)
  check(
    'ineligible roster still blocks the team ticket',
    blockedResult.ok === false && blockedResult.error_code === 'ROSTER_NOT_ELIGIBLE',
    JSON.stringify(blockedResult),
  )

  const waiversAfter = await client.query(`SELECT count(*)::int AS n FROM waiver_acceptances`)
  const docsAfter = await client.query(`SELECT count(*)::int AS n FROM waiver_documents`)
  const memberStates = await client.query(`SELECT state, waiver_acceptance_id FROM team_members WHERE state IS NOT NULL`)
  check(
    'no waiver row and no waiver-complete mark',
    waiversAfter.rows[0].n === 0
      && docsAfter.rows[0].n === 0
      && memberStates.rows.every((row) => row.waiver_acceptance_id == null),
    JSON.stringify({ waiversAfter: waiversAfter.rows[0], docsAfter: docsAfter.rows[0], memberStates: memberStates.rows }),
  )

  check(
    'checkout still stores a supplied digital waiver and counts the captain slot',
    migration.includes('INSERT INTO public.waiver_acceptances')
      && migration.includes("v_captain_member_state text := 'COMPLETE'")
      && !migration.includes("v_captain_member_state := 'COMPLETE'"),
  )
  check(
    'ticket function no longer names WAIVER_REQUIRED',
    !ticketFn.includes('WAIVER_REQUIRED') && !ticketFn.includes('waiver_acceptances'),
  )

  console.log(failures.length === 0 ? 'TICKET_WITHOUT_WAIVER_PASS' : 'TICKET_WITHOUT_WAIVER_FAIL')
  if (failures.length) {
    console.log(failures.join('\n'))
    process.exitCode = 1
  }
} finally {
  if (client) await client.end().catch(() => undefined)
  await embedded.stop().catch(() => undefined)
  fs.rmSync(databaseDir, { recursive: true, force: true })
}
