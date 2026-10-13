-- =====================================================================
-- 0033_affiliate-studio-profile.sql
-- DEFERRED PAST LAUNCH 2026-09-25. Do not apply for the launch MVP.
-- The live ops-partners function does not read or write city/notes.
-- Purpose: Studio profile fields for Community Partners on affiliates.
--          Community Partner remains affiliates.code. No parallel table.
-- Predecessor: 0029_affiliate-price-lock.sql
--
-- city and notes are nullable so existing affiliate rows stay valid.
-- Does NOT change checkout_start_tx, price lock, orders, or payments.
-- Does NOT apply itself to Main. Owner authorizes apply.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
-- =====================================================================

ALTER TABLE public.affiliates
  ADD COLUMN city text NULL,
  ADD COLUMN notes text NULL;

ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_city_len
    CHECK (city IS NULL OR char_length(btrim(city)) BETWEEN 1 AND 80);

ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_notes_len
    CHECK (notes IS NULL OR char_length(notes) <= 1000);

COMMENT ON COLUMN public.affiliates.city IS
  'Studio city for the Community Partners admin. Not copied onto orders.';

COMMENT ON COLUMN public.affiliates.notes IS
  'Internal notes for OWNER. Not shown on the sales order detail.';
