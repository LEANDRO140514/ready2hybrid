-- =====================================================================
-- 0029_affiliate-price-lock.sql
-- Purpose: Affiliates can lock competitor checkout to the launch price.
--          commission_bps default for new rows becomes 0.
-- Predecessor: 0028_affiliates.sql
--
-- locks_launch_price DEFAULT true: a new affiliate locks launch price
-- unless the organizer turns the flag off. Existing rows are not rewritten
-- by SET DEFAULT; only future inserts pick up commission_bps = 0.
--
-- This migration does NOT apply itself to Main. Owner authorizes apply.
-- Does NOT modify checkout_start_tx, mp-webhook, or payment tables.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
-- =====================================================================

ALTER TABLE public.affiliates
  ADD COLUMN locks_launch_price boolean NOT NULL DEFAULT true;

ALTER TABLE public.affiliates
  ALTER COLUMN commission_bps SET DEFAULT 0;
