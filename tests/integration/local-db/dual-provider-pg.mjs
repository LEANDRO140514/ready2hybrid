import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const name = 'r2h-p0-pg'
const schema = `
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  state text NOT NULL,
  total_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  external_reference text,
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
  payment_id uuid,
  order_id uuid,
  sanitized_provider_evidence_ref text,
  merchant_ownership_ok boolean,
  external_reference_ok boolean,
  amount_ok boolean,
  currency_ok boolean,
  normalized_result text,
  verified_at timestamptz,
  correlation_id text,
  reconciliation_state text,
  created_at timestamptz NOT NULL DEFAULT now()
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
  sanitized_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  state text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ticket_credential_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid,
  state text
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
CREATE TABLE email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid
);
CREATE FUNCTION team_apply_payment_outcome(p_order uuid, p_outcome text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; END $$;
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

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `docker ${args[0]} failed`)
  }
  return result.stdout
}

function psql(sql) {
  const result = spawnSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
    input: sql,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout.trim()
}

function claim(orderId, provider) {
  return JSON.parse(psql(`SELECT public.claim_payment_attempt('{"order_id":"${orderId}","provider":"${provider}"}'::jsonb)::text;`))
}

const probe = spawnSync('docker', ['info'], { encoding: 'utf8' })
if (probe.status !== 0) {
  console.log('POSTGRES_UNAVAILABLE')
  process.exit(2)
}

spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
docker(['run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=postgres', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])
for (let i = 0; i < 30; i += 1) {
  const ready = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' })
  if (ready.status === 0) break
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
}

const dir = mkdtempSync(join(tmpdir(), 'r2h-p0-'))
writeFileSync(join(dir, 'schema.sql'), schema)
docker(['cp', join(dir, 'schema.sql'), `${name}:/schema.sql`])
docker(['cp', 'insforge/migrations/0032_dual-provider-payment-core.sql', `${name}:/mig.sql`])
docker(['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/schema.sql'])
docker(['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/mig.sql'])

const orderId = psql(`
INSERT INTO orders (id, state, total_cents, external_reference)
VALUES (gen_random_uuid(), 'PAYMENT_PENDING', 30000, 'ref')
RETURNING id;
`)
psql(`
INSERT INTO capacity_holds (order_id, state, expires_at)
VALUES ('${orderId}', 'ACTIVE', now() + interval '15 minutes');
INSERT INTO registrations (order_id, state) VALUES ('${orderId}', 'PENDING_PAYMENT');
`)

function claimAsync(provider) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-t', '-A', '-c',
      `SELECT public.claim_payment_attempt('{"order_id":"${orderId}","provider":"${provider}"}'::jsonb)::text;`])
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || stdout))
      else resolve(stdout.trim())
    })
  })
}
const parallel = await Promise.all([claimAsync('MERCADOPAGO'), claimAsync('OPENPAY')])
if (!parallel.every((row) => row.includes('attempt_id') || row.includes('ATTEMPT_OPEN'))) {
  throw new Error(parallel.join('\n'))
}
const openCount = Number(psql(`SELECT count(*) FROM payments WHERE order_id = '${orderId}' AND normalized_state IN ('UNKNOWN','PENDING');`))
if (openCount !== 1) throw new Error(`expected 1 open attempt, got ${openCount}`)

const blocked = claim(orderId, 'OPENPAY')
if (blocked.error_code !== 'ATTEMPT_OPEN' && blocked.reused !== true) {
  throw new Error(`second provider was not blocked: ${JSON.stringify(blocked)}`)
}

psql(`UPDATE payments SET normalized_state = 'REJECTED' WHERE order_id = '${orderId}';`)
const switched = claim(orderId, 'OPENPAY')
if (!switched.ok) throw new Error(`switch claim failed: ${JSON.stringify(switched)}`)
const hold = psql(`SELECT state FROM capacity_holds WHERE order_id = '${orderId}';`)
if (hold !== 'ACTIVE') throw new Error(`hold changed to ${hold}`)

const paid = JSON.parse(psql(`
SELECT public.webhook_apply_payment_tx(jsonb_build_object(
  'provider', 'OPENPAY',
  'provider_notification_id', 'n1',
  'provider_payment_id', 'op-1',
  'normalized_state', 'APPROVED',
  'amount_cents', 30000,
  'currency', 'MXN',
  'external_reference', '${orderId}',
  'merchant_ownership_ok', true,
  'external_reference_ok', true,
  'amount_ok', true,
  'currency_ok', true
))::text;
`))
if (paid.outcome !== 'PAID') throw new Error(`expected PAID, got ${JSON.stringify(paid)}`)
const winner = psql(`SELECT p.provider FROM orders o JOIN payments p ON p.id = o.paid_payment_id WHERE o.id = '${orderId}';`)
if (winner !== 'OPENPAY') throw new Error(`winner ${winner}`)
const tickets = Number(psql(`SELECT count(*) FROM tickets t JOIN registrations r ON r.id = t.registration_id WHERE r.order_id = '${orderId}';`))
const emails = Number(psql(`SELECT count(*) FROM email_sends WHERE order_id = '${orderId}';`))
if (tickets !== 1 || emails !== 1) throw new Error(`tickets ${tickets} emails ${emails}`)
const again = JSON.parse(psql(`
SELECT public.webhook_apply_payment_tx(jsonb_build_object(
  'provider', 'OPENPAY',
  'provider_notification_id', 'n2',
  'provider_payment_id', 'op-1',
  'normalized_state', 'APPROVED',
  'amount_cents', 30000,
  'currency', 'MXN',
  'external_reference', '${orderId}',
  'merchant_ownership_ok', true,
  'external_reference_ok', true,
  'amount_ok', true,
  'currency_ok', true
))::text;
`))
if (again.outcome !== 'ALREADY_PAID') throw new Error(`repeat ${JSON.stringify(again)}`)
const emailsAfter = Number(psql(`SELECT count(*) FROM email_sends WHERE order_id = '${orderId}';`))
if (emailsAfter !== 1) throw new Error(`second email ${emailsAfter}`)

const indexBlocked = spawnSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-c', `
INSERT INTO payments (provider, order_id, normalized_state) VALUES
  ('MERCADOPAGO', '${orderId}', 'UNKNOWN'),
  ('OPENPAY', '${orderId}', 'PENDING');
`], { encoding: 'utf8' })
if (indexBlocked.status === 0) throw new Error('partial index allowed two open attempts')

console.log('POSTGRES_OK')
spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
