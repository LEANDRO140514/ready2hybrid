/**
 * Local embedded-Postgres harness for Pricing-A FIX-1.
 * Uses npm package `embedded-postgres` (not saved to package.json).
 * Never targets remote InsForge / Main.
 */
import EmbeddedPostgres from 'embedded-postgres'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

export type LocalPg = {
  port: number
  databaseDir: string
  stop: () => Promise<void>
  connect: () => Promise<Client>
}

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

export async function startLocalPostgres(label: string): Promise<LocalPg> {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), `r2h-${label}-`))
  const port = 54332 + Math.floor(Math.random() * 200)
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
  })
  await pg.initialise()
  await pg.start()
  return {
    port,
    databaseDir,
    async connect() {
      const client = new Client({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres',
      })
      await client.connect()
      return client
    },
    async stop() {
      await pg.stop()
      fs.rmSync(databaseDir, { recursive: true, force: true })
    },
  }
}

export async function bootstrapRoles(client: Client): Promise<void> {
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE project_admin NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

/** Minimal pre-0018 sales surface for commercial migration/concurrency tests. */
export async function applyMinimalPre0018Schema(client: Client): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
  await client.query(`
    CREATE TABLE public.events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'CONFIGURADO',
      sales_open_at timestamptz,
      sales_close_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.events
      ADD CONSTRAINT events_id_code_uq UNIQUE (id, code);

    CREATE TABLE public.products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      block text NOT NULL DEFAULT 'COMPITE',
      kind text NOT NULL DEFAULT 'competitor',
      sale_state text,
      visibility text,
      cupo integer NOT NULL,
      price_cents bigint NOT NULL,
      currency text NOT NULL DEFAULT 'MXN',
      team_size integer NOT NULL DEFAULT 1,
      event_code text NOT NULL REFERENCES public.events(code),
      has_chip boolean NOT NULL DEFAULT false,
      has_insurance boolean NOT NULL DEFAULT false,
      day text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.buyer_contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      public_ref text NOT NULL,
      state text NOT NULL DEFAULT 'ACTIVE'
    );

    CREATE TABLE public.participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      public_ref text NOT NULL,
      buyer_contact_id uuid REFERENCES public.buyer_contacts(id),
      participation_type text NOT NULL,
      state text NOT NULL DEFAULT 'ACTIVE'
    );

    CREATE TABLE public.orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_contact_id uuid,
      state text NOT NULL,
      currency text NOT NULL DEFAULT 'MXN',
      subtotal_cents bigint NOT NULL,
      total_cents bigint NOT NULL,
      tracking_ref text,
      external_reference text,
      idempotency_key_hash text,
      idempotency_scope text,
      expires_at timestamptz,
      commercial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES public.orders(id),
      product_id uuid NOT NULL REFERENCES public.products(id),
      product_code text NOT NULL,
      quantity integer NOT NULL,
      unit_price_cents bigint NOT NULL,
      item_total_cents bigint NOT NULL,
      currency text NOT NULL DEFAULT 'MXN',
      journey text,
      capacity_unit text,
      commercial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL,
      event_code text NOT NULL,
      product_id uuid NOT NULL,
      product_code text NOT NULL,
      participant_id uuid NOT NULL,
      order_id uuid,
      journey text,
      state text NOT NULL DEFAULT 'STARTED',
      team_id uuid,
      team_member_id uuid,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.capacity_holds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id),
      product_code text NOT NULL,
      order_id uuid,
      order_item_id uuid,
      capacity_units integer NOT NULL DEFAULT 1,
      state text NOT NULL,
      expires_at timestamptz,
      reason text,
      converted_at timestamptz,
      released_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.idempotency_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      scope text NOT NULL,
      actor_context text,
      key_hash text NOT NULL,
      request_fingerprint text NOT NULL,
      state text NOT NULL,
      response_ref text,
      expires_at timestamptz
    );

    CREATE TABLE public.capability_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL,
      token_hash text NOT NULL,
      least_scope text,
      subject_ref text,
      resource_ref text,
      slot_ref text,
      order_id uuid,
      team_id uuid,
      team_member_id uuid,
      state text NOT NULL,
      generation integer NOT NULL DEFAULT 1,
      expires_at timestamptz
    );

    CREATE TABLE public.activity_log (
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

    CREATE TABLE public.teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      public_ref text,
      product_id uuid,
      product_code text,
      captain_participant_id uuid,
      captain_team_member_id uuid,
      required_size integer,
      slots_complete integer,
      roster_state text,
      payment_state text,
      eligibility_state text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.team_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid,
      position integer,
      role text,
      participant_id uuid,
      registration_id uuid,
      state text,
      waiver_acceptance_id uuid,
      invitation_capability_id uuid,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.waiver_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_type text NOT NULL,
      version text NOT NULL,
      state text NOT NULL,
      valid_from timestamptz,
      UNIQUE (document_type, version)
    );

    CREATE TABLE public.waiver_acceptances (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      waiver_document_id uuid,
      document_type text,
      document_version text,
      participant_id uuid,
      actor_ref text,
      context text,
      authorized_evidence jsonb,
      accepted_at timestamptz
    );

    CREATE TABLE public.webhook_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL,
      provider_notification_id text NOT NULL,
      notification_type text,
      signature_result text,
      canonical_input_hash text,
      sanitized_headers jsonb,
      processing_state text,
      attempts integer,
      result text,
      sanitized_error text,
      payment_id uuid,
      received_at timestamptz,
      processed_at timestamptz,
      updated_at timestamptz,
      UNIQUE (provider, provider_notification_id)
    );

    CREATE TABLE public.payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL,
      provider_payment_id text NOT NULL,
      order_id uuid,
      external_state text,
      normalized_state text,
      amount_cents bigint,
      currency text,
      external_reference text,
      provider_created_at timestamptz,
      provider_updated_at timestamptz,
      last_verified_at timestamptz,
      sanitized_evidence_ref text,
      reconciliation_state text,
      updated_at timestamptz,
      UNIQUE (provider, provider_payment_id)
    );

    CREATE TABLE public.payment_verification_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL,
      payment_id uuid NOT NULL,
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

    CREATE TABLE public.outbox_delivery_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      communication_type text,
      template text,
      destination_ref text,
      domain_event_ref text,
      minimal_payload jsonb,
      state text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid,
      registration_id uuid,
      state text
    );

    CREATE TABLE public.ticket_credential_generations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id uuid,
      generation integer,
      state text
    );

    CREATE OR REPLACE FUNCTION public.team_apply_payment_outcome(p_order_id uuid, p_outcome text)
    RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;

    CREATE OR REPLACE FUNCTION public.ticket_issue_after_payment(p_order_id uuid)
    RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;
  `)
}

export async function applySqlFile(client: Client, filePath: string): Promise<void> {
  const raw = fs.readFileSync(filePath, 'utf8')
  // EXECUTE PROCEDURE is accepted; keep as-is for PG18.
  await client.query(raw)
}

export function migrationPath(name: string): string {
  return path.resolve(process.cwd(), 'insforge/migrations', name)
}

export { stripSqlComments }
