-- =====================================================================
-- 0001_minimal_sales_schema.sql
-- Purpose: Materialize the IMPL-2 physical minimum schema for Ready2Hybrid
--          public sales, derived from SPEC-032 v0.1.0 APPROVED.
-- Authority: Explicit Project Owner authorization for IMPL-2 migration-only.
--
-- Limits of this migration:
--  · Creates the 24 logical entities as tables.
--  · Preserves structural compatibility with
--    insforge/seeds/0002_seeds_hybrid_event.sql for a future IMPL-5.
--  · Does NOT insert catalog or transactional data.
--  · Does NOT create referential constraints, business checks, or business indexes.
--  · Does NOT create RLS, policies, grants, functions, triggers, or extensions.
--  · Does NOT deploy to the canonical InsForge project.
--
-- Reserved for IMPL-3: constraints, cardinality rules, indexes, state/money checks.
-- Reserved for IMPL-4: RLS and access policies.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. events  (logical: Event)
-- Seed-compatible columns: code, name, venue_city, timezone,
-- starts_on, ends_on, status
-- ---------------------------------------------------------------------
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  venue_city text NOT NULL,
  timezone text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  sales_open_at timestamptz,
  sales_close_at timestamptz,
  public_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE events IS 'SPEC-032 Event; public event and sales boundary.';

-- ---------------------------------------------------------------------
-- 2. event_days  (logical: EventDaySession)
-- Seed-compatible columns: event_code, day_date, label
-- ---------------------------------------------------------------------
CREATE TABLE event_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  day_date date NOT NULL,
  label text NOT NULL,
  public_order integer,
  session text,
  state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_days IS 'SPEC-032 EventDaySession; date/session validity and public labels.';

-- ---------------------------------------------------------------------
-- 3. products  (logical: Product)
-- Seed-compatible columns: event_code, code, name, block, kind,
-- team_size, price_cents, cupo, day, session, has_chip, has_insurance
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  block text NOT NULL,
  kind text NOT NULL,
  journey text,
  composition text,
  team_size integer NOT NULL,
  price_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  cupo integer NOT NULL,
  capacity_unit text,
  day date,
  session text,
  has_chip boolean NOT NULL,
  has_insurance boolean NOT NULL,
  sale_state text,
  visibility text,
  public_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE products IS 'SPEC-032 Product; configured sale unit. price_cents is integer MXN cents for the complete sale unit.';
COMMENT ON COLUMN products.cupo IS 'Seed-compatible capacity column; capacity unit semantics governed by journey.';
COMMENT ON COLUMN products.day IS 'Seed-compatible schedule date; NULL for multi-day products.';
COMMENT ON COLUMN products.session IS 'Seed-compatible AM/PM/NULL session marker.';

-- ---------------------------------------------------------------------
-- 4. buyer_contacts  (logical: BuyerContact)
-- Exact personal fields remain open decisions; shell only.
-- ---------------------------------------------------------------------
CREATE TABLE buyer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref text,
  state text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE buyer_contacts IS 'SPEC-032 BuyerContact shell; not automatically payer/participant/access holder.';

-- ---------------------------------------------------------------------
-- 5. participants  (logical: Participant)
-- Exact personal fields remain open decisions; shell only.
-- ---------------------------------------------------------------------
CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref text,
  buyer_contact_id uuid,
  participation_type text,
  state text NOT NULL DEFAULT 'STARTED',
  eligibility_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE participants IS 'SPEC-032 Participant shell; personal field inventory governed by open decisions.';

-- ---------------------------------------------------------------------
-- 6. participant_sensitive_profiles
-- Structural shell only; no medical/emergency columns until approved.
-- ---------------------------------------------------------------------
CREATE TABLE participant_sensitive_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'RESTRICTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE participant_sensitive_profiles IS 'SPEC-032 ParticipantSensitiveProfile shell; no medical or emergency columns in IMPL-2.';

-- ---------------------------------------------------------------------
-- 7. registrations  (logical: Registration)
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  event_code text,
  product_id uuid,
  product_code text,
  participant_id uuid,
  access_holder_id uuid,
  team_id uuid,
  team_member_id uuid,
  order_id uuid,
  journey text,
  state text NOT NULL DEFAULT 'STARTED',
  eligibility_state text,
  registration_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE registrations IS 'SPEC-032 Registration; person/access enrollment linked to product/order/team when applicable.';

-- ---------------------------------------------------------------------
-- 8. teams  (logical: Team)
-- ---------------------------------------------------------------------
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref text,
  product_id uuid,
  product_code text,
  captain_participant_id uuid,
  captain_team_member_id uuid,
  name text,
  required_size integer NOT NULL,
  slots_complete integer NOT NULL DEFAULT 0,
  roster_state text NOT NULL DEFAULT 'PROVISIONAL',
  payment_state text,
  eligibility_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE teams IS 'SPEC-032 Team; J2/J3 roster aggregate. Cardinality constraints reserved for IMPL-3.';

-- ---------------------------------------------------------------------
-- 9. team_members  (logical: TeamMember)
-- ---------------------------------------------------------------------
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  position integer NOT NULL,
  role text NOT NULL,
  participant_id uuid,
  registration_id uuid,
  state text NOT NULL DEFAULT 'INVITED',
  waiver_acceptance_id uuid,
  invitation_capability_id uuid,
  substitution_of_member_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE team_members IS 'SPEC-032 TeamMember; fixed roster slot. Slot cardinality reserved for IMPL-3.';

-- ---------------------------------------------------------------------
-- 10. capability_credentials  (logical: CapabilityCredential)
-- Stores hashes only; never recoverable raw tokens.
-- ---------------------------------------------------------------------
CREATE TABLE capability_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  token_hash text NOT NULL,
  least_scope text NOT NULL,
  subject_ref text,
  resource_ref text,
  slot_ref text,
  order_id uuid,
  team_id uuid,
  team_member_id uuid,
  ticket_id uuid,
  state text NOT NULL DEFAULT 'ISSUED',
  generation integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  replaced_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE capability_credentials IS 'SPEC-032 CapabilityCredential; opaque hashed credentials for order/captain/invite/ticket scopes.';
COMMENT ON COLUMN capability_credentials.token_hash IS 'Non-recoverable hash of exchange code or scoped capability token.';

-- ---------------------------------------------------------------------
-- 11. waiver_documents  (logical: WaiverDocument)
-- ---------------------------------------------------------------------
CREATE TABLE waiver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  version text NOT NULL,
  content_ref text,
  integrity_hash text,
  valid_from timestamptz,
  valid_to timestamptz,
  state text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE waiver_documents IS 'SPEC-032 WaiverDocument; versioned legal/consent reference without inventing legal text.';

-- ---------------------------------------------------------------------
-- 12. waiver_acceptances  (logical: WaiverAcceptance)
-- ---------------------------------------------------------------------
CREATE TABLE waiver_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_document_id uuid NOT NULL,
  document_type text,
  document_version text NOT NULL,
  participant_id uuid,
  access_holder_id uuid,
  actor_ref text,
  context text,
  authorized_evidence jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE waiver_acceptances IS 'SPEC-032 WaiverAcceptance; individual acceptance evidence for an exact waiver version.';

-- ---------------------------------------------------------------------
-- 13. orders  (logical: Order)
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_contact_id uuid,
  state text NOT NULL DEFAULT 'CREATED',
  currency text NOT NULL DEFAULT 'MXN',
  subtotal_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  tracking_ref text,
  external_reference text,
  idempotency_key_hash text,
  idempotency_scope text,
  expires_at timestamptz,
  cancellation_reason text,
  commercial_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE orders IS 'SPEC-032 Order; commercial intent with integer MXN totals and opaque tracking/external refs.';

-- ---------------------------------------------------------------------
-- 14. order_items  (logical: OrderItem)
-- ---------------------------------------------------------------------
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid,
  product_code text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL,
  item_total_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  journey text,
  capacity_unit text,
  commercial_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_items IS 'SPEC-032 OrderItem; priced configured item with immutable commercial snapshot.';

-- ---------------------------------------------------------------------
-- 15. capacity_holds  (logical: CapacityHold)
-- ---------------------------------------------------------------------
CREATE TABLE capacity_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  product_code text,
  order_id uuid,
  order_item_id uuid,
  capacity_units integer NOT NULL,
  state text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  converted_at timestamptz,
  released_at timestamptz,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE capacity_holds IS 'SPEC-032 CapacityHold; temporary inventory claim bound to an exact order item.';

-- ---------------------------------------------------------------------
-- 16. payments  (logical: Payment)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_payment_id text,
  order_id uuid,
  payer_identity_ref text,
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

COMMENT ON TABLE payments IS 'SPEC-032 Payment; provider payment state without card or recoverable token storage.';

-- ---------------------------------------------------------------------
-- 17. payment_verification_records
-- ---------------------------------------------------------------------
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

COMMENT ON TABLE payment_verification_records IS 'SPEC-032 PaymentVerificationRecord; durable pre-effect verification evidence.';

-- ---------------------------------------------------------------------
-- 18. webhook_events  (logical: WebhookEvent)
-- ---------------------------------------------------------------------
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

COMMENT ON TABLE webhook_events IS 'SPEC-032 WebhookEvent; signed notification boundary with hashes/sanitized inputs only.';

-- ---------------------------------------------------------------------
-- 19. idempotency_records  (logical: IdempotencyRecord)
-- ---------------------------------------------------------------------
CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  actor_context text,
  key_hash text NOT NULL,
  request_fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'IN_PROGRESS',
  response_ref text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE idempotency_records IS 'SPEC-032 IdempotencyRecord; retry/effect identity by scope and key hash.';

-- ---------------------------------------------------------------------
-- 20. tickets  (logical: Ticket)
-- ---------------------------------------------------------------------
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid,
  access_holder_id uuid,
  participant_id uuid,
  product_id uuid,
  product_code text,
  folio_namespace text,
  folio text,
  state text NOT NULL DEFAULT 'PENDING',
  issued_at timestamptz,
  revoked_at timestamptz,
  reissued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tickets IS 'SPEC-032 Ticket; canonical entitlement carrier without embedding raw QR credentials.';

-- ---------------------------------------------------------------------
-- 21. ticket_credential_generations
-- ---------------------------------------------------------------------
CREATE TABLE ticket_credential_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  generation integer NOT NULL,
  token_hash text NOT NULL,
  state text NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  prior_generation_id uuid,
  replacement_generation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ticket_credential_generations IS 'SPEC-032 TicketCredentialGeneration; immutable hashed QR credential generations.';
COMMENT ON COLUMN ticket_credential_generations.token_hash IS 'Non-recoverable hash of the opaque QR credential token.';

-- ---------------------------------------------------------------------
-- 22. access_entitlements  (logical: AccessEntitlement)
-- ---------------------------------------------------------------------
CREATE TABLE access_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  entitlement_date date,
  session text,
  state text NOT NULL DEFAULT 'AVAILABLE',
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE access_entitlements IS 'SPEC-032 AccessEntitlement; date/session rights. Three-day scan policy remains an open decision.';

-- ---------------------------------------------------------------------
-- 23. activity_log  (logical: ActivityLog)
-- ---------------------------------------------------------------------
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_ref text,
  named_action text NOT NULL,
  entity_type text,
  entity_ref text,
  result text,
  failure_class text,
  correlation_id text,
  idempotency_fingerprint text,
  sanitized_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_log IS 'SPEC-032 ActivityLog; sanitized sensitive-action evidence without credentials or medical payloads.';

-- ---------------------------------------------------------------------
-- 24. outbox_delivery_jobs  (logical: OutboxDeliveryJob)
-- ---------------------------------------------------------------------
CREATE TABLE outbox_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_type text NOT NULL,
  template text,
  destination_ref text,
  domain_event_ref text,
  minimal_payload jsonb,
  state text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE outbox_delivery_jobs IS 'SPEC-032 OutboxDeliveryJob; durable communication work. Delivery failure must not revert domain truth.';

COMMIT;
