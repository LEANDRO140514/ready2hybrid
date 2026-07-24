-- =====================================================================
-- 0002_sales_constraints_and_indexes.sql
-- Purpose: Declarative integrity constraints and supporting indexes for
--          the Ready2Hybrid minimal sales schema (SPEC-032 v0.1.0).
-- Authority: Explicit Project Owner authorization for IMPL-3
--            constraints-and-indexes-only.
-- Depends on: 0001_minimal_sales_schema.sql
--
-- Limits of this migration:
--  · Adds FOREIGN KEY, UNIQUE, CHECK, NOT NULL, and INDEX objects only.
--  · Does NOT create tables, insert/update/delete data, or seed catalog.
--  · Does NOT create Postgres extensions, SQL routines, triggers, policies, or RLS.
--  · Does NOT deploy to the canonical InsForge project.
--  · Does NOT encode open decisions (folio format, hold TTL, three-day
--    entitlement count, personal/medical fields, refunds, roles).
--
-- Runtime invariants deferred to IMPL-7..IMPL-11 (not enforced here):
--  · atomic last-capacity reservation / consumed capacity totals
--  · sum(order_items) = order.total_cents
--  · max active team slots = product.team_size / full roster completeness
--  · participant composition rules / exact J2/J3 ticket-set creation
--  · state transition authorization and ordering
--  · payment merchant/reference/amount/currency verification
--  · same idempotency key + different fingerprint service response
--  · webhook signature validation / capability expiry durations
--  · rate limits / three-day exact entitlement count
--  · ticket issuance/reissue transaction / outbox atomicity with domain
--
-- Reserved for IMPL-4: RLS and access policies.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Candidate keys required by composite foreign keys
-- ---------------------------------------------------------------------

ALTER TABLE events
  ADD CONSTRAINT uq_events_code UNIQUE (code);

ALTER TABLE events
  ADD CONSTRAINT uq_events_id_code UNIQUE (id, code);

ALTER TABLE products
  ADD CONSTRAINT uq_products_event_code_code UNIQUE (event_code, code);

ALTER TABLE products
  ADD CONSTRAINT uq_products_id_code UNIQUE (id, code);

ALTER TABLE products
  ADD CONSTRAINT uq_products_id_event_code_code UNIQUE (id, event_code, code);

ALTER TABLE waiver_documents
  ADD CONSTRAINT uq_waiver_documents_type_version UNIQUE (document_type, version);

ALTER TABLE waiver_documents
  ADD CONSTRAINT uq_waiver_documents_id_type_version UNIQUE (id, document_type, version);

ALTER TABLE participant_sensitive_profiles
  ADD CONSTRAINT uq_participant_sensitive_profiles_participant UNIQUE (participant_id);

ALTER TABLE capability_credentials
  ADD CONSTRAINT uq_capability_credentials_token_hash UNIQUE (token_hash);

ALTER TABLE tickets
  ADD CONSTRAINT uq_tickets_registration UNIQUE (registration_id);

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT uq_ticket_credential_generations_token_hash UNIQUE (token_hash);

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT uq_ticket_credential_generations_ticket_generation
  UNIQUE (ticket_id, generation);

-- ---------------------------------------------------------------------
-- NOT NULL additions required by SPEC-032 / IMPL-3 authorization
-- ---------------------------------------------------------------------

ALTER TABLE registrations
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN event_code SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN product_code SET NOT NULL,
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN journey SET NOT NULL;

ALTER TABLE waiver_acceptances
  ALTER COLUMN document_type SET NOT NULL;

ALTER TABLE orders
  ALTER COLUMN buyer_contact_id SET NOT NULL;

ALTER TABLE order_items
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN product_code SET NOT NULL,
  ALTER COLUMN journey SET NOT NULL,
  ALTER COLUMN capacity_unit SET NOT NULL,
  ALTER COLUMN commercial_snapshot SET NOT NULL;

ALTER TABLE capacity_holds
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN product_code SET NOT NULL,
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN order_item_id SET NOT NULL;

ALTER TABLE payments
  ALTER COLUMN order_id SET NOT NULL;

ALTER TABLE payment_verification_records
  ALTER COLUMN payment_id SET NOT NULL,
  ALTER COLUMN order_id SET NOT NULL;

ALTER TABLE tickets
  ALTER COLUMN registration_id SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN product_code SET NOT NULL;

-- ---------------------------------------------------------------------
-- Foreign keys — catalog
-- ---------------------------------------------------------------------

ALTER TABLE event_days
  ADD CONSTRAINT fk_event_days_event_code
  FOREIGN KEY (event_code)
  REFERENCES events (code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE products
  ADD CONSTRAINT fk_products_event_code
  FOREIGN KEY (event_code)
  REFERENCES events (code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Foreign keys — identity and profiles
-- ---------------------------------------------------------------------

ALTER TABLE participants
  ADD CONSTRAINT fk_participants_buyer_contact
  FOREIGN KEY (buyer_contact_id)
  REFERENCES buyer_contacts (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE participant_sensitive_profiles
  ADD CONSTRAINT fk_participant_sensitive_profiles_participant
  FOREIGN KEY (participant_id)
  REFERENCES participants (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Foreign keys — registrations
-- ---------------------------------------------------------------------

ALTER TABLE registrations
  ADD CONSTRAINT fk_registrations_event_id_code
  FOREIGN KEY (event_id, event_code)
  REFERENCES events (id, code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE registrations
  ADD CONSTRAINT fk_registrations_product_id_event_code_code
  FOREIGN KEY (product_id, event_code, product_code)
  REFERENCES products (id, event_code, code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE registrations
  ADD CONSTRAINT fk_registrations_participant
  FOREIGN KEY (participant_id)
  REFERENCES participants (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE registrations
  ADD CONSTRAINT fk_registrations_team
  FOREIGN KEY (team_id)
  REFERENCES teams (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE registrations
  ADD CONSTRAINT fk_registrations_team_member
  FOREIGN KEY (team_member_id)
  REFERENCES team_members (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE registrations
  ADD CONSTRAINT fk_registrations_order
  FOREIGN KEY (order_id)
  REFERENCES orders (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Foreign keys — teams and team_members (cyclic refs deferred)
-- ---------------------------------------------------------------------

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_product_id_code
  FOREIGN KEY (product_id, product_code)
  REFERENCES products (id, code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_captain_participant
  FOREIGN KEY (captain_participant_id)
  REFERENCES participants (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_captain_team_member
  FOREIGN KEY (captain_team_member_id)
  REFERENCES team_members (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_team
  FOREIGN KEY (team_id)
  REFERENCES teams (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_participant
  FOREIGN KEY (participant_id)
  REFERENCES participants (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_registration
  FOREIGN KEY (registration_id)
  REFERENCES registrations (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_waiver_acceptance
  FOREIGN KEY (waiver_acceptance_id)
  REFERENCES waiver_acceptances (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_invitation_capability
  FOREIGN KEY (invitation_capability_id)
  REFERENCES capability_credentials (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_substitution_of_member
  FOREIGN KEY (substitution_of_member_id)
  REFERENCES team_members (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------
-- Foreign keys — capabilities
-- ---------------------------------------------------------------------

ALTER TABLE capability_credentials
  ADD CONSTRAINT fk_capability_credentials_order
  FOREIGN KEY (order_id)
  REFERENCES orders (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE capability_credentials
  ADD CONSTRAINT fk_capability_credentials_team
  FOREIGN KEY (team_id)
  REFERENCES teams (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE capability_credentials
  ADD CONSTRAINT fk_capability_credentials_team_member
  FOREIGN KEY (team_member_id)
  REFERENCES team_members (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE capability_credentials
  ADD CONSTRAINT fk_capability_credentials_ticket
  FOREIGN KEY (ticket_id)
  REFERENCES tickets (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE capability_credentials
  ADD CONSTRAINT fk_capability_credentials_replaced_by
  FOREIGN KEY (replaced_by)
  REFERENCES capability_credentials (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------
-- Foreign keys — waivers
-- ---------------------------------------------------------------------

ALTER TABLE waiver_acceptances
  ADD CONSTRAINT fk_waiver_acceptances_document
  FOREIGN KEY (waiver_document_id)
  REFERENCES waiver_documents (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE waiver_acceptances
  ADD CONSTRAINT fk_waiver_acceptances_document_version
  FOREIGN KEY (waiver_document_id, document_type, document_version)
  REFERENCES waiver_documents (id, document_type, version)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE waiver_acceptances
  ADD CONSTRAINT fk_waiver_acceptances_participant
  FOREIGN KEY (participant_id)
  REFERENCES participants (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Foreign keys — orders, items, holds
-- ---------------------------------------------------------------------

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_buyer_contact
  FOREIGN KEY (buyer_contact_id)
  REFERENCES buyer_contacts (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_order
  FOREIGN KEY (order_id)
  REFERENCES orders (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_product_id_code
  FOREIGN KEY (product_id, product_code)
  REFERENCES products (id, code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE capacity_holds
  ADD CONSTRAINT fk_capacity_holds_product_id_code
  FOREIGN KEY (product_id, product_code)
  REFERENCES products (id, code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE capacity_holds
  ADD CONSTRAINT fk_capacity_holds_order
  FOREIGN KEY (order_id)
  REFERENCES orders (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE capacity_holds
  ADD CONSTRAINT fk_capacity_holds_order_item
  FOREIGN KEY (order_item_id)
  REFERENCES order_items (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Foreign keys — payments and webhook
-- ---------------------------------------------------------------------

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_order
  FOREIGN KEY (order_id)
  REFERENCES orders (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE payment_verification_records
  ADD CONSTRAINT fk_payment_verification_records_payment
  FOREIGN KEY (payment_id)
  REFERENCES payments (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE payment_verification_records
  ADD CONSTRAINT fk_payment_verification_records_order
  FOREIGN KEY (order_id)
  REFERENCES orders (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE webhook_events
  ADD CONSTRAINT fk_webhook_events_payment
  FOREIGN KEY (payment_id)
  REFERENCES payments (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Foreign keys — tickets and entitlements
-- ---------------------------------------------------------------------

ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_registration
  FOREIGN KEY (registration_id)
  REFERENCES registrations (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_participant
  FOREIGN KEY (participant_id)
  REFERENCES participants (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_product_id_code
  FOREIGN KEY (product_id, product_code)
  REFERENCES products (id, code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT fk_ticket_credential_generations_ticket
  FOREIGN KEY (ticket_id)
  REFERENCES tickets (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT fk_ticket_credential_generations_prior
  FOREIGN KEY (prior_generation_id)
  REFERENCES ticket_credential_generations (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT fk_ticket_credential_generations_replacement
  FOREIGN KEY (replacement_generation_id)
  REFERENCES ticket_credential_generations (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE access_entitlements
  ADD CONSTRAINT fk_access_entitlements_ticket
  FOREIGN KEY (ticket_id)
  REFERENCES tickets (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- Check constraints
-- ---------------------------------------------------------------------

ALTER TABLE events
  ADD CONSTRAINT ck_events_date_order
  CHECK (starts_on <= ends_on);

ALTER TABLE events
  ADD CONSTRAINT ck_events_sales_window
  CHECK (
    sales_open_at IS NULL
    OR sales_close_at IS NULL
    OR sales_open_at <= sales_close_at
  );

ALTER TABLE products
  ADD CONSTRAINT ck_products_team_size_positive
  CHECK (team_size > 0);

ALTER TABLE products
  ADD CONSTRAINT ck_products_price_nonnegative
  CHECK (price_cents >= 0);

ALTER TABLE products
  ADD CONSTRAINT ck_products_cupo_nonnegative
  CHECK (cupo >= 0);

ALTER TABLE products
  ADD CONSTRAINT ck_products_currency_mxn
  CHECK (currency = 'MXN');

ALTER TABLE products
  ADD CONSTRAINT ck_products_block
  CHECK (block IN ('COMPITE', 'EXPERIENCE', 'ASISTE'));

ALTER TABLE products
  ADD CONSTRAINT ck_products_kind
  CHECK (kind IN ('competitor', 'workout', 'spectator', 'press'));

ALTER TABLE products
  ADD CONSTRAINT ck_products_journey
  CHECK (journey IS NULL OR journey IN ('J1', 'J2', 'J3', 'J4', 'J5'));

ALTER TABLE products
  ADD CONSTRAINT ck_products_session
  CHECK (session IS NULL OR session IN ('AM', 'PM'));

ALTER TABLE registrations
  ADD CONSTRAINT ck_registrations_exactly_one_holder
  CHECK (num_nonnulls(participant_id, access_holder_id) = 1);

ALTER TABLE teams
  ADD CONSTRAINT ck_teams_required_size_positive
  CHECK (required_size > 0);

ALTER TABLE teams
  ADD CONSTRAINT ck_teams_slots_complete_bounds
  CHECK (slots_complete >= 0 AND slots_complete <= required_size);

ALTER TABLE teams
  ADD CONSTRAINT ck_teams_roster_state
  CHECK (
    roster_state IN (
      'PROVISIONAL',
      'PAYMENT_PENDING',
      'PAID_ROSTER_INCOMPLETE',
      'PAID_ROSTER_COMPLETE',
      'ELIGIBLE',
      'BLOCKED',
      'CANCELLED'
    )
  );

ALTER TABLE team_members
  ADD CONSTRAINT ck_team_members_position_positive
  CHECK (position > 0);

ALTER TABLE team_members
  ADD CONSTRAINT ck_team_members_role
  CHECK (role IN ('CAPTAIN', 'INVITEE'));

ALTER TABLE team_members
  ADD CONSTRAINT ck_team_members_state
  CHECK (
    state IN (
      'INVITED',
      'STARTED',
      'DATA_COMPLETE',
      'WAIVER_ACCEPTED',
      'COMPLETE',
      'REMOVED',
      'REPLACED'
    )
  );

ALTER TABLE capability_credentials
  ADD CONSTRAINT ck_capability_credentials_generation_positive
  CHECK (generation > 0);

ALTER TABLE capability_credentials
  ADD CONSTRAINT ck_capability_credentials_kind
  CHECK (
    kind IN (
      'INVITATION_EXCHANGE_CODE',
      'ORDER_HOLDER',
      'CAPTAIN',
      'INVITED_MEMBER',
      'TICKET_ACCESS'
    )
  );

ALTER TABLE capability_credentials
  ADD CONSTRAINT ck_capability_credentials_state
  CHECK (
    state IN (
      'ISSUED',
      'DELIVERED',
      'OPENED',
      'CONSUMED',
      'ACTIVE',
      'ROTATED',
      'REVOKED',
      'EXPIRED',
      'REPLACED'
    )
  );

ALTER TABLE waiver_documents
  ADD CONSTRAINT ck_waiver_documents_validity_window
  CHECK (
    valid_from IS NULL
    OR valid_to IS NULL
    OR valid_from <= valid_to
  );

ALTER TABLE waiver_acceptances
  ADD CONSTRAINT ck_waiver_acceptances_exactly_one_holder
  CHECK (num_nonnulls(participant_id, access_holder_id) = 1);

ALTER TABLE orders
  ADD CONSTRAINT ck_orders_subtotal_nonnegative
  CHECK (subtotal_cents >= 0);

ALTER TABLE orders
  ADD CONSTRAINT ck_orders_total_nonnegative
  CHECK (total_cents >= 0);

ALTER TABLE orders
  ADD CONSTRAINT ck_orders_currency_mxn
  CHECK (currency = 'MXN');

ALTER TABLE orders
  ADD CONSTRAINT ck_orders_state
  CHECK (
    state IN (
      'CREATED',
      'PREFERENCE_PENDING',
      'PAYMENT_PENDING',
      'PAID',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'REQUIRES_REVIEW',
      'REFUNDED',
      'CHARGED_BACK'
    )
  );

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_unit_price_nonnegative
  CHECK (unit_price_cents >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_item_total_nonnegative
  CHECK (item_total_cents >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_total_matches_unit_times_qty
  CHECK (item_total_cents = unit_price_cents * quantity);

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_currency_mxn
  CHECK (currency = 'MXN');

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_journey
  CHECK (journey IN ('J1', 'J2', 'J3', 'J4', 'J5'));

ALTER TABLE capacity_holds
  ADD CONSTRAINT ck_capacity_holds_units_positive
  CHECK (capacity_units > 0);

ALTER TABLE capacity_holds
  ADD CONSTRAINT ck_capacity_holds_state
  CHECK (
    state IN ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED', 'CONFLICT')
  );

ALTER TABLE payments
  ADD CONSTRAINT ck_payments_amount_nonnegative
  CHECK (amount_cents IS NULL OR amount_cents >= 0);

ALTER TABLE payments
  ADD CONSTRAINT ck_payments_currency_mxn
  CHECK (currency IS NULL OR currency = 'MXN');

ALTER TABLE payments
  ADD CONSTRAINT ck_payments_normalized_state
  CHECK (
    normalized_state IN (
      'UNKNOWN',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'REFUNDED',
      'CHARGED_BACK'
    )
  );

ALTER TABLE webhook_events
  ADD CONSTRAINT ck_webhook_events_attempts_nonnegative
  CHECK (attempts >= 0);

ALTER TABLE idempotency_records
  ADD CONSTRAINT ck_idempotency_records_expiry_after_created
  CHECK (expires_at IS NULL OR expires_at >= created_at);

ALTER TABLE tickets
  ADD CONSTRAINT ck_tickets_state
  CHECK (
    state IN ('PENDING', 'ISSUED', 'REISSUED', 'USED', 'REVOKED', 'CANCELLED')
  );

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT ck_ticket_credential_generations_generation_positive
  CHECK (generation > 0);

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT ck_ticket_credential_generations_expires_after_issued
  CHECK (expires_at IS NULL OR expires_at >= issued_at);

ALTER TABLE ticket_credential_generations
  ADD CONSTRAINT ck_ticket_credential_generations_revoked_after_issued
  CHECK (revoked_at IS NULL OR revoked_at >= issued_at);

ALTER TABLE access_entitlements
  ADD CONSTRAINT ck_access_entitlements_state
  CHECK (state IN ('AVAILABLE', 'USED', 'REVOKED'));

ALTER TABLE outbox_delivery_jobs
  ADD CONSTRAINT ck_outbox_delivery_jobs_attempts_nonnegative
  CHECK (attempts >= 0);

-- ---------------------------------------------------------------------
-- Partial unique indexes — catalog sessions and public refs
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX uq_event_days_event_date_session_not_null
  ON event_days (event_code, day_date, session)
  WHERE session IS NOT NULL;

CREATE UNIQUE INDEX uq_event_days_event_date_session_null
  ON event_days (event_code, day_date)
  WHERE session IS NULL;

CREATE UNIQUE INDEX uq_buyer_contacts_public_ref
  ON buyer_contacts (public_ref)
  WHERE public_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_participants_public_ref
  ON participants (public_ref)
  WHERE public_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_teams_public_ref
  ON teams (public_ref)
  WHERE public_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_orders_tracking_ref
  ON orders (tracking_ref)
  WHERE tracking_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_orders_external_reference
  ON orders (external_reference)
  WHERE external_reference IS NOT NULL;

CREATE UNIQUE INDEX uq_tickets_folio_namespace_folio
  ON tickets (folio_namespace, folio)
  WHERE folio_namespace IS NOT NULL
    AND folio IS NOT NULL;

-- ---------------------------------------------------------------------
-- Partial unique indexes — team roster
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX uq_team_members_active_position
  ON team_members (team_id, position)
  WHERE state NOT IN ('REMOVED', 'REPLACED');

CREATE UNIQUE INDEX uq_team_members_active_captain
  ON team_members (team_id)
  WHERE role = 'CAPTAIN'
    AND state NOT IN ('REMOVED', 'REPLACED');

CREATE UNIQUE INDEX uq_team_members_active_participant
  ON team_members (team_id, participant_id)
  WHERE participant_id IS NOT NULL
    AND state NOT IN ('REMOVED', 'REPLACED');

CREATE UNIQUE INDEX uq_team_members_registration
  ON team_members (registration_id)
  WHERE registration_id IS NOT NULL;

CREATE UNIQUE INDEX uq_team_members_invitation_capability
  ON team_members (invitation_capability_id)
  WHERE invitation_capability_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Partial unique indexes — capability active generations and history
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX uq_capability_invitation_exchange_generation
  ON capability_credentials (team_member_id, least_scope, generation)
  WHERE kind = 'INVITATION_EXCHANGE_CODE'
    AND team_member_id IS NOT NULL;

CREATE UNIQUE INDEX uq_capability_order_holder_generation
  ON capability_credentials (order_id, subject_ref, least_scope, generation)
  WHERE kind = 'ORDER_HOLDER'
    AND order_id IS NOT NULL
    AND subject_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_capability_captain_generation
  ON capability_credentials (team_id, subject_ref, least_scope, generation)
  WHERE kind = 'CAPTAIN'
    AND team_id IS NOT NULL
    AND subject_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_capability_invited_member_generation
  ON capability_credentials (team_member_id, subject_ref, least_scope, generation)
  WHERE kind = 'INVITED_MEMBER'
    AND team_member_id IS NOT NULL
    AND subject_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_capability_ticket_access_generation
  ON capability_credentials (ticket_id, subject_ref, least_scope, generation)
  WHERE kind = 'TICKET_ACCESS'
    AND ticket_id IS NOT NULL
    AND subject_ref IS NOT NULL;

CREATE UNIQUE INDEX uq_capability_active_invitation_exchange
  ON capability_credentials (team_member_id, least_scope)
  WHERE kind = 'INVITATION_EXCHANGE_CODE'
    AND team_member_id IS NOT NULL
    AND state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE');

CREATE UNIQUE INDEX uq_capability_active_order_holder
  ON capability_credentials (order_id, subject_ref, least_scope)
  WHERE kind = 'ORDER_HOLDER'
    AND order_id IS NOT NULL
    AND subject_ref IS NOT NULL
    AND state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE');

CREATE UNIQUE INDEX uq_capability_active_captain
  ON capability_credentials (team_id, subject_ref, least_scope)
  WHERE kind = 'CAPTAIN'
    AND team_id IS NOT NULL
    AND subject_ref IS NOT NULL
    AND state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE');

CREATE UNIQUE INDEX uq_capability_active_invited_member
  ON capability_credentials (team_member_id, subject_ref, least_scope)
  WHERE kind = 'INVITED_MEMBER'
    AND team_member_id IS NOT NULL
    AND subject_ref IS NOT NULL
    AND state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE');

CREATE UNIQUE INDEX uq_capability_active_ticket_access
  ON capability_credentials (ticket_id, subject_ref, least_scope)
  WHERE kind = 'TICKET_ACCESS'
    AND ticket_id IS NOT NULL
    AND subject_ref IS NOT NULL
    AND state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE');

-- ---------------------------------------------------------------------
-- Partial unique indexes — payments, webhook, idempotency, tickets
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX uq_payments_provider_payment_id
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX uq_webhook_events_provider_notification_id
  ON webhook_events (provider, provider_notification_id)
  WHERE provider_notification_id IS NOT NULL;

CREATE UNIQUE INDEX uq_idempotency_records_scope_actor_key
  ON idempotency_records (scope, actor_context, key_hash)
  WHERE actor_context IS NOT NULL;

CREATE UNIQUE INDEX uq_idempotency_records_scope_key_null_actor
  ON idempotency_records (scope, key_hash)
  WHERE actor_context IS NULL;

CREATE UNIQUE INDEX uq_ticket_credential_generations_active
  ON ticket_credential_generations (ticket_id)
  WHERE state = 'ACTIVE';

CREATE UNIQUE INDEX uq_access_entitlements_ticket_date_session_not_null
  ON access_entitlements (ticket_id, entitlement_date, session)
  WHERE entitlement_date IS NOT NULL
    AND session IS NOT NULL;

CREATE UNIQUE INDEX uq_access_entitlements_ticket_date_session_null
  ON access_entitlements (ticket_id, entitlement_date)
  WHERE entitlement_date IS NOT NULL
    AND session IS NULL;

-- ---------------------------------------------------------------------
-- Non-unique indexes justified by FK lookups / queues / filters
-- Omitted as redundant with unique/PK prefixes:
--  · event_days(event_code) — covered by uq_event_days_* leftmost
--  · products(event_code) — covered by uq_products_event_code_code leftmost
-- ---------------------------------------------------------------------

CREATE INDEX idx_participants_buyer_contact_id
  ON participants (buyer_contact_id);

CREATE INDEX idx_registrations_event_id
  ON registrations (event_id);

CREATE INDEX idx_registrations_product_id
  ON registrations (product_id);

CREATE INDEX idx_registrations_participant_id
  ON registrations (participant_id);

CREATE INDEX idx_registrations_order_id
  ON registrations (order_id);

CREATE INDEX idx_registrations_team_id
  ON registrations (team_id);

CREATE INDEX idx_registrations_team_member_id
  ON registrations (team_member_id);

CREATE INDEX idx_registrations_state_eligibility
  ON registrations (state, eligibility_state);

CREATE INDEX idx_teams_product_id
  ON teams (product_id);

CREATE INDEX idx_teams_captain_participant_id
  ON teams (captain_participant_id);

CREATE INDEX idx_teams_roster_eligibility
  ON teams (roster_state, eligibility_state);

CREATE INDEX idx_team_members_team_id
  ON team_members (team_id);

CREATE INDEX idx_team_members_participant_id
  ON team_members (participant_id);

CREATE INDEX idx_team_members_state
  ON team_members (state);

CREATE INDEX idx_capability_credentials_order_id
  ON capability_credentials (order_id);

CREATE INDEX idx_capability_credentials_team_id
  ON capability_credentials (team_id);

CREATE INDEX idx_capability_credentials_team_member_id
  ON capability_credentials (team_member_id);

CREATE INDEX idx_capability_credentials_ticket_id
  ON capability_credentials (ticket_id);

CREATE INDEX idx_capability_credentials_state_expires
  ON capability_credentials (state, expires_at);

CREATE INDEX idx_waiver_acceptances_waiver_document_id
  ON waiver_acceptances (waiver_document_id);

CREATE INDEX idx_waiver_acceptances_participant_id
  ON waiver_acceptances (participant_id);

CREATE INDEX idx_orders_buyer_contact_id
  ON orders (buyer_contact_id);

CREATE INDEX idx_orders_state_created_at
  ON orders (state, created_at);

CREATE INDEX idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX idx_order_items_product_id
  ON order_items (product_id);

CREATE INDEX idx_capacity_holds_product_state_expires
  ON capacity_holds (product_id, state, expires_at);

CREATE INDEX idx_capacity_holds_order_id
  ON capacity_holds (order_id);

CREATE INDEX idx_capacity_holds_order_item_id
  ON capacity_holds (order_item_id);

CREATE INDEX idx_payments_order_id
  ON payments (order_id);

CREATE INDEX idx_payments_normalized_state_updated
  ON payments (normalized_state, updated_at);

CREATE INDEX idx_payment_verification_records_payment_id
  ON payment_verification_records (payment_id);

CREATE INDEX idx_payment_verification_records_order_id
  ON payment_verification_records (order_id);

CREATE INDEX idx_webhook_events_payment_id
  ON webhook_events (payment_id);

CREATE INDEX idx_webhook_events_processing_received
  ON webhook_events (processing_state, received_at);

CREATE INDEX idx_idempotency_records_state_expires
  ON idempotency_records (state, expires_at);

CREATE INDEX idx_tickets_participant_id
  ON tickets (participant_id);

CREATE INDEX idx_tickets_product_id
  ON tickets (product_id);

CREATE INDEX idx_tickets_state
  ON tickets (state);

CREATE INDEX idx_ticket_credential_generations_ticket_state
  ON ticket_credential_generations (ticket_id, state);

CREATE INDEX idx_access_entitlements_ticket_date_state
  ON access_entitlements (ticket_id, entitlement_date, state);

CREATE INDEX idx_activity_log_entity
  ON activity_log (entity_type, entity_ref);

CREATE INDEX idx_activity_log_correlation_id
  ON activity_log (correlation_id);

CREATE INDEX idx_activity_log_created_at
  ON activity_log (created_at);

CREATE INDEX idx_outbox_delivery_jobs_state_next_attempt
  ON outbox_delivery_jobs (state, next_attempt_at);

COMMENT ON CONSTRAINT uq_events_code ON events IS 'SPEC-032 public event code uniqueness.';
COMMENT ON CONSTRAINT ck_registrations_exactly_one_holder ON registrations IS 'Exactly one of participant_id or access_holder_id.';
COMMENT ON CONSTRAINT ck_order_items_total_matches_unit_times_qty ON order_items IS 'Declarative monetary integrity for item totals; order-level sum deferred to runtime.';

COMMIT;
