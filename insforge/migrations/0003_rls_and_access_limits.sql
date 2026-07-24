-- =====================================================================
-- 0003_rls_and_access_limits.sql
-- Purpose: Enable deny-by-default Row Level Security on the Ready2Hybrid
--          minimal sales schema (SPEC-032 / ACCESS-DEC-001..008 APPROVED).
-- Authority: Explicit Project Owner authorization for IMPL-4 RLS/access-only
--            with local isolated validation and NO InsForge deployment.
-- Depends on:
--   0001_minimal_sales_schema.sql
--   0002_sales_constraints_and_indexes.sql
--
-- Limits of this migration:
--  · ENABLE + FORCE ROW LEVEL SECURITY on the 24 canonical tables.
--  · REVOKE direct table privileges from PUBLIC.
--  · Does NOT create end-user or capability-as-role policies.
--  · Does NOT create PostgreSQL roles for ORDER_HOLDER/CAPTAIN/
--    INVITED_MEMBER/TICKET_HOLDER (those are backend capability contexts).
--  · Does NOT create staff/operator/admin access.
--  · Does NOT invent capability TTL, retention jobs, or endpoints.
--  · Does NOT insert/update/delete domain data or run the seed.
--  · Does NOT deploy to the canonical InsForge project.
--
-- Backend boundary (ACCESS-DEC-001..003):
--  Canonical reads/writes occur only through protected backend services.
--  A service identity must use an approved mechanism such as BYPASSRLS
--  (or a later owner-approved service policy). Browser ANON and
--  authenticated clients must not hold direct table privileges.
--
-- Reserved for later units: checkout, webhook, tickets, Mercado Pago,
-- capability-gated runtime endpoints, seed execution, InsForge deploy.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Enable and force RLS on all 24 canonical tables
-- FORCE prevents table-owner bypass so deny-by-default holds unless the
-- connecting role has BYPASSRLS or an approved policy (none created here).
-- ---------------------------------------------------------------------

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_days FORCE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

ALTER TABLE buyer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_contacts FORCE ROW LEVEL SECURITY;

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants FORCE ROW LEVEL SECURITY;

ALTER TABLE participant_sensitive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_sensitive_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations FORCE ROW LEVEL SECURITY;

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;

ALTER TABLE capability_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE waiver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE waiver_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_acceptances FORCE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;

ALTER TABLE capacity_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_holds FORCE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

ALTER TABLE payment_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verification_records FORCE ROW LEVEL SECURITY;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;

ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records FORCE ROW LEVEL SECURITY;

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

ALTER TABLE ticket_credential_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_credential_generations FORCE ROW LEVEL SECURITY;

ALTER TABLE access_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_entitlements FORCE ROW LEVEL SECURITY;

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log FORCE ROW LEVEL SECURITY;

ALTER TABLE outbox_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_delivery_jobs FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. Revoke direct privileges from PUBLIC (browser-facing default)
-- ---------------------------------------------------------------------

REVOKE ALL ON TABLE events FROM PUBLIC;
REVOKE ALL ON TABLE event_days FROM PUBLIC;
REVOKE ALL ON TABLE products FROM PUBLIC;
REVOKE ALL ON TABLE buyer_contacts FROM PUBLIC;
REVOKE ALL ON TABLE participants FROM PUBLIC;
REVOKE ALL ON TABLE participant_sensitive_profiles FROM PUBLIC;
REVOKE ALL ON TABLE registrations FROM PUBLIC;
REVOKE ALL ON TABLE teams FROM PUBLIC;
REVOKE ALL ON TABLE team_members FROM PUBLIC;
REVOKE ALL ON TABLE capability_credentials FROM PUBLIC;
REVOKE ALL ON TABLE waiver_documents FROM PUBLIC;
REVOKE ALL ON TABLE waiver_acceptances FROM PUBLIC;
REVOKE ALL ON TABLE orders FROM PUBLIC;
REVOKE ALL ON TABLE order_items FROM PUBLIC;
REVOKE ALL ON TABLE capacity_holds FROM PUBLIC;
REVOKE ALL ON TABLE payments FROM PUBLIC;
REVOKE ALL ON TABLE payment_verification_records FROM PUBLIC;
REVOKE ALL ON TABLE webhook_events FROM PUBLIC;
REVOKE ALL ON TABLE idempotency_records FROM PUBLIC;
REVOKE ALL ON TABLE tickets FROM PUBLIC;
REVOKE ALL ON TABLE ticket_credential_generations FROM PUBLIC;
REVOKE ALL ON TABLE access_entitlements FROM PUBLIC;
REVOKE ALL ON TABLE activity_log FROM PUBLIC;
REVOKE ALL ON TABLE outbox_delivery_jobs FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 3. Documentary comments (no policies, no capability roles)
-- ---------------------------------------------------------------------

COMMENT ON TABLE events IS
  'SPEC-032 Event; PUBLIC_CONFIG via backend projection only. RLS deny-by-default (IMPL-4).';

COMMENT ON TABLE event_days IS
  'SPEC-032 EventDaySession; PUBLIC_CONFIG via backend projection only. RLS deny-by-default (IMPL-4).';

COMMENT ON TABLE products IS
  'SPEC-032 Product; PUBLIC_CONFIG via backend projection only. RLS deny-by-default (IMPL-4).';

COMMENT ON TABLE participant_sensitive_profiles IS
  'SPEC-032 ParticipantSensitiveProfile; SENSITIVE; backend service only (ACCESS-DEC-006/007).';

COMMENT ON TABLE capability_credentials IS
  'SPEC-032 CapabilityCredential; SECURITY_CREDENTIAL hashes only; not a PostgreSQL role identity.';

COMMENT ON TABLE activity_log IS
  'SPEC-032 ActivityLog; AUDIT store; browser direct access denied (ACCESS-DEC-005).';

COMMENT ON TABLE outbox_delivery_jobs IS
  'SPEC-032 OutboxDeliveryJob; DELIVERY queue; browser direct access denied.';

COMMIT;
