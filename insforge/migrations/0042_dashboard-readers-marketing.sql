-- =====================================================================
-- 0042_dashboard-readers-marketing.sql
-- Purpose: let dashboard_readers hold the MARKETING role. MARKETING reads one
--          view only (ops-commercial-read `contacts`): paid, pending and
--          identified contacts for retargeting outside the platform.
--          It gets no sales snapshot, no reconciliation, no payment data.
-- Predecessor: 0030_dashboard-readers.sql (0040 and 0041 are unrelated).
-- Numbered 0042: 0041 is taken by 0041_openpay-hosted-checkout.sql on
-- feat/openpay-hosted-checkout.
--
-- Touches no data. Replaces one CHECK constraint. No user rows are seeded.
-- Rollback (only valid while no MARKETING row exists):
--   ALTER TABLE public.dashboard_readers
--     DROP CONSTRAINT ck_dashboard_readers_role;
--   ALTER TABLE public.dashboard_readers
--     ADD CONSTRAINT ck_dashboard_readers_role
--     CHECK (role IN ('OWNER', 'FINANCE'));
--
-- Deploy order: the new ops-commercial-read and ops-sales-read first (they
-- ignore a role they do not know), then this migration, then the insert.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   wraps each migration in its own transaction.
-- =====================================================================

ALTER TABLE public.dashboard_readers
  DROP CONSTRAINT ck_dashboard_readers_role;

ALTER TABLE public.dashboard_readers
  ADD CONSTRAINT ck_dashboard_readers_role
  CHECK (role IN ('OWNER', 'FINANCE', 'MARKETING'));

COMMENT ON TABLE public.dashboard_readers IS
  'Allowlist for the ops dashboard. OWNER and FINANCE read sales. MARKETING reads only the contact list. Does not grant writes on orders, payments, products, affiliates, or events.';
