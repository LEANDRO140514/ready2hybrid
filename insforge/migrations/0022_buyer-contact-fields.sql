-- =====================================================================
-- 0022_buyer-contact-fields.sql
-- Purpose: Add buyer contact PII columns on public.buyer_contacts for
--          ticket delivery and operational contact (email, name, phone).
-- Predecessor: 0001_minimal_sales_schema.sql
-- Authority: Project Owner decisions 2026-08-25 (unit: buyer contact capture
--            step 1 — migration only). Closes the open personal-field
--            decision left by SPEC-032 BuyerContact shell; NO SPEC-032
--            revision required (Owner + evidence governance).
--
-- Columns:
--  · email  text NULLABLE  — harden to NOT NULL in a later successor after
--                            checkout always writes it
--  · name   text NULLABLE
--  · phone  text NULLABLE
--
-- Constraints:
--  · ck_buyer_contacts_email_has_at — loose CHECK only:
--      email IS NULL OR POSITION('@' IN email) > 1
--    No RFC regex. Edge Zod validation is a later unit (not this migration).
--
-- Explicitly out of scope:
--  · participants jsonb / participant personal fields
--  · Automatic backfill of existing rows (remain NULL; Owner may fill by hand)
--  · checkout_start_tx / edge contract / Zod / ticket email delivery
--  · New RLS policies (deny-by-default + RPC unchanged)
--  · Apply to Main / sandbox (not authorized by this unit)
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
-- =====================================================================

ALTER TABLE public.buyer_contacts
  ADD COLUMN email text,
  ADD COLUMN name text,
  ADD COLUMN phone text;

COMMENT ON COLUMN public.buyer_contacts.email IS
  'PII: buyer contact email for ticket delivery and operational contact. NULLABLE until checkout always writes it; NOT NULL deferred to a successor migration. Loose format gate: must contain @ when present.';

COMMENT ON COLUMN public.buyer_contacts.name IS
  'PII: buyer display / contact name for operational contact and ticket delivery context. NULLABLE.';

COMMENT ON COLUMN public.buyer_contacts.phone IS
  'PII: buyer contact phone for operational contact. NULLABLE. Format not enforced in SQL.';

COMMENT ON TABLE public.buyer_contacts IS
  'SPEC-032 BuyerContact; not automatically payer/participant/access holder. Personal contact fields (email, name, phone) are PII used for ticket delivery and operational contact. Exact inventory closed by Owner 2026-08-25; email remains NULLABLE until checkout successor.';

-- Loose email shape only. NULL rows (historical ~10 on Main) must pass.
ALTER TABLE public.buyer_contacts
  DROP CONSTRAINT IF EXISTS ck_buyer_contacts_email_has_at;

ALTER TABLE public.buyer_contacts
  ADD CONSTRAINT ck_buyer_contacts_email_has_at
  CHECK (email IS NULL OR POSITION('@' IN email) > 1);
