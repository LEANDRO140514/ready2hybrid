-- =====================================================================
-- 0016_compensating-privilege-hardening-checkout-compatibility.sql
-- Purpose: CHECKOUT-COMPATIBLE COMPENSATING PRIVILEGE HARDENING.
--          Versioned correction of the incompatible R1 surface introduced
--          by 0015 (OD-040-002-B2) after OD-040-002-B3 demonstrated that
--          revoking UPDATE on public.products / public.events breaks
--          checkout_start_tx, which uses SELECT ... FOR UPDATE on both
--          tables (insforge/migrations/0005_checkout_start_transaction.sql
--          lines 67-70 and 76-79).
-- Authority: Explicit Project Owner authorization for
--            OD-040-002-B2-FIX1 — Checkout-compatible compensating
--            privilege hardening (2026-07-30, EXECUTE — LOCAL ONLY)
--            and OD-040-002-B2-FIX2 — InsForge runner-compatible
--            migration correction (2026-07-30, EXECUTE — LOCAL
--            CORRECTION ONLY).
--
-- THIS MIGRATION DOES NOT ACHIEVE TRUE LEAST PRIVILEGE.
-- It is runner-compatible checkout-compatible compensating privilege
-- hardening only.
--
-- TRANSACTION CONTROL (OD-040-002-B2-FIX2):
--   This migration does NOT include executable BEGIN/COMMIT/ROLLBACK.
--   The InsForge migration runner rejects explicit transaction-control
--   statements ("Transaction control statements are not allowed") and
--   wraps each migration in its own transactional context
--   (CONFIRMED_BY_DOCUMENTATION in insforge-cli migrations reference;
--   also observed in OD-040-002-B3-RETEST when apply of the pre-FIX2
--   file failed before any DCL ran). Atomicity of the runner wrap is
--   therefore PLATFORM_MANAGED / CONFIRMED_BY_DOCUMENTATION for the
--   apply path; end-to-end atomicity against this project's sandbox
--   after FIX2 is NOT OBSERVABLE until a future authorized retest.
--
-- WHY 0015 IS NOT MODIFIED:
--   0015 was already recorded as migration version 15 on the
--   impl-14a-expiry sandbox. Retrospective edits of applied migration
--   files are forbidden. 0016 is the forward correction.
--
-- WHY UPDATE ON events/products IS RESTORED (GRANT UPDATE):
--   Classification corrected after B3:
--     project_admin UPDATE on products/events
--       = REQUIRED_ONLY_BEHIND_RPC
--   not UNUSED_AND_REVOCABLE.
--   PostgreSQL requires the UPDATE privilege for SELECT ... FOR UPDATE.
--   This unit does NOT remove or alter those row locks in checkout.
--   The GRANT UPDATE is therefore a versioned correction of an
--   incompatible REVOKE, not an arbitrary privilege widening.
--
-- RESIDUAL RISK (honest):
--   UPDATE on events/products remains structurally excessive for a
--   shared project_admin identity: any Edge Function using that
--   identity could issue direct UPDATE DML, not only FOR UPDATE
--   locks inside checkout_start_tx. That is a platform limitation
--   (no per-function role). Privilege = functionally required but
--   structurally excessive due to platform capability gap.
--
-- FINAL STATE (imposed by this migration, independent of whether the
-- target DB previously had 0015 applied then rolled back, or is a
-- greenfield that will run 0015 then 0016):
--   anon / authenticated:
--     no SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
--     on any of the 24 canonical domain tables
--   project_admin.events:
--     SELECT=yes, UPDATE=yes, INSERT=no, DELETE=no, TRUNCATE=no
--   project_admin.products:
--     SELECT=yes, UPDATE=yes, INSERT=no, DELETE=no, TRUNCATE=no
--   project_admin.event_days:
--     SELECT/INSERT/UPDATE/DELETE/TRUNCATE = no
--   project_admin.participant_sensitive_profiles:
--     SELECT/INSERT/UPDATE/DELETE/TRUNCATE = no
--   project_admin.activity_log:
--     UPDATE=no, INSERT=yes (append-only)
--
-- Explicitly OUT of scope (R2/R3):
--   DELETE/TRUNCATE on the other 20 project_admin write-bearing tables
--   outbox_delivery_jobs privilege changes
--   EXECUTE changes on any function
--   REFERENCES/TRIGGER changes for project_admin
--   ownership / roles / RLS / policies / function bodies
--
-- Depends on:
--   0001 .. 0015 (0015 may or may not be live; this file re-asserts the
--   intended final ACL so either path converges)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. anon / authenticated: force final public-deny state on all 24
--    canonical domain tables (idempotent REVOKE; safe on already-denied
--    and on baseline-restored sandboxes alike).
-- ---------------------------------------------------------------------

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.events FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.event_days FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.products FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.buyer_contacts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participants FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participant_sensitive_profiles FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.registrations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.teams FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.team_members FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capability_credentials FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_documents FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_acceptances FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.orders FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_items FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capacity_holds FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payments FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payment_verification_records FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.webhook_events FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.idempotency_records FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tickets FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ticket_credential_generations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.access_entitlements FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.activity_log FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.outbox_delivery_jobs FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. project_admin catalog tables: keep SELECT + UPDATE (FOR UPDATE
--    compatibility); revoke unused INSERT/DELETE/TRUNCATE.
-- ---------------------------------------------------------------------

-- Corrective GRANT: restores UPDATE if 0015 previously revoked it;
-- no-op (idempotent) if the sandbox is already at the pre-hardening
-- baseline where UPDATE was never removed.
GRANT UPDATE ON TABLE public.events TO project_admin;
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;

GRANT UPDATE ON TABLE public.products TO project_admin;
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;

-- ---------------------------------------------------------------------
-- 3. Unused-and-revocable tables (unchanged from B1 R1 intent).
-- ---------------------------------------------------------------------

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles FROM project_admin;

-- ---------------------------------------------------------------------
-- 4. activity_log: append-only for project_admin (UPDATE revoked).
-- ---------------------------------------------------------------------

REVOKE UPDATE ON TABLE public.activity_log FROM project_admin;

-- =====================================================================
-- ROLLBACK (documented only — NOT executed by this migration file).
-- Restores the privilege baseline observed BEFORE any compensating
-- hardening (pre-B3 / pre-0015), NOT the broken intermediate state of
-- 0015-with-UPDATE-revoked. Copy into a separately authorized operation
-- if a future sandbox validation of 0016 must be undone.
-- The BEGIN/COMMIT lines below are documentary only (commented); they
-- are not part of the executable migration body.
--
-- After running, confirm with has_table_privilege(...) for each pair:
--
-- BEGIN;
--
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.events TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.event_days TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.products TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.buyer_contacts TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participants TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.participant_sensitive_profiles TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.registrations TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.teams TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.team_members TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capability_credentials TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_documents TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.waiver_acceptances TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.orders TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_items TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.capacity_holds TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payments TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payment_verification_records TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.webhook_events TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.idempotency_records TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tickets TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ticket_credential_generations TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.access_entitlements TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.activity_log TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.outbox_delivery_jobs TO anon, authenticated;
--
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events TO project_admin;
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products TO project_admin;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days TO project_admin;
-- GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.participant_sensitive_profiles TO project_admin;
-- GRANT UPDATE ON TABLE public.activity_log TO project_admin;
--
-- COMMIT;
-- =====================================================================
