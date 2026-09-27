-- =====================================================================
-- 0030_dashboard-readers.sql
-- Purpose: Read-only allowlist for the sales dashboard.
--          Roles: OWNER, FINANCE. No write grant on orders or payments.
-- Predecessor: 0029_affiliate-price-lock.sql
--
-- This is not the operational door-assignment model (0017). FINANCE is not
-- a check-in role and is not added to ck_operational_assignments_role.
--
-- NOT applied to Main by the dashboard unit. Owner applies it explicitly.
-- No user rows are seeded.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   wraps each migration in its own transaction.
-- =====================================================================

CREATE TABLE public.dashboard_readers (
  auth_user_id text PRIMARY KEY,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_dashboard_readers_role
    CHECK (role IN ('OWNER', 'FINANCE')),
  CONSTRAINT ck_dashboard_readers_auth_user_id_nonempty
    CHECK (btrim(auth_user_id) <> '')
);

COMMENT ON TABLE public.dashboard_readers IS
  'Allowlist for read-only sales dashboard. Does not grant writes on orders, payments, products, affiliates, or events.';

ALTER TABLE public.dashboard_readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_readers FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dashboard_readers FROM PUBLIC;
REVOKE ALL ON TABLE public.dashboard_readers FROM anon, authenticated;
